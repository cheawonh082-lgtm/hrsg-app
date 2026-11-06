import type { Locale } from '../store/ui'

const TAG: Record<Locale, string> = { ko: 'ko-KR', en: 'en-US' }

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(TAG[locale], options).format(value)
}

/**
 * 큰 금액 축약 표기. ko는 키트 formatKrw와 같다: 1억 이상 「22.68억 원」(소수 둘째 자리 반올림), 그 아래 「3204만 원」.
 * en: 2,268,000,000 → "2.27B KRW"
 */
export function formatKrwCompact(value: number, locale: Locale) {
  if (locale === 'en') return `${formatNumber(value, locale, { notation: 'compact', maximumFractionDigits: 2 })} KRW`
  const sign = value < 0 ? '-' : ''
  const a = Math.abs(value)
  if (a >= 1e8) return `${sign}${Math.floor((a / 1e8) * 100 + 0.5) / 100}억 원`
  return `${sign}${Math.floor(a / 1e4 + 0.5)}만 원`
}

export function formatKrwFull(value: number, locale: Locale) {
  const n = formatNumber(Math.round(value), locale)
  return locale === 'ko' ? `${n} 원` : `${n} KRW`
}
