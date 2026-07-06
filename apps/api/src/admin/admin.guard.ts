import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";

/** حارس الإدارة — Super Admin فقط (القسم 14) */
@Injectable()
export class AdminGuard extends JwtAuthGuard {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await super.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest();
    if (req.user?.role !== "ADMIN") {
      throw new ForbiddenException("هذه الصفحة لإدارة المنصة فقط");
    }
    return true;
  }
}
