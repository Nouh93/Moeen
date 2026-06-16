import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ShippingService } from "./shipping.service.js";

@Controller("orders/:orderId/shipment")
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  /** إنشاء بوليصة (حجز). */
  @Post("waybill")
  createWaybill(@Param("orderId") orderId: string) {
    return this.shipping.createWaybill(orderId);
  }

  /** تأكيد التسليم (خصم فعلي وتسوية). */
  @Post("deliver")
  deliver(@Param("orderId") orderId: string) {
    return this.shipping.confirmDelivery(orderId);
  }

  /** إلغاء البوليصة (تحرير الحجز). */
  @Post("cancel")
  cancel(@Param("orderId") orderId: string) {
    return this.shipping.cancel(orderId);
  }
}
