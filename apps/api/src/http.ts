import {
  BadRequestException,
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { map, type Observable } from "rxjs";
import { ForkError } from "@fork/shared";
import type { ZodType } from "zod";
import { toJsonSafe } from "@fork/blockchain";

export function parseWithZod<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException({
      code: "INVALID_CONFIG",
      message: "Request validation failed",
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

@Catch()
export class ForkExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(typeof body === "string" ? { message: body } : body);
      return;
    }
    if (exception instanceof ForkError) {
      const status =
        exception.code === "INVALID_CONFIG"
          ? 400
          : exception.code === "NO_RELEVANT_EXPOSURE" || exception.code === "NO_FEASIBLE_STRATEGY"
            ? 404
            : exception.code === "SIMULATION_STALE" || exception.code === "MAINNET_STATE_MISMATCH"
              ? 409
              : exception.retryable
                ? 503
                : 422;
      response.status(status).json({ code: exception.code, message: exception.message });
      return;
    }
    response.status(500).json({
      code: "INTERNAL",
      message: exception instanceof Error ? exception.message : String(exception),
    });
  }
}

@Injectable()
export class JsonSafeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => toJsonSafe(value)));
  }
}

export class MemoryRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
  ) {}

  consume(key: string): void {
    const now = Date.now();
    const current = this.hits.get(key);
    if (!current || current.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    if (current.count >= this.max) {
      throw new ServiceUnavailableException({
        code: "RATE_LIMITED",
        message: "Public simulation rate limit exceeded",
      });
    }
    current.count += 1;
  }
}

export function clientKey(request: Request): string {
  return request.ip ?? request.headers["x-forwarded-for"]?.toString() ?? "unknown";
}
