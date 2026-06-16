import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { OrdersService } from "./orders.service.js";
import { PlaceOrderDto } from "./dto.js";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  place(@Body() dto: PlaceOrderDto) {
    return this.orders.place(dto);
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.orders.findById(id);
  }
}
