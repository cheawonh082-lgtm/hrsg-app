import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { type ReactNode, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useBreakpoint } from '../../hooks/useBreakpoint'
import { cn } from '../../lib/cn'
import { ScrollContainer } from './ScrollContainer'

export interface ResponsiveColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** 지정하면 정렬 가능 */
  sortValue?: (row: T) => number | string | null
  /** 카드(모바일)에서의 표시 위치 */
  mobile: 'title' | 'field' | 'hidden'
  align?: 'left' | 'right'
}

type SortState = { key: string; dir: 'asc' | 'desc' }

interface ResponsiveTableProps<T> {
  rows: T[]
  columns: ResponsiveColumn<T>[]
  rowKey: (row: T) => string
  caption: string
  defaultSort?: SortState
  rowClassName?: (row: T) => string | undefined
}

/** 컬럼 정의 하나로 md 이상은 정렬 가능한 표, 미만은 카드 리스트 (PRD §3.4.4) */
export function ResponsiveTable<T>({ rows, columns, rowKey, caption, defaultSort, rowClassName }: ResponsiveTableProps<T>) {
  const { t } = useTranslation()
  const { atLeast } = useBreakpoint()
  const [sort, setSort] = useState<SortState | undefined>(defaultSort)
  const sortSelectId = useId()

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key)
    if (!sort || !column?.sortValue) return rows
    const value = column.sortValue
    return [...rows].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      if (va == null) return 1 // 값 없음은 항상 뒤로
      if (vb == null) return -1
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, columns, sort])

  const sortable = columns.filter((c) => c.sortValue)

  if (!atLeast('md')) {
    const title = columns.find((c) => c.mobile === 'title')
    const fields = columns.filter((c) => c.mobile === 'field')
    return (
      <div className="space-y-3">
        {sortable.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor={sortSelectId} className="shrink-0 text-sm text-muted">
              {t('table.sortBy')}
            </label>
            <select
              id={sortSelectId}
              value={sort ? `${sort.key}:${sort.dir}` : ''}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':') as [string, SortState['dir']]
                setSort({ key, dir })
              }}
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3"
            >
              {sortable.flatMap((c) => [
                <option key={`${c.key}:desc`} value={`${c.key}:desc`}>
                  {c.header} — {t('table.desc')}
                </option>,
                <option key={`${c.key}:asc`} value={`${c.key}:asc`}>
                  {c.header} — {t('table.asc')}
                </option>,
              ])}
            </select>
          </div>
        )}
        <ul aria-label={caption} className="space-y-3">
          {sorted.map((row) => (
            <li key={rowKey(row)} className={cn('rounded-xl border border-border p-4', rowClassName?.(row))}>
              {title && <div className="mb-3 font-semibold">{title.render(row)}</div>}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {fields.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-muted">{c.header}</dt>
                    <dd className="font-medium tabular-nums">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <ScrollContainer label={caption}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-muted">
            {columns.map((c, i) => {
              const active = sort?.key === c.key
              const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
              const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    'px-3 py-2 font-medium whitespace-nowrap',
                    c.align === 'right' ? 'text-right' : 'text-left',
                    i === 0 && 'sticky left-0 bg-surface',
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort({ key: c.key, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })
                      }
                      className={cn(
                        'inline-flex min-h-11 items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-accent',
                        c.align === 'right' && 'flex-row-reverse',
                        active && 'text-text',
                      )}
                    >
                      {c.header}
                      <Icon aria-hidden className="size-3.5" />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className={cn('border-b border-border last:border-0', rowClassName?.(row))}>
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-3 py-3 tabular-nums',
                    c.align === 'right' ? 'text-right' : 'text-left',
                    i === 0 && 'sticky left-0 bg-surface',
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollContainer>
  )
}
