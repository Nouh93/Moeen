import { Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { JwtPayload } from "../auth/auth.service.js";
import { CustomersService } from "./customers.service.js";

@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  /** إنشاء/جلب ملف العميل للمستخدم الحالي. */
  @Post("me")
  createMe(@CurrentUser() user: JwtPayload) {
    return this.customers.ensureForUser(user.sub);
  }
}
