import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthedRequest } from "./jwt-auth.guard.js";
import type { JwtPayload } from "./auth.service.js";

/** يستخرج المستخدم الحالي من الطلب (يتطلّب JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    return context.switchToHttp().getRequest<AuthedRequest>().user;
  },
);
