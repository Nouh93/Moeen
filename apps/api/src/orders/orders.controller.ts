import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { ORDER_STATUSES, OrderStatus } from "@moeen/shared";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { OrdersService } from "./orders.service";

class CheckoutItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsInt()
  governorateId: number;

  @IsOptional()
  @IsInt()
  districtId?: number;

  @IsOptional()
  @IsString()
  districtText?: string;

  @IsString()
  @IsNotEmpty({ message: "الحي / العزلة مطلوب" })
  neighborhood: string;

  @IsString()
  @IsNotEmpty({ message: "الوصف التفصيلي للموقع مطلوب" })
  addressDetails: string;

  @IsOptional()
  @IsString()
  courierNote?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];
}

class UpdateStatusDto {
  @IsIn(ORDER_STATUSES as unknown as string[])
  status: OrderStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller()
export class OrdersController {
  constructor(private orders: OrdersService) {}

  // ---- عام (واجهة المتجر) ----

  @Post("public/stores/:slug/orders")
  checkout(@Param("slug") slug: string, @Body() dto: CheckoutDto) {
    return this.orders.checkout(slug, dto);
  }

  @Get("public/orders/track/:code")
  track(@Param("code") code: string) {
    return this.orders.track(code.toUpperCase());
  }

  // ---- المشتري: «طلباتي» عبر كل المتاجر (القسم 6.4) ----

  @UseGuards(JwtAuthGuard)
  @Get("me/orders")
  myOrders(@CurrentUser() u: AuthUser) {
    return this.orders.forCustomer(u.phone);
  }

  // ---- التاجر ----

  @UseGuards(JwtAuthGuard)
  @Get("stores/:storeId/orders")
  list(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
  ) {
    return this.orders.list(storeId, u.sub, {
      status,
      q,
      page: page ? Number(page) : 1,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("stores/:storeId/orders/:orderId")
  getOne(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.orders.getOne(storeId, u.sub, orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("stores/:storeId/orders/:orderId/status")
  updateStatus(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.orders.updateStatus(storeId, u.sub, orderId, dto.status, dto.note);
  }
}
