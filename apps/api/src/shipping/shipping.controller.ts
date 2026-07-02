import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { JwtPayload } from "../auth/auth.service.js";
import { OwnershipService } from "../auth/ownership.service.js";
import { ShippingService } from "./shipping.service.js";

@Controller("orders/:orderId/shipment")
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly ownership: OwnershipService,
  ) {}

  /** إنشاء بوليصة (حجز). */
  @Post("waybill")
  async createWaybill(@Param("orderId") orderId: string, @CurrentUser() user: JwtPayload) {
    await this.ownership.assertOwnsOrder(user, orderId);
    return this.shipping.createWaybill(orderId);
  }

  /** تأكيد التسليم (خصم فعلي وتسوية). */
  @Post("deliver")
  async deliver(@Param("orderId") orderId: string, @CurrentUser() user: JwtPayload) {
    await this.ownership.assertOwnsOrder(user, orderId);
    return this.shipping.confirmDelivery(orderId);
  }

  /** إلغاء البوليصة (تحرير الحجز). */
  @Post("cancel")
  async cancel(@Param("orderId") orderId: string, @CurrentUser() user: JwtPayload) {
    await this.ownership.assertOwnsOrder(user, orderId);
    return this.shipping.cancel(orderId);
  }

  /** إرجاع الطلب (RTO) — تحرير الحجز أو استرداد التسوية حسب الحالة. */
  @Post("return")
  async returnOrder(@Param("orderId") orderId: string, @CurrentUser() user: JwtPayload) {
    await this.ownership.assertOwnsOrder(user, orderId);
    return this.shipping.returnOrder(orderId);
  }
}
