import Link from "next/link";
import { PLANS, PlanId } from "@moeen/shared";

const FEATURES = [
  ["💵", "الدفع عند الاستلام", "عميلك يدفع كاش للمندوب عند الباب — بدون بطاقات وبدون مخاطرة. وطرق الدفع الإلكترونية قادمة عبر المحافظ اليمنية."],
  ["📍", "عناوين تفهم اليمن", "المحافظة والمديرية والوصف الحر: «بجانب مسجد الفاروق» — المندوب يوصل بدون رقم مبنى ولا رمز بريدي."],
  ["💬", "واتساب في كل خطوة", "تأكيد الطلب، خروج المندوب، التسليم — كل التحديثات تصل عميلك على واتساب تلقائياً. وأنت يصلك كل طلب جديد فوراً."],
  ["📴", "يعمل بأسوأ إنترنت", "المتجر يفتح على 2G، والطلب الذي يعلق عند انقطاع النت يُرسَل تلقائياً عند عودته — لا طلب يضيع."],
  ["🚚", "شحن على طريقتك", "مندوبك الخاص أو شركات التوصيل، سعر مختلف لكل محافظة، وتوصيل مجاني فوق المبلغ الذي تحدده."],
  ["🎟️", "كوبونات للمسوّقات", "كود لكل مسوّقة على إنستجرام وواتساب — وتتبّع مبيعات كل كود من لوحتك."],
] as const;

const STEPS = [
  ["سجّل برقم جوالك", "رمز تحقق واحد على واتساب — بدون بريد إلكتروني وبدون بطاقة"],
  ["أضف منتجاتك", "صوّرها بجوالك وارفعها — الأسعار بالريال اليمني أو السعودي أو الدولار"],
  ["شارك رابط متجرك", "في حالة الواتساب وبايو إنستجرام — واستقبل الطلبات منظمة بدل فوضى الرسائل"],
] as const;

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* الرأس */}
      <header className="brand-header text-white sticky top-0 z-30 shadow-lg shadow-brand-950/20">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-extrabold">
            <span className="bg-white/15 rounded-xl w-9 h-9 flex items-center justify-center">مُ</span>
            مُعين
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-brand-100">
            <a href="#features" className="hover:text-white">المزايا</a>
            <a href="#how" className="hover:text-white">كيف يعمل؟</a>
            <a href="#plans" className="hover:text-white">الباقات</a>
          </nav>
          <Link
            href="/dashboard"
            className="bg-white text-brand-800 px-5 py-2 rounded-xl font-bold hover:bg-brand-50 shadow"
          >
            دخول التاجر
          </Link>
        </div>
      </header>

      {/* البطل */}
      <section className="brand-header text-white">
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 text-sm text-brand-100">
            🇾🇪 منصة يمنية، مبنية لواقع اليمن
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-extrabold leading-tight">
            متجرك الإلكتروني جاهز
            <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-l from-amber-300 to-amber-100">
              خلال ثلاث دقائق
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-brand-100 max-w-2xl mx-auto leading-relaxed">
            حوّل صفحتك في إنستجرام وقروبات الواتساب إلى متجر منظم: طلبات مرتبة،
            مخزون مضبوط، توصيل لكل المحافظات — والدفع كاش عند الاستلام.
          </p>
          <div className="mt-9 flex flex-wrap gap-3 justify-center">
            <Link
              href="/dashboard"
              className="bg-amber-400 text-brand-950 px-9 py-4 rounded-2xl text-lg font-extrabold hover:bg-amber-300 shadow-xl shadow-amber-500/20"
            >
              أنشئ متجرك مجاناً ←
            </Link>
            <Link
              href="/s/alafia"
              className="bg-white/10 border border-white/20 px-9 py-4 rounded-2xl text-lg font-bold hover:bg-white/20"
            >
              شاهد متجراً حقيقياً
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-brand-100">
            <span>✓ بدون بطاقة ائتمانية</span>
            <span>✓ بدون عمولة على مبيعاتك</span>
            <span>✓ باقة مجانية دائمة</span>
          </div>
        </div>
      </section>

      {/* المزايا */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-16 w-full">
        <h2 className="text-3xl font-extrabold text-center">
          مبني <span className="text-brand-600">لليمن</span>، وليس مترجماً له
        </h2>
        <p className="text-center text-gray-500 mt-2 max-w-xl mx-auto">
          كل ميزة صُممت من واقع السوق اليمني — الكهرباء تنقطع، العناوين وصفية، والواتساب هو كل شيء.
        </p>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="card p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-2xl">
                {icon}
              </div>
              <div className="font-bold text-lg mt-3">{title}</div>
              <div className="text-sm text-gray-600 mt-1.5 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* كيف يعمل */}
      <section id="how" className="bg-white border-y">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-extrabold text-center">ثلاث خطوات وتبدأ البيع</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {STEPS.map(([title, desc], i) => (
              <div key={title} className="relative text-center px-4">
                <div className="mx-auto w-14 h-14 rounded-2xl brand-header text-white flex items-center justify-center text-2xl font-extrabold shadow-lg">
                  {i + 1}
                </div>
                <div className="font-bold text-lg mt-4">{title}</div>
                <div className="text-sm text-gray-600 mt-1.5 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* الباقات */}
      <section id="plans" className="max-w-6xl mx-auto px-4 py-16 w-full">
        <h2 className="text-3xl font-extrabold text-center">باقات على قد اليد</h2>
        <p className="text-center text-gray-500 mt-2">
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
                  highlight ? "border-2 border-brand-500 ring-4 ring-brand-100 relative" : ""
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 right-6 bg-brand-600 text-white text-xs font-bold rounded-full px-3 py-1">
                    الأكثر اختياراً ⭐
                  </span>
                )}
                <div className="font-bold text-xl">{plan.nameAr}</div>
                <div className="mt-3">
                  <span className="text-4xl font-extrabold text-brand-700">
                    {plan.monthlyPrice === 0 ? "مجاناً" : plan.monthlyPrice.toLocaleString("ar-YE")}
                  </span>
                  {plan.monthlyPrice > 0 && <span className="text-gray-500 text-sm"> ريال / شهر</span>}
                </div>
                <ul className="mt-5 space-y-2.5 text-sm text-gray-700 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brand-600 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={`mt-6 text-center rounded-xl py-3 font-bold ${
                    highlight
                      ? "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/20"
                      : "border-2 border-gray-200 hover:border-brand-500 hover:text-brand-700"
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
      <section className="brand-header text-white">
        <div className="max-w-6xl mx-auto px-4 py-14 text-center">
          <h2 className="text-3xl font-extrabold">جاهز تنظّم تجارتك؟</h2>
          <p className="text-brand-100 mt-2">أول متجر لك على بعد ثلاث دقائق — ومجاناً.</p>
          <Link
            href="/dashboard"
            className="inline-block mt-6 bg-amber-400 text-brand-950 px-10 py-4 rounded-2xl text-lg font-extrabold hover:bg-amber-300 shadow-xl shadow-amber-500/20"
          >
            أنشئ متجرك الآن
          </Link>
        </div>
      </section>

      <footer className="bg-brand-950 text-brand-200 py-8 text-center text-sm">
        <div className="font-bold text-white text-lg mb-1">مُعين 🇾🇪</div>
        منصة المتاجر اليمنية — الدفع عند الاستلام · واتساب · توصيل لكل المحافظات
      </footer>
    </main>
  );
}
