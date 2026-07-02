/** هل الطوابير مُفعّلة؟ تتطلّب Redis. تُعطَّل تلقائياً إن لم يُضبَط REDIS_URL. */
export function queueEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

/** إعداد اتصال Redis لـ BullMQ من REDIS_URL. */
export function redisConnection(): { host: string; port: number } {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return { host: url.hostname, port: Number(url.port || 6379) };
}

export const PAYMENTS_QUEUE = "payments";
