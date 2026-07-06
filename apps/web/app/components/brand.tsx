/**
 * هوية مُعين البصرية — القمرية اليمنية.
 * القمرية: نافذة الزجاج الملون فوق أبواب البيوت الصنعانية — ضوء دافئ
 * يدخل البيت. مُعين يفعل الشيء نفسه لتجارة اليمني: يفتح له نافذة.
 */

export function QamariyaMark({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="شعار مُعين"
    >
      {/* الإطار الجصي */}
      <path
        d="M8 52 V38 a24 24 0 0 1 48 0 V52 Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M8 52 V38 a24 24 0 0 1 48 0 V52"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* ألواح الزجاج الملون */}
      <path d="M32 17.5 a20.5 20.5 0 0 0 -14 5.8 L32 37.5 Z" fill="#E2A13D" />
      <path d="M32 17.5 a20.5 20.5 0 0 1 14 5.8 L32 37.5 Z" fill="#D96C57" />
      <path d="M18 23.3 a20.5 20.5 0 0 0 -6.4 14.4 h13.9 Z" fill="#4FA3A5" opacity="0.95" />
      <path d="M46 23.3 a20.5 20.5 0 0 1 6.4 14.4 H38.5 Z" fill="#7C6BB0" opacity="0.95" />
      {/* قاعدة الألواح */}
      <rect x="11.5" y="37.5" width="41" height="8.5" rx="1.5" fill="#E2A13D" opacity="0.85" />
      {/* المفاصل الجصية */}
      <path
        d="M32 17.5 V46 M18 23.3 L32 37.6 M46 23.3 L32 37.6 M11.5 37.6 H52.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* العتبة */}
      <path d="M6 52 H58" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({
  light = false,
  size = 38,
}: {
  light?: boolean;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <QamariyaMark
        size={size}
        className={light ? "text-white" : "text-brand-900"}
      />
      <span
        className={`font-heading font-bold leading-none ${light ? "text-white" : "text-brand-900"}`}
        style={{ fontSize: size * 0.62 }}
      >
        مُعين
      </span>
    </span>
  );
}
