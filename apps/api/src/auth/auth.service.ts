import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { normalizeYemeniPhone } from "@moeen/shared";
import { randomInt } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

const OTP_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  /**
   * طلب رمز تحقق. في الإنتاج يُرسَل عبر واتساب (وSMS احتياطاً — القسم 10.2).
   * في بيئة التطوير يُعاد الرمز في الاستجابة مباشرة.
   */
  async requestOtp(rawPhone: string) {
    const phone = normalizeYemeniPhone(rawPhone);
    if (!phone) {
      throw new BadRequestException(
        "رقم الجوال غير صحيح — أدخل رقماً يمنياً يبدأ بـ 7 (مثال: 771234567)",
      );
    }

    // حماية من الإغراق: 3 رموز حية كحد أقصى لكل رقم — القسم 18.1
    const active = await this.prisma.otpCode.count({
      where: { phone, expiresAt: { gt: new Date() }, consumedAt: null },
    });
    if (active >= 3) {
      throw new BadRequestException(
        "طلبت رموزاً كثيرة — انتظر قليلاً ثم حاول مجدداً",
      );
    }

    const code = randomInt(100000, 999999).toString();
    await this.prisma.otpCode.create({
      data: { phone, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    // TODO المرحلة 2: الإرسال عبر WhatsApp Business API (BSP) ثم SMS احتياطاً
    const dev = process.env.NODE_ENV !== "production";
    if (dev) console.log(`[OTP] ${phone} → ${code}`);
    return { phone, sent: true, ...(dev ? { devCode: code } : {}) };
  }

  async verifyOtp(rawPhone: string, code: string, name?: string) {
    const phone = normalizeYemeniPhone(rawPhone);
    if (!phone) throw new BadRequestException("رقم الجوال غير صحيح");

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, code, expiresAt: { gt: new Date() }, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) {
      throw new UnauthorizedException("الرمز غير صحيح أو انتهت صلاحيته");
    }
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone, name },
      update: name ? { name } : {},
    });

    const token = await this.jwt.signAsync({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });
    return { token, user };
  }
}
