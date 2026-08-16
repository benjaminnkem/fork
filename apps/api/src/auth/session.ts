import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, isAddress } from "viem";
import { BASE_CHAIN_ID, type Address } from "@fork/shared";

export const SESSION_COOKIE = "fork_session";

export interface SessionPayload {
  v: 1;
  address: Address;
  iat: number;
  exp: number;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = decodeURIComponent(trimmed.slice(eq + 1));
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; secure: boolean; clear?: boolean },
): string {
  const parts = [
    `${name}=${options.clear ? "" : encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.clear ? 0 : options.maxAge}`,
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string, secret: string): SessionPayload | undefined {
  const [body, sig] = token.split(".");
  if (!body || !sig) return undefined;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(expected);
  const right = Buffer.from(sig);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return undefined;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (payload.v !== 1 || typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return undefined;
  }
  if (!isAddress(payload.address)) return undefined;
  return { ...payload, address: getAddress(payload.address) as Address };
}

export function createNonce(): string {
  return `0x${randomBytes(16).toString("hex")}`;
}

export function authMessage(input: {
  address: string;
  nonce: string;
  domain: string;
  issuedAt: string;
  expirationTime: string;
}): string {
  return [
    "Fork wants you to prove control of this wallet.",
    "",
    `URI: ${input.domain}`,
    `Chain ID: ${BASE_CHAIN_ID}`,
    `Address: ${input.address}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expirationTime}`,
    "",
    "This signature only authenticates preferences and execution association.",
    "It does not submit a transaction or grant spending approval.",
  ].join("\n");
}
