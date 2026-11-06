export function niceCeil(x: number, step = 5) {
  return Math.ceil(x / step) * step
}

export function niceFloor(x: number, step = 5) {
  return Math.floor(x / step) * step
}

export function clamp(x: number, min: number, max: number) {
  return Math.min(max, Math.max(min, x))
}
