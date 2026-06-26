import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ProductsService } from "./products.service.js";
import { CreateProductDto, UpdateProductDto } from "./dto.js";

@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** قائمة منتجات متجر — عامة (واجهة المتجر). */
  @Get("stores/:storeId/products")
  list(@Param("storeId") storeId: string, @Query("all") all?: string) {
    return this.products.listByStore(storeId, all === "1");
  }

  @Get("products/:id")
  findById(@Param("id") id: string) {
    return this.products.findById(id);
  }

  @Post("stores/:storeId/products")
  @UseGuards(JwtAuthGuard)
  create(@Param("storeId") storeId: string, @Body() dto: CreateProductDto) {
    return this.products.create(storeId, dto);
  }

  @Patch("products/:id")
  @UseGuards(JwtAuthGuard)
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete("products/:id")
  @UseGuards(JwtAuthGuard)
  remove(@Param("id") id: string) {
    return this.products.remove(id);
  }
}
