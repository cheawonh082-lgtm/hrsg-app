/** 히어로 배너의 HRSG 설비 실루엣 (장식용 — 가스터빈 → 덕트 → HRSG 본체 → 굴뚝) */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 160" aria-hidden className={className} fill="none">
      <defs>
        <linearGradient id="hero-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#bcd3f5" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="hero-steam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* 굴뚝 + 증기 */}
      <path d="M262 4c-10 8 8 14-2 24" stroke="url(#hero-steam)" strokeWidth="10" strokeLinecap="round" />
      <rect x="250" y="26" width="26" height="124" rx="3" fill="url(#hero-metal)" />
      <rect x="250" y="40" width="26" height="4" fill="#2563eb" opacity="0.25" />
      <rect x="250" y="52" width="26" height="4" fill="#2563eb" opacity="0.25" />
      {/* HRSG 본체 */}
      <rect x="150" y="56" width="100" height="94" rx="4" fill="url(#hero-metal)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={160 + i * 18} y="66" width="8" height="74" rx="2" fill="#2563eb" opacity="0.18" />
      ))}
      {/* 드럼 */}
      <rect x="168" y="38" width="64" height="14" rx="7" fill="url(#hero-metal)" />
      <path d="M180 52v4M220 52v4" stroke="#ffffff" strokeWidth="3" />
      {/* 덕트 + 가스터빈 */}
      <path d="M96 104h54v46H96z" fill="url(#hero-metal)" opacity="0.85" />
      <rect x="20" y="108" width="80" height="42" rx="6" fill="url(#hero-metal)" />
      <circle cx="44" cy="129" r="9" fill="#2563eb" opacity="0.2" />
      {/* 배관 */}
      <path d="M232 45h40v-14" stroke="#ffffff" strokeWidth="4" opacity="0.8" strokeLinecap="round" />
      <path d="M0 150h320" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
    </svg>
  )
}
