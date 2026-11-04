import '../../i18n'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Citation } from '../../api/types'
import { byline, groupSources, sourceTitle } from '../../lib/citation'
import { AiChip, CitationChip, CitationList } from './CitationList'
import { Markdown } from './Markdown'

const ANSWER = `**핀치 포인트를 낮추면** 증기 생산이 늘어납니다. [1]

## 1. 비교

| 구분 | 특징 |
|---|---|
| Temperature Cascade | 감온기 출구온도 제어 |

- **열회수:** 더 많이 회수 [1,2]
- **비용:** 면적 증가 [AI]

<b>태그</b>는 글자로`

const paper = {
  docAlias: 'R014',
  title: 'Optimization of the triple-pressure HRSG',
  authors: ['A. Kim', 'B. Lee'],
  year: 2019,
  venue: 'Applied Thermal Engineering',
  url: 'https://doi.org/10.1000/xyz',
  score: 1,
}
const items: Citation[] = [
  { ...paper, pages: '4–5', sectionTitle: '3.2', snippet: '발췌 A' },
  { docAlias: 'TECH-DOC-002', title: 'GT 배압과 HRSG 차압의 관계', sectionTitle: null, snippet: '발췌 B', score: 0.5 },
  { ...paper, pages: '7', sectionTitle: '3.3', snippet: '발췌 C', score: 0.4 },
]

describe('Markdown', () => {
  it('굵게·소제목·표·목록을 그리고 [n]·[AI]는 renderCite로 넘긴다', () => {
    const seen: (number[] | 'ai')[] = []
    const { container } = render(
      <Markdown
        text={ANSWER}
        renderCite={(ref, key) => {
          seen.push(ref)
          return <span key={key} data-testid="cite" />
        }}
      />,
    )
    expect(screen.getByText('핀치 포인트를 낮추면').tagName).toBe('STRONG')
    expect(screen.getByRole('heading', { name: '1. 비교' })).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: '특징' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(seen).toEqual([[1], [1, 2], 'ai'])
    expect(container.textContent).not.toMatch(/\[1\]|\[AI\]/)
    expect(container.querySelector('b')).toBeNull() // HTML은 해석하지 않는다
    expect(container.textContent).toContain('<b>태그</b>')
  })
})

describe('출처 표기', () => {
  it('문서 제목을 앞세우고 서지 정보는 아랫줄, 같은 논문은 한 항목으로 묶고 쪽수를 모은다', () => {
    const [s, internal] = groupSources(items)
    expect(sourceTitle(s.c)).toBe('Optimization of the triple-pressure HRSG')
    expect(byline(s, 'et al.')).toBe('A. Kim & B. Lee (2019). Applied Thermal Engineering, pp. 4–5, 7.')
    // 저자·연도가 없는 내장 문서는 별칭이 아니라 제목만
    expect(sourceTitle(internal.c)).toBe('GT 배압과 HRSG 차압의 관계')
    expect(byline(internal, '외')).toBe('')
    // 제목이 비어 있을 때만 내부 ID
    expect(sourceTitle({ ...internal.c, title: '' })).toBe(internal.c.docAlias)
  })
})

describe('CitationChip', () => {
  it('첫 출처와 나머지 개수를 보이고, 누르면 서지 정보가 뜬다', async () => {
    render(<CitationChip items={items} nums={[1, 2, 3]} style="titles" />)
    const chip = screen.getByTestId('citation-chip')
    expect(chip).toHaveTextContent('Optimization of the triple-pressure HRSG+1') // 같은 논문(1·3)은 한 번
    await userEvent.click(chip)
    const pop = screen.getByRole('dialog')
    expect(pop).toHaveTextContent('Applied Thermal Engineering, pp. 4–5, 7.')
    expect(pop).toHaveTextContent('GT 배압과 HRSG 차압의 관계')
    expect(within(pop).getByRole('link')).toHaveAttribute('href', 'https://doi.org/10.1000/xyz')
    expect(pop).not.toHaveTextContent('발췌') // 논문 RAG는 서지 정보만
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('[AI] 칩은 일반 지식으로 쓴 부분과 모델을 밝힌다', async () => {
    render(<AiChip model="Claude (claude-sonnet-5-5)" />)
    await userEvent.click(screen.getByTestId('ai-chip'))
    expect(screen.getByRole('dialog')).toHaveTextContent('AI 생성 답변 · Claude (claude-sonnet-5-5)')
  })
})

describe('CitationList', () => {
  it('출처 버튼을 누르면 문서별 목록과 AI 생성 항목을 펼친다', async () => {
    render(<CitationList items={items} style="excerpts" mockDocs aiModel="fake" />)
    const button = screen.getByRole('button', { name: /출처/ })
    expect(button).toHaveTextContent('3') // 문서 2 + AI 생성 1
    expect(screen.getByText('예시 문서')).toBeInTheDocument()
    await userEvent.click(button)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('발췌 A')).toBeInTheDocument()
    expect(screen.getByText('AI 생성 답변 · fake')).toBeInTheDocument()
  })
})

describe('CitationList — 인용한 출처만', () => {
  it('본문에서 인용하지 않은 검색 결과는 목록에서 뺀다', async () => {
    render(<CitationList items={items} nums={[2]} style="excerpts" />)
    const button = screen.getByRole('button', { name: /출처/ })
    expect(button).toHaveTextContent('1')
    await userEvent.click(button)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('발췌 B')).toBeInTheDocument()
  })

  it('[AI]만 있는 답변은 AI 생성 항목만, 출처도 AI도 없으면 아무것도 그리지 않는다', () => {
    const { container, rerender } = render(<CitationList items={items} nums={[]} aiModel="fake" />)
    expect(screen.getByRole('button', { name: /출처/ })).toHaveTextContent('1')
    rerender(<CitationList items={items} nums={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
