import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service.js";

export interface JwtPayload {
  sub: string; // userId
  phone: string;
  role: UserRole;
}

export interface AuthResult {
  accessToken: string;
  user: { id: string; phone: string; fullName: string; role: UserRole };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /** ينشئ مستخدماً جديداً. الجوال هو المُعرّف الفريد. */
  async register(input: {
    phone: string;
    password: string;
    fullName: string;
    role?: UserRole;
  }): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) throw new ConflictException("رقم الجوال مسجّل مسبقاً");

    const user = await this.prisma.user.create({
      data: {
        phone: input.phone,
        passwordHash: await AuthService.hash(input.password),
        fullName: input.fullName,
        role: input.role ?? "CUSTOMER",
      },
    });
    return this.buildResult(user.id, user.phone, user.fullName, user.role);
  }

  /**
   * إنشاء أول حساب مشرف (SUPER_ADMIN). يعمل مرة واحدة فقط: إن وُجد مشرف بالفعل
   * يُرفض. آمن للتشغيل الأولي بلا أسرار خاصة.
   */
  async bootstrapAdmin(input: {
    phone: string;
    password: string;
    fullName: string;
  }): Promise<AuthResult> {
    const adminCount = await this.prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    if (adminCount > 0) {
      throw new ConflictException("يوجد مشرف بالفعل — أنشئ مشرفين إضافيين من لوحة الإدارة");
    }
    return this.register({ ...input, role: "SUPER_ADMIN" });
  }

  async login(phone: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.passwordHash) throw new UnauthorizedException("بيانات الدخول غير صحيحة");
    if (!user.isActive) throw new UnauthorizedException("الحساب موقوف");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("بيانات الدخول غير صحيحة");

    return this.buildResult(user.id, user.phone, user.fullName, user.role);
  }

  verify(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token);
  }

  /** يُصدر توكناً لمستخدم موجود (يُستخدم بعد onboarding التاجر مثلاً). */
  issue(user: { id: string; phone: string; fullName: string; role: UserRole }): AuthResult {
    return this.buildResult(user.id, user.phone, user.fullName, user.role);
  }

  private buildResult(id: string, phone: string, fullName: string, role: UserRole): AuthResult {
    const payload: JwtPayload = { sub: id, phone, role };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id, phone, fullName, role },
    };
  }
}
