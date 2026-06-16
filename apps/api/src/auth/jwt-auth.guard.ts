import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService, type JwtPayload } from "./auth.service.js";

export interface AuthedRequest extends Request {
  user: JwtPayload;
}

/** حارس يتحقّق من توكن JWT في ترويسة Authorization: Bearer. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("توكن الدخول مفقود");
    }
    try {
      request.user = this.auth.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException("توكن الدخول غير صالح أو منتهٍ");
    }
  }
}
