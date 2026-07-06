import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AuthUser, CurrentUser } from "../auth/jwt.guard";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

class SetStoreStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED", "CLOSED"])
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";

  @IsOptional()
  @IsString()
  reason?: string;
}

class ReviewKycDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

class ResolveExceptionDto {
  @IsIn(["CREDIT_WALLET", "IGNORE"])
  action: "CREDIT_WALLET" | "IGNORE";

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class ResolveDisputeDto {
  @IsBoolean()
  resolve: boolean;

  @IsString()
  @IsNotEmpty()
  resolution: string;
}

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("stores")
  stores(@Query("q") q?: string, @Query("page") page?: string) {
    return this.admin.stores(q, page ? Number(page) : 1);
  }

  @Patch("stores/:id/status")
  setStoreStatus(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() dto: SetStoreStatusDto,
  ) {
    return this.admin.setStoreStatus(id, dto.status, dto.reason, u.sub);
  }

  @Get("kyc")
  kyc(@Query("status") status?: "PENDING" | "APPROVED" | "REJECTED") {
    return this.admin.kycQueue(status ?? "PENDING");
  }

  @Patch("kyc/:id")
  reviewKyc(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.admin.reviewKyc(id, dto.approve, dto.adminNote, u.sub);
  }

  @Get("exceptions")
  exceptions() {
    return this.admin.exceptions();
  }

  @Patch("exceptions/:id")
  resolveException(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() dto: ResolveExceptionDto,
  ) {
    return this.admin.resolveException(id, dto.action, dto.storeId, dto.note, u.sub);
  }

  @Get("disputes")
  disputes(@Query("status") status?: "OPEN" | "RESOLVED" | "REJECTED") {
    return this.admin.disputes(status ?? "OPEN");
  }

  @Patch("disputes/:id")
  resolveDispute(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.admin.resolveDispute(id, dto.resolve, dto.resolution, u.sub);
  }

  @Get("reviews/reported")
  reportedReviews() {
    return this.admin.reportedReviews();
  }

  @Patch("reviews/:id/status")
  setReviewStatus(
    @Param("id") id: string,
    @Body() dto: { status: "VISIBLE" | "HIDDEN" },
  ) {
    return this.admin.setReviewStatus(id, dto.status === "HIDDEN" ? "HIDDEN" : "VISIBLE");
  }
}
