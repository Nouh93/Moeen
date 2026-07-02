import { Controller, Get, Param } from "@nestjs/common";
import { OrdersService } from "./orders.service.js";

/** تتبّع الطلب — عام (بلا توكن)، بمعرّف الطلب فقط. */
@Controller("track")
export class TrackingController {
  constructor(private readonly orders: OrdersService) {}

  @Get(":id")
  track(@Param("id") id: string) {
    return this.orders.track(id);
  }
}
