import { IsIn, IsNotEmpty, IsString, Matches, MinLength } from "class-validator";
import { YEMEN_GOVERNORATES } from "../common/yemen.js";

const YEMEN_PHONE = /^(\+967|0)?7\d{8}$/;

export class OnboardMerchantDto {
  @Matches(YEMEN_PHONE, { message: "رقم جوال يمني غير صحيح" })
  phone!: string;

  @IsString()
  @MinLength(6, { message: "كلمة المرور 6 أحرف على الأقل" })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: "اسم المسؤول مطلوب" })
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: "اسم النشاط التجاري مطلوب" })
  businessName!: string;

  @IsIn(YEMEN_GOVERNORATES as unknown as string[], { message: "محافظة غير صحيحة" })
  governorate!: string;
}
