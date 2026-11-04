import type { Citation } from '../api/types'

/**
 * 출처 표기 — 문서 제목(논문 첫 장의 제목)을 앞세운다:
 *   칩      제목
 *   목록    제목
 *           Kim, A., & Lee, B. (2019). 발행처, pp. 4–5, 7.
 * 같은 문서의 여러 문단은 한 항목으로 묶고 쪽수를 모은다.
 */

export interface Source {
  n: number // 답변의 [n] 중 이 문서가 처음 나온 번호
  c: Citation
  pages: string[]
}

/** 같은 문서(docAlias)는 한 번만 — nums를 주면 그 번호들만 (답변의 [n]은 items의 1부터 센 번호) */
export function groupSources(items: Citation[], nums?: number[]): Source[] {
  const byDoc = new Map<string, Source>()
  for (const n of nums ?? items.map((_, i) => i + 1)) {
    const c = items[n - 1]
    if (!c) continue
    const s = byDoc.get(c.docAlias) ?? { n, c, pages: [] }
    if (c.pages && !s.pages.includes(c.pages)) s.pages.push(c.pages)
    byDoc.set(c.docAlias, s)
  }
  return [...byDoc.values()]
}

/** 문서 제목. 제목이 없는 문서만 내부 ID로 */
export function sourceTitle(c: Citation): string {
  return c.title?.trim() || c.docAlias
}

function pageText(pages: string[]): string {
  if (!pages.length) return ''
  const multi = pages.length > 1 || /[–-]/.test(pages[0])
  return `${multi ? 'pp.' : 'p.'} ${pages.join(', ')}`
}

/** 제목 아래 줄: 저자 (연도). 발행처, 쪽. — 서지 정보가 없으면 빈 문자열 */
export function byline(s: Source, etAl: string): string {
  const { c } = s
  const authors = c.authors ?? []
  // 1명: A · 2명: A & B · 3명: A, B, & C · 4명 이상: A 외
  const who =
    authors.length <= 2
      ? authors.join(' & ')
      : authors.length === 3
        ? `${authors[0]}, ${authors[1]}, & ${authors[2]}`
        : `${authors[0]} ${etAl}`
  const head = [who, c.year ? `(${c.year})` : ''].filter(Boolean).join(' ')
  const tail = [c.venue, pageText(s.pages)].filter(Boolean).join(', ')
  return [head && `${head}.`, tail && `${tail}.`].filter(Boolean).join(' ')
}
