import { Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Body, Controller, NotFoundException, Param, Post } from "@nestjs/common";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from "class-validator";
import { Queue, Worker } from "bullmq";
import { normalizeYemeniPhone } from "@moeen/shared";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

const QUEUE = "abandoned-carts";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
    maxRetriesPerRequest: null as null,
  };
}

class CaptureCartDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsArray()
  @ArrayNotEmpty()
  items: { name: string; quantity: number }[];
}

/**
 * السلة المهجورة (القسم 9.2): عميل ملأ جواله وترك السلة →
 * رسالة واتساب واحدة فقط بعد ساعات — لا إزعاج.
 */
@Injectable()
class CartsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("AbandonedCarts");
  private queue: Queue;
  private worker: Worker;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    const connection = redisConnection();
    this.queue = new Queue(QUEUE, { connection });
    this.worker = new Worker(QUEUE, async () => this.remind(), { connection });
    // كل ساعة — يذكّر السلات المتروكة من 3 ساعات حتى 3 أيام
    await this.queue.upsertJobScheduler("hourly-reminders", { pattern: "0 * * * *" });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async capture(slug: string, rawPhone: string, items: any[]) {
    const phone = normalizeYemeniPhone(rawPhone);
    if (!phone) return { ok: false };
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store || store.status !== "ACTIVE") throw new NotFoundException();
    await this.prisma.abandonedCart.upsert({
      where: { storeId_phone: { storeId: store.id, phone } },
      create: { storeId: store.id, phone, items },
      update: { items, createdAt: new Date(), notifiedAt: null },
    });
    return { ok: true };
  }

  /** يُستدعى من إنشاء الطلب: العميل أكمل — احذف سلته المهجورة */
  clear(storeId: string, phone: string) {
    return this.prisma.abandonedCart.deleteMany({ where: { storeId, phone } });
  }

  private async remind() {
    const from = new Date(Date.now() - 3 * 86_400_000);
    const to = new Date(Date.now() - 3 * 3_600_000);
    const carts = await this.prisma.abandonedCart.findMany({
      where: { notifiedAt: null, createdAt: { gte: from, lte: to } },
      include: { store: true },
      take: 100,
    });
    for (const cart of carts) {
      const items = (cart.items as any[]) ?? [];
      const first = items[0]?.name ?? "منتجاتك";
      // الأسلوب اليمني — القسم 26.2.2
      await this.notifications.enqueue({
        storeId: cart.storeId,
        recipient: cart.phone,
        template: "ABANDONED_CART",
        body:
          `نسيت شيئاً! 😄\n` +
          `عندك منتجات في سلتك من ${cart.store.name} تنتظرك:\n` +
          `${first}${items.length > 1 ? ` و${items.length - 1} غيره` : ""}\n` +
          `أكمل طلبك من هنا: ${WEB_URL}/s/${cart.store.slug}/cart`,
      });
      await this.prisma.abandonedCart.update({
        where: { id: cart.id },
        data: { notifiedAt: new Date() },
      });
    }
    if (carts.length) this.logger.log(`ذُكّرت ${carts.length} سلة مهجورة`);
    return carts.length;
  }
}

@Controller("public/stores/:slug/abandoned-cart")
class CartsController {
  constructor(private carts: CartsService) {}

  @Post()
  capture(@Param("slug") slug: string, @Body() dto: CaptureCartDto) {
    return this.carts.capture(slug, dto.phone, dto.items);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
export { CartsService };
