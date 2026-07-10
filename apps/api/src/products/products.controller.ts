import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { ProductsService } from "./products.service";

class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  // منتج مميز يتصدّر واجهة المتجر (القسم 5.4)
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  // ---- بيانات المنتج الكاملة (القسم 5.5) ----
  @IsOptional()
  @IsString()
  sku?: string | null;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number | null;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  minQty?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxQty?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoDescription?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsIn(["ACTIVE", "HIDDEN"])
  status?: string;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  images?: string[];

  @IsOptional()
  variants?: { id?: string; name: string; price?: number; stock?: number }[];
}

class UpdateProductDto extends CreateProductDto {
  @IsOptional()
  @IsString()
  declare name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  declare price: number;
}

@UseGuards(JwtAuthGuard)
@Controller("stores/:storeId/products")
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Param("storeId") storeId: string) {
    return this.products.list(storeId, u.sub);
  }

  @Post()
  create(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.products.create(storeId, u.sub, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(storeId, u.sub, id, dto);
  }

  @Delete(":id")
  remove(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
  ) {
    return this.products.remove(storeId, u.sub, id);
  }
}
