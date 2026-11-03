import { Fragment, type ReactNode } from 'react'

/**
 * 챗 답변용 마크다운 — LLM 프롬프트가 쓰는 범위만: 소제목(#~###), 문단, 굵게(**), 목록(-, 1.), 표, 구분선(---).
 * HTML을 해석하지 않고 React 요소만 만든다(원문에 태그가 있어도 글자로 보인다).
 * 출처 번호 [1], [1,3]은 renderCite로 넘겨 출처 칩으로 그린다.
 */
const CITE = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/
const INLINE = new RegExp(`(\\*\\*[^*]+?\\*\\*|${CITE.source})`, 'g')

type RenderCite = (nums: number[], key: string) => ReactNode

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'hr' }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }

const LIST_ITEM = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

export function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r/g, '').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', text: para.join('\n') })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (!line.trim()) {
      flush()
    } else if (heading) {
      flush()
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
    } else if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush()
      blocks.push({ kind: 'hr' })
    } else if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      flush()
      const head = cells(line)
      const rows: string[][] = []
      for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]))
      i--
      blocks.push({ kind: 'table', head, rows })
    } else if (LIST_ITEM.test(line)) {
      flush()
      const ordered = Boolean(LIST_ITEM.exec(line)![1])
      const items: string[] = []
      for (; i < lines.length; i++) {
        const m = LIST_ITEM.exec(lines[i])
        if (m && Boolean(m[1]) === ordered) items.push(m[2])
        else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length) items[items.length - 1] += ' ' + lines[i].trim()
        else break
      }
      i--
      blocks.push({ kind: 'list', ordered, items })
    } else {
      para.push(line)
    }
  }
  flush()
  return blocks
}

function Inline({ text, renderCite, k }: { text: string; renderCite: RenderCite; k: string }) {
  const out: ReactNode[] = []
  text.split(INLINE).forEach((part, i) => {
    if (!part || /^\d{1,2}(?:\s*,\s*\d{1,2})*$/.test(part)) return // split이 남기는 캡처 그룹(번호만)은 건너뜀
    const key = `${k}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      out.push(<strong key={key} className="font-semibold text-text">{part.slice(2, -2)}</strong>)
    } else if (CITE.test(part) && CITE.exec(part)![0] === part) {
      out.push(renderCite(part.slice(1, -1).split(',').map((n) => Number(n.trim())), key))
    } else {
      out.push(<Fragment key={key}>{part}</Fragment>)
    }
  })
  return <>{out}</>
}

export function Markdown({ text, renderCite }: { text: string; renderCite: RenderCite }) {
  return (
    <div className="space-y-3 leading-relaxed break-words">
      {parseBlocks(text).map((b, i) => {
        const k = `b${i}`
        switch (b.kind) {
          case 'heading':
            return b.level === 1 ? (
              <h3 key={k} className="pt-2 text-lg font-bold">
                <Inline text={b.text} renderCite={renderCite} k={k} />
              </h3>
            ) : (
              <h4 key={k} className={b.level === 2 ? 'pt-2 text-base font-bold' : 'pt-1 font-semibold'}>
                <Inline text={b.text} renderCite={renderCite} k={k} />
              </h4>
            )
          case 'hr':
            return <hr key={k} className="border-border" />
          case 'paragraph':
            return (
              <p key={k} className="whitespace-pre-line">
                <Inline text={b.text} renderCite={renderCite} k={k} />
              </p>
            )
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul'
            return (
              <Tag key={k} className={`space-y-1.5 pl-5 ${b.ordered ? 'list-decimal' : 'list-disc'} marker:text-muted`}>
                {b.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    <Inline text={item} renderCite={renderCite} k={`${k}-${j}`} />
                  </li>
                ))}
              </Tag>
            )
          }
          case 'table':
            return (
              <div key={k} className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-surface-2">
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} scope="col" className="border-b border-border px-3 py-2 text-left font-semibold whitespace-nowrap">
                          <Inline text={h} renderCite={renderCite} k={`${k}-h${j}`} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r} className="border-b border-border last:border-0">
                        {b.head.map((_, j) => (
                          <td key={j} className="px-3 py-2 align-top">
                            <Inline text={row[j] ?? ''} renderCite={renderCite} k={`${k}-${r}-${j}`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      })}
    </div>
  )
}
