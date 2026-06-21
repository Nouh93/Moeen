import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class OrderItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  // المبالغ بالوحدة الصغرى (ريال) كأعداد صحيحة.
  @IsInt()
  @Min(1)
  unitPriceMinor!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class AddressDto {
  @IsString() @MinLength(1) governorate!: string;
  @IsString() @MinLength(1) district!: string;
  @IsString() @MinLength(1) area!: string;
  @IsString() @MinLength(1) landmark!: string; // أقرب معلَم — جوهري يمنياً
  @IsString() @MinLength(1) phone!: string;
  @IsOptional() @IsString() notes?: string;
}

export class PlaceOrderDto {
  @IsUUID()
  storeId!: string;

  @IsUUID()
  customerId!: string;

  @IsIn(["COD", "ONLINE"])
  paymentMethod!: "COD" | "ONLINE";

  @IsInt()
  @Min(0)
  shippingMinor!: number;

  /** افتراضياً يُؤخذ من إعداد المتجر؛ يمكن تجاوزه للطلب. */
  @IsOptional()
  merchantPaysShipping?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  /** عنوان التوصيل (نظام العناوين اليمني). اختياري للطلبات اليدوية/الاختبار. */
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
