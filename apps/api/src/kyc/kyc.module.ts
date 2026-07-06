import { Module } from "@nestjs/common";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { PrismaService } from "../prisma/prisma.service";
import { StoresModule } from "../stores/stores.module";
import { StoresService } from "../stores/stores.service";

class SubmitKycDto {
  @IsIn([1, 2])
  level: 1 | 2;

  @IsString()
  @IsNotEmpty({ message: "صورة الهوية مطلوبة" })
  idImageUrl: string;

  @IsOptional()
  @IsString()
  selfieUrl?: string;

  @IsOptional()
  @IsString()
  proofUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

/** توثيق التاجر — جانب التاجر (القسم 4.3): يرفع مستنداته وتراجعها الإدارة خلال 24 ساعة */
@UseGuards(JwtAuthGuard)
@Controller("stores/:storeId/kyc")
class KycController {
  constructor(
    private prisma: PrismaService,
    private stores: StoresService,
  ) {}

  @Get()
  async status(@CurrentUser() u: AuthUser, @Param("storeId") storeId: string) {
    const store = await this.stores.ownedByOrThrow(storeId, u.sub);
    const latest = await this.prisma.kycSubmission.findFirst({
      where: { storeId },
      orderBy: { createdAt: "desc" },
    });
    return { kycLevel: store.kycLevel, latest };
  }

  @Post()
  async submit(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Body() dto: SubmitKycDto,
  ) {
    const store = await this.stores.ownedByOrThrow(storeId, u.sub);
    if (store.kycLevel >= dto.level) {
      throw new BadRequestException("متجرك موثّق بهذا المستوى بالفعل ✓");
    }
    if (dto.level === 2 && !dto.proofUrl) {
      throw new BadRequestException(
        "المستوى الثاني يتطلب سجلاً تجارياً أو إثبات نشاط (صور المحل/المخزن)",
      );
    }
    const pending = await this.prisma.kycSubmission.findFirst({
      where: { storeId, status: "PENDING" },
    });
    if (pending) {
      throw new BadRequestException(
        "لديك طلب توثيق قيد المراجعة — نراجعه خلال 24 ساعة كحد أقصى",
      );
    }
    return this.prisma.kycSubmission.create({
      data: { storeId, ...dto },
    });
  }
}

@Module({
  imports: [StoresModule],
  controllers: [KycController],
})
export class KycModule {}
