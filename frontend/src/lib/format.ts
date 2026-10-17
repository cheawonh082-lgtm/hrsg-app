import type { Locale } from '../store/ui'

const TAG: Record<Locale, string> = { ko: 'ko-KR', en: 'en-US' }

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(TAG[locale], options).format(value)
}

/** 큰 금액 축약 표기(R-5): 2,876,000,000 → "28.8억 원" / "2.9B KRW" */
export function formatKrwCompact(value: number, locale: Locale) {
  const n = formatNumber(value, locale, { notation: 'compact', maximumFractionDigits: 1 })
  return locale === 'ko' ? `${n} 원` : `${n} KRW`
}

export function formatKrwFull(value: number, locale: Locale) {
  const n = formatNumber(Math.round(value), locale)
  return locale === 'ko' ? `${n} 원` : `${n} KRW`
}
