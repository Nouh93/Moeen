import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

// رقم جوال يمني: +967 يتبعه 9 أرقام، أو 0 محلي يتبعه 9 أرقام.
const YEMEN_PHONE = /^(\+967|0)?7\d{8}$/;

export class RegisterDto {
  @Matches(YEMEN_PHONE, { message: "رقم جوال يمني غير صحيح" })
  phone!: string;

  @IsString()
  @MinLength(6, { message: "كلمة المرور 6 أحرف على الأقل" })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: "الاسم مطلوب" })
  fullName!: string;
}

export class LoginDto {
  @Matches(YEMEN_PHONE, { message: "رقم جوال يمني غير صحيح" })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
