import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { getAddress, isAddress, verifyMessage } from "viem";
import type { AppConfig } from "@fork/config";
import type { PersistenceModels } from "@fork/persistence";
import { BASE_CHAIN_ID, type Address } from "@fork/shared";
import { randomBytes } from "node:crypto";
import { APP_CONFIG } from "../config.token.js";
import { PERSISTENCE } from "../persistence.token.js";
import {
  authMessage,
  createNonce,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session.js";

interface MemoryNonce {
  address: string;
  domain: string;
  issuedAt: string;
  expirationTime: string;
  expiresAt: number;
  used: boolean;
}

@Injectable()
export class AuthService {
  private readonly secret: string;
  private readonly memory = new Map<string, MemoryNonce>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PERSISTENCE) private readonly models: PersistenceModels | null,
  ) {
    if (this.config.SESSION_SECRET) {
      this.secret = this.config.SESSION_SECRET;
    } else if (this.config.NODE_ENV === "production" || this.config.APP_ENV === "production") {
      throw new ServiceUnavailableException({
        code: "INVALID_CONFIG",
        message: "SESSION_SECRET is required for wallet authentication",
      });
    } else {
      this.secret = randomBytes(32).toString("hex");
    }
  }

  sessionSecret(): string {
    return this.secret;
  }

  sessionTtl(): number {
    return this.config.AUTH_SESSION_TTL_SECONDS;
  }

  readSession(token: string | undefined): SessionPayload {
    if (!token) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Wallet session required",
      });
    }
    const session = verifySession(token, this.secret);
    if (!session) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Wallet session is missing or expired",
      });
    }
    return session;
  }

  assertOwns(session: SessionPayload, address: string): Address {
    if (!isAddress(address)) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Wallet must be a 20-byte hex address",
      });
    }
    const wallet = getAddress(address) as Address;
    if (session.address.toLowerCase() !== wallet.toLowerCase()) {
      throw new ForbiddenException({
        code: "UNAUTHORIZED",
        message: "Session is bound to a different wallet",
      });
    }
    return wallet;
  }

  async issueNonce(address: string): Promise<{
    address: Address;
    nonce: string;
    message: string;
    expiresAt: string;
    chainId: number;
  }> {
    if (!isAddress(address)) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Wallet must be a 20-byte hex address",
      });
    }
    const wallet = getAddress(address) as Address;
    const nonce = createNonce();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + this.config.AUTH_NONCE_TTL_SECONDS * 1000);
    const domain = this.config.WEB_ORIGIN;
    const issuedAtIso = issuedAt.toISOString();
    const expirationTime = expiresAt.toISOString();
    if (this.models) {
      await this.models.authNonces.create({
        address: wallet.toLowerCase(),
        nonce,
        domain,
        issuedAt: issuedAtIso,
        expirationTime,
        expiresAt,
      });
    } else {
      this.memory.set(nonce, {
        address: wallet.toLowerCase(),
        domain,
        issuedAt: issuedAtIso,
        expirationTime,
        expiresAt: expiresAt.getTime(),
        used: false,
      });
    }
    const message = authMessage({
      address: wallet,
      nonce,
      domain,
      issuedAt: issuedAtIso,
      expirationTime,
    });
    return {
      address: wallet,
      nonce,
      message,
      expiresAt: expiresAt.toISOString(),
      chainId: BASE_CHAIN_ID,
    };
  }

  async verifySignature(input: {
    address: string;
    signature: `0x${string}`;
    nonce: string;
  }): Promise<SessionPayload> {
    if (!isAddress(input.address)) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Wallet must be a 20-byte hex address",
      });
    }
    const wallet = getAddress(input.address) as Address;
    const record = await this.consumeNonce(input.nonce, wallet);
    const message = authMessage({
      address: wallet,
      nonce: input.nonce,
      domain: record.domain,
      issuedAt: record.issuedAt,
      expirationTime: record.expirationTime,
    });
    const valid = await verifyMessage({
      address: wallet,
      message,
      signature: input.signature,
    });
    if (!valid) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Signature does not match the issued auth message",
      });
    }
    const now = Math.floor(Date.now() / 1000);
    return {
      v: 1,
      address: wallet,
      iat: now,
      exp: now + this.config.AUTH_SESSION_TTL_SECONDS,
    };
  }

  private async consumeNonce(
    nonce: string,
    wallet: Address,
  ): Promise<{ domain: string; issuedAt: string; expirationTime: string }> {
    if (this.models) {
      const doc = (await this.models.authNonces.findOne({ nonce }).lean()) as
        | {
            address?: string;
            domain?: string;
            issuedAt?: string;
            expirationTime?: string;
            expiresAt?: Date;
            usedAt?: Date;
          }
        | null;
      if (!doc || !doc.domain || !doc.issuedAt || !doc.expirationTime || !doc.expiresAt) {
        throw new UnauthorizedException({ code: "UNAUTHORIZED", message: "Unknown auth nonce" });
      }
      if (doc.usedAt) {
        throw new UnauthorizedException({ code: "UNAUTHORIZED", message: "Auth nonce already used" });
      }
      if (new Date(doc.expiresAt).getTime() <= Date.now()) {
        throw new UnauthorizedException({ code: "UNAUTHORIZED", message: "Auth nonce expired" });
      }
      if (String(doc.address).toLowerCase() !== wallet.toLowerCase()) {
        throw new UnauthorizedException({
          code: "UNAUTHORIZED",
          message: "Auth nonce is bound to a different wallet",
        });
      }
      await this.models.authNonces.updateOne({ nonce }, { $set: { usedAt: new Date() } });
      return {
        domain: doc.domain,
        issuedAt: doc.issuedAt,
        expirationTime: doc.expirationTime,
      };
    }
    const memory = this.memory.get(nonce);
    if (!memory) {
      throw new UnauthorizedException({ code: "UNAUTHORIZED", message: "Unknown auth nonce" });
    }
    if (memory.used) {
      throw new UnauthorizedException({ code: "UNAUTHORIZED", message: "Auth nonce already used" });
    }
    if (memory.expiresAt <= Date.now()) {
      throw new UnauthorizedException({ code: "UNAUTHORIZED", message: "Auth nonce expired" });
    }
    if (memory.address !== wallet.toLowerCase()) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Auth nonce is bound to a different wallet",
      });
    }
    memory.used = true;
    return {
      domain: memory.domain,
      issuedAt: memory.issuedAt,
      expirationTime: memory.expirationTime,
    };
  }

  encodeSession(session: SessionPayload): string {
    return signSession(session, this.secret);
  }
}
