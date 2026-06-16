import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService, type AuthResult, type JwtPayload } from "./auth.service.js";
import { LoginDto, RegisterDto } from "./dto.js";
import { CurrentUser } from "./current-user.decorator.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto.phone, dto.password);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }
}
