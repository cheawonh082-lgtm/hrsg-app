import type { ThresholdBand } from '../api/types'

/** 임계값(설계 대비 증가율/증가량)을 지표의 절대값으로 변환 */
export function absoluteBand(baseline: number, band: ThresholdBand) {
  if (band.basis === 'pct_increase') {
    return { caution: baseline * (1 + band.caution / 100), danger: baseline * (1 + band.danger / 100) }
  }
  return { caution: baseline + band.caution, danger: baseline + band.danger }
}

export function niceCeil(x: number, step = 5) {
  return Math.ceil(x / step) * step
}

export function niceFloor(x: number, step = 5) {
  return Math.floor(x / step) * step
}

export function clamp(x: number, min: number, max: number) {
  return Math.min(max, Math.max(min, x))
}
