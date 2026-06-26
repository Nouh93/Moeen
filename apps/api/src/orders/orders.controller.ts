import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { JwtPayload } from "../auth/auth.service.js";
import { OwnershipService } from "../auth/ownership.service.js";
import { OrdersService } from "./orders.service.js";
import { PlaceOrderDto } from "./dto.js";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  place(@Body() dto: PlaceOrderDto) {
    return this.orders.place(dto);
  }

  @Get()
  async list(@Query("merchantId") merchantId: string, @CurrentUser() user: JwtPayload) {
    await this.ownership.assertOwnsMerchant(user, merchantId);
    return this.orders.listByMerchant(merchantId);
  }

  @Get(":id")
  async findById(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    await this.ownership.assertOwnsOrder(user, id);
    return this.orders.findById(id);
  }
}
