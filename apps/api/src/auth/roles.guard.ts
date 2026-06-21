import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@prisma/client";
import { ROLES_KEY } from "./roles.decorator.js";
import type { AuthedRequest } from "./jwt-auth.guard.js";

/** يتحقّق أن دور المستخدم ضمن الأدوار المسموح بها للمسار. يلي JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("هذه الصلاحية للمشرفين فقط");
    }
    return true;
  }
}
