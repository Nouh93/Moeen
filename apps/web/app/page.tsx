import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-brand-700">مُعين 🇾🇪</div>
          <Link
            href="/dashboard"
            className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700"
          >
            دخول التاجر
          </Link>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            متجرك الإلكتروني جاهز
            <span className="text-brand-600"> خلال دقائق</span>
          </h1>
          <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto">
            منصة يمنية تفهم واقعنا: الدفع عند الاستلام، عناوين بالوصف لا
            بالأرقام، إشعارات واتساب، وتعمل حتى مع أضعف إنترنت.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              href="/dashboard"
              className="bg-brand-600 text-white px-8 py-3 rounded-xl text-lg font-bold hover:bg-brand-700"
            >
              أنشئ متجرك مجاناً
            </Link>
            <Link
              href="/s/alafia"
              className="bg-white border border-gray-300 px-8 py-3 rounded-xl text-lg font-semibold hover:bg-gray-100"
            >
              شاهد متجراً تجريبياً
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-right">
            {[
              ["💵", "الدفع عند الاستلام", "عميلك يدفع كاش للمندوب — بدون بطاقات وبدون مخاطرة"],
              ["📍", "عناوين يمنية", "المحافظة والمديرية والوصف الحر — المندوب يوصل بدون رقم مبنى"],
              ["📱", "كل شيء من جوالك", "أنشئ المتجر وأدر الطلبات من المتصفح — بدون حاسوب"],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-white rounded-xl border p-5">
                <div className="text-3xl">{icon}</div>
                <div className="font-bold mt-2">{title}</div>
                <div className="text-sm text-gray-600 mt-1">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t bg-white py-6 text-center text-sm text-gray-500">
        مُعين — منصة المتاجر اليمنية · تتبّع طلبك من رابط رسالة الواتساب
      </footer>
    </main>
  );
}
