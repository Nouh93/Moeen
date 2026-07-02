/**
 * محافظات اليمن الـ22 (وفق الملحق المنقّح من الـPRD — بلا "القضاء").
 * تُستخدم للتحقّق من صحة العناوين وبيانات التجار.
 */
export const YEMEN_GOVERNORATES = [
  "أمانة العاصمة",
  "صنعاء",
  "عدن",
  "تعز",
  "الحديدة",
  "إب",
  "ذمار",
  "حضرموت",
  "حجة",
  "البيضاء",
  "لحج",
  "أبين",
  "الضالع",
  "شبوة",
  "المهرة",
  "مأرب",
  "الجوف",
  "صعدة",
  "عمران",
  "المحويت",
  "ريمة",
  "سقطرى",
] as const;

export type YemenGovernorate = (typeof YEMEN_GOVERNORATES)[number];

export function isYemenGovernorate(value: string): value is YemenGovernorate {
  return (YEMEN_GOVERNORATES as readonly string[]).includes(value);
}
