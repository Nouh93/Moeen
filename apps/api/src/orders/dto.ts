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
}
