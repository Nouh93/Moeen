import Link from "next/link";
import { PLANS, PlanId } from "@moeen/shared";
import { BrandLogo, QamariyaMark } from "./components/brand";

const FEATURES = [
  ["💵", "الدفع عند الاستلام", "عميلك يدفع كاش للمندوب عند الباب — بدون بطاقات وبدون مخاطرة. والمحافظ اليمنية قادمة."],
  ["📍", "عناوين تفهم اليمن", "المحافظة والمديرية والوصف الحر: «بجانب مسجد الفاروق» — المندوب يوصل بدون رقم مبنى."],
  ["💬", "واتساب في كل خطوة", "تأكيد الطلب، خروج المندوب، التسليم — كلها تصل عميلك تلقائياً، وأنت يصلك كل طلب فوراً."],
  ["📴", "يعمل بأسوأ إنترنت", "المتجر يفتح على 2G، والطلب الذي يعلق عند انقطاع النت يُرسَل تلقائياً عند عودته."],
  ["🚚", "شحن على طريقتك", "مندوبك الخاص أو شركات التوصيل، سعر لكل محافظة، وتوصيل مجاني فوق مبلغ تحدده."],
  ["🎟️", "كوبونات للمسوّقات", "كود لكل مسوّقة على إنستجرام وواتساب — وتتبّع مبيعات كل كود من لوحتك."],
] as const;

const STEPS = [
  ["سجّل برقم جوالك", "رمز تحقق واحد على واتساب — بدون بريد وبدون بطاقة"],
  ["أضف منتجاتك", "صوّرها بجوالك وارفعها — بالريال اليمني أو السعودي أو الدولار"],
  ["شارك رابط متجرك", "في حالة الواتساب وبايو إنستجرام — واستقبل الطلبات منظمة"],
] as const;

