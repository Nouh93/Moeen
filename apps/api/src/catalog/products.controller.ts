import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { JwtPayload } from "../auth/auth.service.js";
import { OwnershipService } from "../auth/ownership.service.js";
import { ProductsService } from "./products.service.js";
import { CreateProductDto, UpdateProductDto } from "./dto.js";

@Controller()
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly ownership: OwnershipService,
  ) {}

  /** قائمة منتجات متجر — عامة (واجهة المتجر) مع ترقيم صفحات. */
  @Get("stores/:storeId/products")
  list(
    @Param("storeId") storeId: string,
    @Query("all") all?: string,
    @Query("page") page?: string,
    @Query("perPage") perPage?: string,
  ) {
    return this.products.listByStore(storeId, all === "1", page, perPage);
  }

  @Get("products/:id")
  findById(@Param("id") id: string) {
    return this.products.findById(id);
  }

  @Post("stores/:storeId/products")
  @UseGuards(JwtAuthGuard)
  async create(
    @Param("storeId") storeId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.ownership.assertOwnsStore(user, storeId);
    return this.products.create(storeId, dto);
  }

  @Patch("products/:id")
  @UseGuards(JwtAuthGuard)
  async update(@Param("id") id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: JwtPayload) {
    await this.ownership.assertOwnsProduct(user, id);
    return this.products.update(id, dto);
  }

  @Delete("products/:id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    await this.ownership.assertOwnsProduct(user, id);
    return this.products.remove(id);
  }
}
