/**
 * 반응형 교차 검수 (PRD §3.4, §6.3 D) — 뷰포트 × 화면 × (한국어·라이트 / 영어·다크).
 * 7개 뷰포트 기본 넘침 검사(V-01)는 responsive/layout.spec.ts, 여기서는 언어·테마 교차와 내용 넘침·상태 색까지 본다.
 * 픽셀 비교 대신 전체 화면 스크린샷을 첨부한다(차트 애니메이션·폰트로 기기마다 흔들림).
 */
import { expect, type Page, test } from '@playwright/test'

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
]
const COMBOS = [
  { locale: 'ko', theme: 'light' },
  { locale: 'en', theme: 'dark' },
] as const
const LG = 1024

/** 화면 설정(hrsg-ui)을 페이지 로드 전에 심는다 — index.html 초기 스크립트가 같은 키를 읽음 */
async function usePrefs(page: Page, locale: string, theme: string) {
  await page.addInitScript(
    ([l, t]) => localStorage.setItem('hrsg-ui', JSON.stringify({ state: { locale: l, theme: t }, version: 0 })),
    [locale, theme],
  )
}

/** 각 화면을 내용이 채워진 상태로 연다 */
async function openFilled(page: Page, path: string, locale: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  if (path === '/calculator') {
    await expect(page.getByTestId('kpi-totalLoss-value')).toHaveText(/\d/)
    await expect(page.getByTestId('trend-chart').locator('canvas')).toBeVisible()
  } else if (path === '/chat') {
    // 첫 추천 질문(지식형) + 계산 질문 → 근거 목록·결과 카드까지 그려진 상태
    const input = page.locator('#chat-input')
    for (const q of locale === 'ko'
      ? ['HRSG 핀 오염이 GT 배압에 미치는 영향은?', 'F급 GT, 차압 35mbar, 스택 110℃면 연간 손실은?']
      : ['How does HRSG fin fouling affect GT back pressure?', 'F-class GT, pressure drop 35 mbar, stack 110℃ — annual loss?']) {
      await input.fill(q)
      await input.press('Enter')
      await expect(page.getByTestId('assistant-message').last()).toHaveAttribute('data-status', 'done')
    }
  } else {
    await expect(page.getByTestId('checklist-progress')).toBeVisible()
  }
}

async function expectNoPageOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, '페이지 가로 스크롤 금지 (R-1)').toBeLessThanOrEqual(clientWidth)
}

/**
 * 버튼·링크·KPI 값·제목의 글자가 자기 상자 밖으로 넘치지 않는지 (R-4, R-5, R-11).
 * 의도적으로 말줄임(truncate) 처리했거나 내부 스크롤(ScrollContainer)인 요소는 제외.
 */
async function textOverflowOffenders(page: Page) {
  return page.evaluate(() => {
    const selector = 'button, a, select, h1, h2, h3, [data-testid$="-value"], [data-testid^="card-"], [role="progressbar"]'
    const offenders: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (!el.getClientRects().length) continue
      if (el.closest('.sr-only')) continue // 화면에 보이지 않는 스크린리더 전용 요소(본문 바로가기 등)
      const style = getComputedStyle(el)
      if (style.textOverflow === 'ellipsis' || ['auto', 'scroll'].includes(style.overflowX)) continue
      if (el.closest('[data-scroll-container], [role="log"] ul')) continue // 추천 칩 등 의도된 가로 스크롤
      const rect = el.getBoundingClientRect()
      const outOfViewport = rect.right > document.documentElement.clientWidth + 1 || rect.left < -1
      if (el.scrollWidth > el.clientWidth + 1 || outOfViewport) {
        offenders.push(`${el.tagName.toLowerCase()}「${(el.textContent ?? '').trim().slice(0, 30)}」 ${el.scrollWidth}>${el.clientWidth}`)
      }
    }
    // 드롭다운이 좁아져 선택값을 읽을 수 없게 되는 경우(넘침은 아니지만 사용 불가)
    for (const el of document.querySelectorAll<HTMLSelectElement>('select')) {
      if (el.getClientRects().length && el.getBoundingClientRect().width < 96) {
        offenders.push(`select「${el.selectedOptions[0]?.text ?? ''}」 width ${Math.round(el.getBoundingClientRect().width)}px`)
      }
    }
    return offenders
  })
}

/** 상태 표시(정상/주의/위험)의 글자색 = 테마 토큰, 표면 대비 3:1 이상 (색 + 아이콘 + 텍스트, WCAG 비텍스트 대비) */
async function statusColorReport(page: Page) {
  return page.evaluate(() => {
    const toRgb = (c: string) => {
      const probe = document.createElement('span')
      probe.style.color = c
      document.body.appendChild(probe)
      const rgb = getComputedStyle(probe).color
      probe.remove()
      return rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number)
    }
    const luminance = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const contrast = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    const root = getComputedStyle(document.documentElement)
    const surface = toRgb(root.getPropertyValue('--surface'))
    const report: { status: string; matchesToken: boolean; contrast: number }[] = []
    for (const pill of document.querySelectorAll<HTMLElement>('span[data-status]')) {
      const status = pill.dataset.status!
      if (!['normal', 'caution', 'danger'].includes(status)) continue
      const token = toRgb(root.getPropertyValue(`--status-${status}`))
      const actual = toRgb(getComputedStyle(pill).color)
      report.push({ status, matchesToken: token.join() === actual.join(), contrast: Math.round(contrast(token, surface) * 100) / 100 })
    }
    return report
  })
}

for (const vp of VIEWPORTS) {
  for (const { locale, theme } of COMBOS) {
    test.describe(`${vp.width}x${vp.height} · ${locale} · ${theme}`, () => {
      test.use({ viewport: vp, hasTouch: vp.width < LG })

      for (const path of ['/calculator', '/chat', '/checklist']) {
        test(`${path} 넘침 없음 + 스크린샷`, async ({ page }) => {
          await usePrefs(page, locale, theme)
          await openFilled(page, path, locale)

          await expect(page.locator('html')).toHaveAttribute('lang', locale)
          if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
          else await expect(page.locator('html')).not.toHaveClass(/dark/)

          await expectNoPageOverflow(page)
          expect(await textOverflowOffenders(page), '글자 넘침 요소').toEqual([])

          await page.screenshot({ path: test.info().outputPath(`${path.slice(1)}.png`), fullPage: true })
        })
      }

      test('상태 색 = 테마 토큰, 표면 대비 3:1 이상', async ({ page }) => {
        await usePrefs(page, locale, theme)
        await openFilled(page, '/calculator', locale)
        const report = await statusColorReport(page)
        expect(report.length).toBeGreaterThan(0)
        for (const r of report) {
          expect(r.matchesToken, `${r.status} 색이 토큰과 다름`).toBe(true)
          expect(r.contrast, `${r.status} 대비 ${r.contrast}`).toBeGreaterThanOrEqual(3)
        }
      })
    })
  }
}
