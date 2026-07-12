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
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
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

class ImportProductsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  products: CreateProductDto[];
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

  // استيراد منتجات دفعة واحدة من CSV (القسم 5.6) — كل صف يمر بتحققات الإنشاء نفسها
  @Post("import")
  async import(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Body() dto: ImportProductsDto,
  ) {
    const results = { created: 0, skipped: [] as { name: string; reason: string }[] };
    for (const row of dto.products.slice(0, 500)) {
      try {
        await this.products.create(storeId, u.sub, row);
        results.created += 1;
      } catch (e: any) {
        const msg = Array.isArray(e?.response?.message)
          ? e.response.message[0]
          : (e.message ?? "خطأ");
        results.skipped.push({ name: row.name ?? "بلا اسم", reason: msg });
      }
    }
    return results;
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
