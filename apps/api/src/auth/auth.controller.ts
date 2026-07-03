import { Body, Controller, Post } from "@nestjs/common";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AuthService } from "./auth.service";

class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}

class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  name?: string;
}

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("otp/request")
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Post("otp/verify")
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code, dto.name);
  }
}
