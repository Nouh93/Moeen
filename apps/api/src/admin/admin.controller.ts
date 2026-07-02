import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { AdminService } from "./admin.service.js";

class BadgesDto {
  @IsOptional() @IsBoolean() trusted?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
}

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN", "STAFF")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("stats")
  stats() {
    return this.admin.stats();
  }

  @Get("merchants")
  merchants(@Query("page") page?: string, @Query("perPage") perPage?: string) {
    return this.admin.listMerchants(page, perPage);
  }

  @Get("exceptions")
  exceptions() {
    return this.admin.exceptions();
  }

  @Post("merchants/:id/verify")
  verify(@Param("id") id: string) {
    return this.admin.setStatus(id, "ACTIVE");
  }

  @Post("merchants/:id/suspend")
  suspend(@Param("id") id: string) {
    return this.admin.setStatus(id, "SUSPENDED");
  }

  @Post("merchants/:id/close")
  close(@Param("id") id: string) {
    return this.admin.setStatus(id, "CLOSED");
  }

  @Post("merchants/:id/badges")
  badges(@Param("id") id: string, @Body() dto: BadgesDto) {
    return this.admin.setBadges(id, dto);
  }
}