/** معاينة متجر مصغّرة داخل إطار جوال — مرسومة لا صورة */
function PhoneMockup() {
  const tiles = [
    ["🧴", "دهن عود ملكي", "١٨٬٠٠٠"],
    ["🪵", "عود كمبودي", "٢٥٬٠٠٠"],
    ["🕯️", "بخور دوسري", "٨٬٠٠٠"],
    ["🌸", "عطر الياسمين", "١٢٬٠٠٠"],
  ];
  return (
    <div className="relative mx-auto w-64 select-none" aria-hidden>
      <div className="absolute -inset-6 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="relative rounded-[2.4rem] border-[7px] border-brand-950/90 bg-[#f7f5f0] shadow-2xl shadow-brand-950/40 overflow-hidden">
        <div className="brand-header text-white px-4 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center text-sm">🏪</span>
            <div>
              <div className="text-xs font-bold">متجر العافية</div>
              <div className="text-[9px] text-brand-200">صنعاء — توصيل لكل المحافظات</div>
            </div>
            <span className="mr-auto text-[9px] bg-amber-400 text-brand-950 font-bold rounded-full px-2 py-0.5">
              🛒 ٣
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          {tiles.map(([emoji, name, price]) => (
            <div key={name} className="bg-white rounded-xl border border-brand-900/10 p-2 shadow-sm">
              <div className="arch bg-brand-50 h-14 flex items-center justify-center text-2xl">{emoji}</div>
              <div className="text-[9px] font-bold mt-1.5">{name}</div>
              <div className="text-[9px] text-brand-600 font-bold">{price} ريال</div>
            </div>
          ))}
        </div>
        <div className="mx-3 mb-3 rounded-xl bg-brand-900 text-white text-center text-[10px] font-bold py-2">
          تأكيد الطلب — الدفع عند الاستلام 💵
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* الرأس */}
      <header className="brand-header text-white sticky top-0 z-30 shadow-lg shadow-brand-950/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <BrandLogo light size={36} />
          <nav className="hidden sm:flex items-center gap-7 text-sm text-brand-200">
            <a href="#features" className="hover:text-white">المزايا</a>
            <a href="#how" className="hover:text-white">كيف يعمل؟</a>
            <a href="#plans" className="hover:text-white">الباقات</a>
          </nav>
          <Link
            href="/dashboard"
            className="bg-amber-400 text-brand-950 px-5 py-2 rounded-xl font-bold hover:bg-amber-300"
          >
            دخول التاجر
          </Link>
        </div>
      </header>

      {/* البطل */}
      <section className="brand-header text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 pt-14 pb-16 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-right">
            <div className="inline-flex items-center gap-2 bg-white/8 border border-white/15 rounded-full px-4 py-1.5 text-xs text-brand-100">
              <QamariyaMark size={16} className="text-amber-300" />
              منصة يمنية — مبنية لواقعنا، لا مترجمة عنه
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-extrabold leading-[1.2]">
              افتح لتجارتك
              <span className="block mt-1 text-amber-300">نافذة تضيء اليمن</span>
            </h1>
            <p className="mt-5 text-lg text-brand-100 leading-relaxed max-w-lg mx-auto md:mx-0">
              حوّل صفحتك في إنستجرام وقروبات الواتساب إلى متجر منظم خلال ثلاث
              دقائق: طلبات مرتبة، مخزون مضبوط، توصيل لكل المحافظات — والدفع كاش
              عند الاستلام.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center md:justify-start">
              <Link
                href="/dashboard"
                className="bg-amber-400 text-brand-950 px-8 py-3.5 rounded-xl text-lg font-bold hover:bg-amber-300 shadow-xl shadow-amber-500/25"
              >
                أنشئ متجرك مجاناً ←
              </Link>
              <Link
                href="/s/alafia"
                className="bg-white/8 border border-white/20 px-8 py-3.5 rounded-xl text-lg font-bold hover:bg-white/15"
              >
                شاهد متجراً حقيقياً
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap justify-center md:justify-start gap-x-7 gap-y-2 text-sm text-brand-200">
              <span>✓ بدون بطاقة ائتمانية</span>
              <span>✓ بدون عمولة على مبيعاتك</span>
              <span>✓ باقة مجانية دائمة</span>
            </div>
          </div>
          <div className="hidden md:block">
            <PhoneMockup />
          </div>
        </div>
      </section>
      <div className="frieze" />

      {/* المزايا */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-16 w-full">
        <h2 className="text-3xl font-extrabold text-center text-brand-950">
          مبني لليمن، <span className="text-amber-600">وليس مترجماً له</span>
        </h2>
        <p className="text-center text-gray-500 mt-3 max-w-xl mx-auto">
          كل ميزة صُممت من واقع السوق اليمني — الكهرباء تنقطع، العناوين وصفية،
          والواتساب هو كل شيء.
        </p>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="card p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 arch bg-brand-900 text-amber-300 flex items-center justify-center text-2xl">
                {icon}
              </div>
              <div className="font-heading font-bold text-lg mt-4 text-brand-950">{title}</div>
              <div className="text-sm text-gray-600 mt-1.5 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* كيف يعمل */}
      <section id="how" className="bg-brand-950 text-white relative">
        <div className="frieze absolute top-0 inset-x-0 opacity-60" />
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-extrabold text-center">ثلاث خطوات وتبدأ البيع</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            {STEPS.map(([title, desc], i) => (
              <div key={title} className="text-center px-4">
                <div className="mx-auto w-16 h-16 arch bg-amber-400 text-brand-950 flex items-center justify-center text-2xl font-heading font-extrabold shadow-lg shadow-amber-500/20">
                  {i + 1}
                </div>
                <div className="font-heading font-bold text-lg mt-4">{title}</div>
                <div className="text-sm text-brand-200 mt-1.5 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="frieze" />

      {/* الباقات */}
      <section id="plans" className="max-w-6xl mx-auto px-4 py-16 w-full">
        <h2 className="text-3xl font-extrabold text-center text-brand-950">باقات على قد اليد</h2>
        <p className="text-center text-gray-500 mt-3">
          ابدأ مجاناً وارتقِ عندما يكبر متجرك — بدون عمولة على مبيعاتك في كل الباقات.
        </p>
        <div className="mt-10 grid md:grid-cols-3 gap-4 items-stretch">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const plan = PLANS[id];
            const highlight = id === "GROWTH";
            return (
              <div
                key={id}
                className={`card p-6 flex flex-col ${
                  highlight ? "border-2 border-brand-700 ring-4 ring-brand-100 relative" : ""
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 right-6 bg-amber-400 text-brand-950 text-xs font-bold rounded-full px-3 py-1">
                    الأكثر اختياراً ⭐
                  </span>
                )}
                <div className="font-heading font-bold text-xl text-brand-950">{plan.nameAr}</div>
                <div className="mt-3">
                  <span className="font-heading text-4xl font-extrabold text-brand-800">
                    {plan.monthlyPrice === 0 ? "مجاناً" : plan.monthlyPrice.toLocaleString("ar-YE")}
                  </span>
                  {plan.monthlyPrice > 0 && <span className="text-gray-500 text-sm"> ريال / شهر</span>}
                </div>
                <ul className="mt-5 space-y-2.5 text-sm text-gray-700 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-amber-600 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={`mt-6 text-center rounded-xl py-3 font-bold ${
                    highlight
                      ? "bg-brand-900 text-white hover:bg-brand-800 shadow-lg shadow-brand-900/20"
                      : "border-2 border-brand-200 text-brand-800 hover:border-brand-700"
                  }`}
                >
                  {plan.monthlyPrice === 0 ? "ابدأ مجاناً" : `اشترك في ${plan.nameAr}`}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          السداد من أي محفظة يمنية (جوالي، ONE Cash، فلوسك، الكريمي…) أو حوالة — والتفعيل آلي فوري.
        </p>
      </section>

      {/* دعوة أخيرة */}
      <section className="brand-header text-white relative">
        <div className="max-w-6xl mx-auto px-4 py-14 text-center">
          <QamariyaMark size={56} className="text-amber-300 mx-auto" />
          <h2 className="text-3xl font-extrabold mt-4">جاهز تنظّم تجارتك؟</h2>
          <p className="text-brand-200 mt-2">أول متجر لك على بعد ثلاث دقائق — ومجاناً.</p>
          <Link
            href="/dashboard"
            className="inline-block mt-6 bg-amber-400 text-brand-950 px-10 py-4 rounded-xl text-lg font-bold hover:bg-amber-300 shadow-xl shadow-amber-500/25"
          >
            أنشئ متجرك الآن
          </Link>
        </div>
      </section>

      <footer className="bg-brand-950 text-brand-300 py-8 text-center text-sm border-t border-white/8">
        <div className="flex justify-center mb-2">
          <BrandLogo light size={30} />
        </div>
        منصة المتاجر اليمنية — الدفع عند الاستلام · واتساب · توصيل لكل المحافظات
      </footer>
    </main>
  );
}
