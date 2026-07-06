/**
 * التقسيم الإداري اليمني — 22 محافظة (21 محافظة + أمانة العاصمة، وتشمل سقطرى).
 * انظر القسم 23.2 من الملحق الثاني.
 *
 * ملاحظة: قوائم المديريات هنا مكتملة لمدينتَي الإطلاق (أمانة العاصمة وعدن)
 * وفق المرحلة 1 من خارطة الطريق. بقية المحافظات تُستكمل مديرياتها من المصدر
 * الرسمي المعتمد وتُراجَع قبل الإطلاق (كما تنص الوثيقة) — البنية جاهزة لذلك.
 */

export interface GovernorateData {
  code: string;
  nameAr: string;
  districts: string[];
}

export const YEMEN_GOVERNORATES: GovernorateData[] = [
  {
    code: "SAN",
    nameAr: "أمانة العاصمة",
    districts: [
      "صنعاء القديمة",
      "آزال",
      "الصافية",
      "السبعين",
      "شعوب",
      "الوحدة",
      "التحرير",
      "الثورة",
      "معين",
      "بني الحارث",
    ],
  },
  {
    code: "ADE",
    nameAr: "عدن",
    districts: [
      "صيرة (كريتر)",
      "المعلا",
      "التواهي",
      "خور مكسر",
      "الشيخ عثمان",
      "المنصورة",
      "دار سعد",
      "البريقة",
    ],
  },
  { code: "SNH", nameAr: "صنعاء", districts: [] },
  { code: "TAI", nameAr: "تعز", districts: ["المظفر", "القاهرة", "صالة", "التعزية"] },
  { code: "HOD", nameAr: "الحديدة", districts: ["الحالي", "الحوك", "الميناء"] },
  { code: "IBB", nameAr: "إب", districts: ["مدينة إب", "الظهار", "المشنة"] },
  { code: "DHA", nameAr: "ذمار", districts: ["مدينة ذمار"] },
  { code: "HAJ", nameAr: "حجة", districts: [] },
  { code: "SAD", nameAr: "صعدة", districts: [] },
  { code: "AMR", nameAr: "عمران", districts: [] },
  { code: "MAH", nameAr: "المحويت", districts: [] },
  { code: "RAY", nameAr: "ريمة", districts: [] },
  { code: "MAR", nameAr: "مأرب", districts: ["مدينة مأرب"] },
  { code: "JAW", nameAr: "الجوف", districts: [] },
  { code: "BAY", nameAr: "البيضاء", districts: [] },
  { code: "LAH", nameAr: "لحج", districts: [] },
  { code: "ABY", nameAr: "أبين", districts: [] },
  { code: "SHA", nameAr: "شبوة", districts: [] },
  { code: "HDR", nameAr: "حضرموت", districts: ["المكلا", "الشحر", "سيئون", "تريم"] },
  { code: "MHR", nameAr: "المهرة", districts: [] },
  { code: "DAL", nameAr: "الضالع", districts: [] },
  { code: "SOC", nameAr: "سقطرى", districts: [] },
];
