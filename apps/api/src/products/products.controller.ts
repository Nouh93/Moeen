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
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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
