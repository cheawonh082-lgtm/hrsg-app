import '../../i18n'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Citation } from '../../api/types'
import { CitationChip, CitationList } from './CitationList'
import { Markdown } from './Markdown'

const ANSWER = `**핀치 포인트를 낮추면** 증기 생산이 늘어납니다. [1]

## 1. 비교

| 구분 | 특징 |
|---|---|
| Temperature Cascade | 감온기 출구온도 제어 |

- **열회수:** 더 많이 회수 [1,2]
- **비용:** 면적 증가

<b>태그</b>는 글자로`

const items: Citation[] = [
  { docAlias: 'Optimization of the triple-pressure HRSG', sectionTitle: '3.2', snippet: '발췌 A', score: 1 },
  { docAlias: 'Steam Temperature Control', sectionTitle: null, snippet: '발췌 B', score: 0.5 },
  { docAlias: 'Optimization of the triple-pressure HRSG', sectionTitle: '3.3', snippet: '발췌 C', score: 0.4 },
]

describe('Markdown', () => {
  it('굵게·소제목·표·목록을 그리고 [n]은 renderCite로 넘긴다', () => {
    const seen: number[][] = []
    const { container } = render(
      <Markdown
        text={ANSWER}
        renderCite={(nums, key) => {
          seen.push(nums)
          return <span key={key} data-testid="cite">{nums.join('+')}</span>
        }}
      />,
    )
    expect(screen.getByText('핀치 포인트를 낮추면').tagName).toBe('STRONG')
    expect(screen.getByRole('heading', { name: '1. 비교' })).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: '특징' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(seen).toEqual([[1], [1, 2]])
    expect(container.textContent).not.toContain('[1]')
    expect(container.querySelector('b')).toBeNull() // HTML은 해석하지 않는다
    expect(container.textContent).toContain('<b>태그</b>')
  })
})

describe('CitationChip', () => {
  it('첫 출처 이름과 나머지 개수를 보이고, 누르면 출처 목록이 뜬다', async () => {
    render(<CitationChip items={items} nums={[1, 2, 3]} style="titles" />)
    const chip = screen.getByTestId('citation-chip')
    expect(chip).toHaveTextContent('Optimization of the triple-pressure HRSG+1') // 같은 논문(1·3)은 한 번
    await userEvent.click(chip)
    const pop = screen.getByRole('dialog')
    expect(pop).toHaveTextContent('Steam Temperature Control')
    expect(pop).not.toHaveTextContent('발췌') // 논문 RAG는 논문명만
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('CitationList', () => {
  it('출처 버튼을 누르면 중복 없는 출처 목록을 펼친다', async () => {
    render(<CitationList items={items} style="excerpts" mockDocs />)
    const button = screen.getByRole('button', { name: /출처/ })
    expect(button).toHaveTextContent('2')
    expect(screen.getByText('예시 문서')).toBeInTheDocument()
    await userEvent.click(button)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('발췌 A')).toBeInTheDocument()
  })
})
