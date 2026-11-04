import type { Citation } from '../api/types'

/**
 * 출처 표기 (저자-연도 방식):
 *   칩      Kim 외 (2019) · 저자가 없으면 제목
 *   목록    Kim, A., & Lee, B. (2019). 제목. 발행처, pp. 4–5, 7.
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

/** 성: "Kim, J." → Kim · "A. Kim" → Kim · 한글 이름·기관명은 그대로 */
function surname(name: string): string {
  const n = name.trim()
  if (n.includes(',')) return n.split(',')[0].trim()
  const words = n.split(/\s+/)
  return words.length > 1 && /^[A-Z]\.?$|^[A-Z]\./.test(words[0]) ? words[words.length - 1] : n
}

export function shortCite(c: Citation, etAl: string): string {
  const authors = c.authors ?? []
  if (!authors.length) return c.title || c.docAlias
  const who = surname(authors[0]) + (authors.length > 1 ? ` ${etAl}` : '')
  return c.year ? `${who} (${c.year})` : who
}

function pageText(pages: string[]): string {
  if (!pages.length) return ''
  const multi = pages.length > 1 || /[–-]/.test(pages[0])
  return `${multi ? 'pp.' : 'p.'} ${pages.join(', ')}`
}

/** 목록용 한 줄 표기. 비어 있는 항목은 건너뛴다 */
export function fullCite(s: Source, etAl: string): string {
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
  return [head && `${head}.`, `${c.title || c.docAlias}.`, tail && `${tail}.`].filter(Boolean).join(' ')
}
