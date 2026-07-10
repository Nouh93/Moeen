import { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { QamariyaMark } from "@/app/components/brand";

/* أيقونات المنصات — lucide أزالت أيقونات العلامات التجارية، فنرسمها مضمّنة */
type IconProps = { size?: number };
const svgProps = (size: number) =>
  ({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  }) as const;

function InstagramIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TiktokIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

function XIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  );
}

/** تعتيم لون hex بنسبة — لاشتقاق درجات الرأس والأزرار من لون التاجر */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

async function getStore(slug: string) {
  try {
    return await api(`/public/stores/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

const SOCIAL_META: Record<
  string,
  { icon: (p: IconProps) => React.JSX.Element; base: string; label: string }
> = {
  instagram: { icon: InstagramIcon, base: "https://instagram.com/", label: "إنستغرام" },
  facebook: { icon: FacebookIcon, base: "https://facebook.com/", label: "فيسبوك" },
  tiktok: { icon: TiktokIcon, base: "https://tiktok.com/@", label: "تيك توك" },
  x: { icon: XIcon, base: "https://x.com/", label: "إكس" },
};

function socialHref(base: string, value: string): string {
  const v = value.trim();
  return /^https?:\/\//.test(v) ? v : `${base}${v.replace(/^@/, "")}`;
}

/**
 * غلاف واجهة المتجر (القسم 5.4): يلوّن كل صفحات المتجر بلون التاجر
 * عبر متغيرات --sf-*، ويضيف تذييلاً موحداً بصفحات المتجر وروابط تواصله.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStore(slug);

  const theme: CSSProperties | undefined = store?.themeColor
    ? ({
        "--sf-600": store.themeColor,
        "--sf-700": shade(store.themeColor, 0.82),
        "--sf-800": shade(store.themeColor, 0.52),
        "--sf-900": shade(store.themeColor, 0.4),
        "--sf-950": shade(store.themeColor, 0.28),
      } as CSSProperties)
    : undefined;

  const socials = Object.entries(SOCIAL_META).flatMap(([key, meta]) => {
    const value = store?.socialLinks?.[key];
    return value ? [{ key, value, ...meta }] : [];
  });

  return (
    <div className="storefront flex flex-col min-h-screen" style={theme}>
      <div className="flex-1">{children}</div>

      {store && (
        <footer className="mt-10 bg-[var(--sf-950)] text-white">
          <div className="frieze opacity-60" />
          <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
            {(store.aboutText || store.returnPolicy || socials.length > 0) && (
              <div className="grid md:grid-cols-2 gap-6">
                {store.aboutText && (
                  <div>
                    <h3 className="font-bold mb-2">عن {store.name}</h3>
                    <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">
                      {store.aboutText}
                    </p>
                  </div>
                )}
                <div className="space-y-4">
                  {store.returnPolicy && (
                    <details className="group">
                      <summary className="font-bold cursor-pointer list-none flex items-center gap-1.5">
                        سياسة الاستبدال والإرجاع
                        <span className="text-white/50 text-xs group-open:hidden">(اضغط للعرض)</span>
                      </summary>
                      <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed mt-2">
                        {store.returnPolicy}
                      </p>
                    </details>
                  )}
                  {socials.length > 0 && (
                    <div className="flex items-center gap-2">
                      {socials.map((s) => {
                        const Icon = s.icon;
                        return (
                          <a
                            key={s.key}
                            href={socialHref(s.base, s.value)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={s.label}
                            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                          >
                            <Icon size={16} />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap border-t border-white/10 pt-4 text-xs text-white/50">
              <span className="inline-flex items-center gap-3">
                © {new Date().getFullYear()} {store.name}
                <Link href="/my-orders" className="hover:text-white/80 underline underline-offset-2">
                  طلباتي
                </Link>
              </span>
              <Link href="/" className="inline-flex items-center gap-1.5 hover:text-white/80">
                <QamariyaMark size={16} /> متجر يعمل بمنصة مُعين
              </Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
