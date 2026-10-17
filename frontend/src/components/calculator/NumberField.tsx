import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { FieldError } from '../../lib/calcValidation'
import { clamp } from '../../lib/thresholds'
import { cn } from '../../lib/cn'

interface NumberFieldProps {
  label: string
  unit: string
  value: number | null | undefined
  onChange: (value: number | null) => void
  slider: { min: number; max: number; step: number }
  error?: FieldError
  /** 비워 둘 수 있는 항목이면 지우기 버튼 표시 */
  nullable?: boolean
}

const toText = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '' : String(v))

function parse(text: string): number | null {
  const t = text.trim().replace(',', '.')
  return t === '' ? null : Number(t) // 숫자가 아니면 NaN → 검증에서 'invalid'
}

/** 슬라이더 + 숫자 입력 병행. 숫자 칸은 입력 도중 상태("12.")를 그대로 보존한다. */
export function NumberField({ label, unit, value, onChange, slider, error, nullable }: NumberFieldProps) {
  const { t } = useTranslation()
  const id = useId()
  const errorId = `${id}-error`
  const [text, setText] = useState(toText(value))
  const emitted = useRef(value)

  // 외부에서 값이 바뀐 경우(기본값 복원, 슬라이더 등)에만 입력 칸 갱신
  useEffect(() => {
    if (!Object.is(value, emitted.current)) {
      emitted.current = value
      setText(toText(value))
    }
  }, [value])

  const emit = (v: number | null) => {
    emitted.current = v
    onChange(v)
  }

  const sliderValue = value == null || Number.isNaN(value) ? slider.min : clamp(value, slider.min, slider.max)

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="min-w-0 text-sm font-medium">
          {label}
        </label>
        <span className="shrink-0 text-xs text-muted">{unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label={t('calc.input.slider', { label })}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={sliderValue}
          onChange={(e) => {
            const v = Number(e.target.value)
            setText(String(v))
            emit(v)
          }}
          className={cn('range min-w-0 flex-1', value == null && 'opacity-40')}
        />
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            emit(parse(e.target.value))
          }}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-11 w-24 shrink-0 rounded-lg border bg-surface px-2 text-right tabular-nums focus-visible:outline-2 focus-visible:outline-accent',
            error ? 'border-status-danger' : 'border-border',
          )}
        />
        {nullable && (
          <button
            type="button"
            onClick={() => {
              setText('')
              emit(null)
            }}
            disabled={value == null}
            aria-label={t('calc.input.clear', { label })}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-status-danger">
          {t(`calc.errors.${error.code}${error.exclusive ? 'Exclusive' : ''}`, { limit: error.limit })}
        </p>
      )}
    </div>
  )
}
