import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { parseWithZod } from "../http.js";
import { AuthService } from "./auth.service.js";
import { parseCookies, serializeCookie, SESSION_COOKIE } from "./session.js";

const nonceBody = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

const verifyBody = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  nonce: z.string().min(8),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

@Controller()
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("auth/nonce")
  issue(@Body() body: unknown) {
    const input = parseWithZod(nonceBody, body);
    return this.auth.issueNonce(input.address);
  }

  @Post("auth/verify-signature")
  async verify(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = parseWithZod(verifyBody, body);
    const session = await this.auth.verifySignature({
      address: input.address,
      nonce: input.nonce,
      signature: input.signature as `0x${string}`,
    });
    response.setHeader(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE, this.auth.encodeSession(session), {
        maxAge: this.auth.sessionTtl(),
        secure: process.env.NODE_ENV === "production",
      }),
    );
    return { address: session.address, expiresAt: new Date(session.exp * 1000).toISOString() };
  }

  @Get("auth/session")
  session(@Req() request: Request) {
    const cookies = parseCookies(request.headers.cookie);
    const session = this.auth.readSession(cookies[SESSION_COOKIE]);
    return { address: session.address, expiresAt: new Date(session.exp * 1000).toISOString() };
  }

  @Post("auth/logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.setHeader(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE, "", {
        maxAge: 0,
        secure: process.env.NODE_ENV === "production",
        clear: true,
      }),
    );
    return { ok: true };
  }
}
