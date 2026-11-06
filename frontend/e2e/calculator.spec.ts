/** 계산기 화면 E2E (PRD §6.3 A, D) — 360px 모바일 / 1280px 데스크톱 */
import { expect, type Locator, type Page, test } from '@playwright/test'

const lossValue = (page: Page) => page.getByTestId('kpi-totalLoss-value')

/** 키트 예시 운전 상태(defaultInputs: F-Class, 배압 30 · 차압 30 · 스택 95)에서 시작 — 손실 1.89 MW */
async function openCalculator(page: Page) {
  await page.goto('/calculator')
  await expect(lossValue(page)).toHaveText('1.89')
}

/** 계산기 화면 탭 — 탭 이름 앞부분으로 찾는다 */
const TAB_NAMES = { loss: /^현재상태/, cleaning: /^세정 공법별/, pinch: /^핀치/ } as const
async function openTab(page: Page, id: keyof typeof TAB_NAMES) {
  const tab = page.getByRole('tab', { name: TAB_NAMES[id] })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

/** /api/calc/evaluate 요청 본문 기록 */
function trackEvaluate(page: Page) {
  const bodies: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/api/calc/evaluate')) bodies.push(r.postData() ?? '')
  })
  return bodies
}

/** ΔP 35 mbar(설계 25), 스택 110℃(설계 90) — 키트 식 GT 2.16 + ST 3.24 = 5.40 MW, 둘 다 위험 기준 이상 */
async function enterFouledState(scope: Locator) {
  await scope.getByLabel('HRSG 차압 (ΔP)', { exact: true }).fill('35')
  await scope.getByLabel('스택 온도', { exact: true }).fill('110')
}

async function expectFouledDashboard(page: Page) {
  await expect(lossValue(page)).toHaveText('5.40')
  await expect(page.getByTestId('kpi-status')).toContainText('위험')
  await expect(page.getByTestId('kpi-totalLoss')).toContainText('▲')
  await expect(page.getByTestId('trend-chart')).toHaveAttribute('data-current-x', '35')
  await expect(page.getByTestId('trend-chart').locator('canvas')).toBeVisible()
  await expect(page.locator('[data-testid=hrsg-schematic] [data-bundle=evaporator]')).toHaveAttribute('data-status', 'danger')
  await expect(page.getByTestId('schematic-stack')).toHaveAttribute('data-status', 'danger')

  const dpGauge = page.getByTestId('gauge-hrsgGasDp')
  await expect(dpGauge).toHaveAttribute('data-value', '35')
  await expect(dpGauge).toHaveAttribute('data-status', 'danger')
  await expect(dpGauge.locator('canvas')).toHaveCount(1)
  await expect(page.getByTestId('loss-current')).toContainText('5.40 MW')
  await expect(page.getByTestId('efficiency-chart').locator('canvas')).toBeVisible()

  await openTab(page, 'pinch')
  await expect(page.getByTestId('perf-overall')).toHaveAttribute('data-status', 'danger')
  await expect(page.getByTestId('perf-perfLoss')).toContainText('5.40')
}

test.describe('데스크톱 1280px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('좌측 입력 패널 조작 → KPI·게이지·도식·감도 곡선 갱신', async ({ page }) => {
    await openCalculator(page)
    const panel = page.getByRole('complementary', { name: '입력 조정' })
    await expect(panel).toBeVisible()
    expect((await panel.boundingBox())!.width).toBe(320)

    const bodies = trackEvaluate(page)
    await enterFouledState(panel)
    await expectFouledDashboard(page)

    // 디바운스: 연달아 바꾼 두 값이 한 요청에 함께 담긴다
    expect(bodies.length).toBeLessThanOrEqual(2)
    expect(bodies.at(-1)).toContain('"hrsgGasDpMbar":35')
    expect(bodies.at(-1)).toContain('"stackTempC":110')
  })

  test('도식 설비에 마우스를 올리면 표시 오염도·지표 툴팁 (화면 안에 표시)', async ({ page }) => {
    await openCalculator(page)
    await page.locator('[data-testid=hrsg-schematic] [data-part=evaporator]').hover()
    const tooltip = page.getByTestId('schematic-tooltip')
    await expect(tooltip).toContainText('표시 오염도')
    await expect(tooltip).toContainText('HRSG 차압')
    await expect(tooltip).toContainText('주의') // 예시 운전 상태의 차압 30 mbar는 주의

    await page.locator('[data-testid=hrsg-schematic] [data-part=stack]').hover()
    await expect(tooltip).toContainText('스택 온도')
    const box = (await tooltip.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(1280)
  })

  test('범위 밖 입력은 경고하고 계산을 막는다', async ({ page }) => {
    await openCalculator(page)
    const panel = page.getByRole('complementary', { name: '입력 조정' })
    const bodies = trackEvaluate(page)

    await panel.getByLabel('GT 배기온도', { exact: true }).fill('800')
    await expect(panel.getByText('680 이하여야 합니다.')).toBeVisible()
    await expect(panel.getByText(/재계산을 멈췄습니다/)).toBeVisible()
    await page.waitForTimeout(600)
    expect(bodies).toHaveLength(0)
    await expect(lossValue(page)).toHaveText('1.89')
  })

  test('핀치 입력을 비우면 "데이터 필요" + 체크리스트 링크', async ({ page }) => {
    await openCalculator(page)
    const panel = page.getByRole('complementary', { name: '입력 조정' })
    await openTab(page, 'pinch')
    const hp = page.getByTestId('pinch-HP')
    await expect(hp).toHaveAttribute('data-status', 'normal')

    await panel.getByRole('button', { name: /고급 입력/ }).click()
    await panel.getByRole('button', { name: 'HP 드럼 압력 비우기' }).click()
    await expect(hp).toHaveAttribute('data-status', 'insufficient_data')
    await hp.getByRole('link', { name: '체크리스트에서 데이터 요청' }).click()
    await expect(page).toHaveURL(/\/checklist$/)
  })

  test('공법 비교 표: 「순편익 최대」 배지와 정렬', async ({ page }) => {
    await openCalculator(page)
    await enterFouledState(page.getByRole('complementary', { name: '입력 조정' }))
    await expect(lossValue(page)).toHaveText('5.40')

    await openTab(page, 'cleaning')
    const table = page.getByRole('table')
    const firstRow = table.locator('tbody tr').first()
    await expect(firstRow).toContainText('순편익 최대') // 기본 정렬: 순편익 높은 순
    await expect(table.locator('tbody tr').filter({ hasText: '순편익 최대' })).toHaveCount(1)
    await expect(table).not.toContainText('추천')

    await table.getByRole('button', { name: '비용' }).click()
    await expect(table.getByRole('columnheader', { name: '비용' })).toHaveAttribute('aria-sort', 'descending')
    await expect(firstRow).toContainText('화학 세정') // 총투자가 가장 큰 공법
  })

  test('모델을 바꾸면 그 등급의 예시 운전 상태, 초기화는 설계 상태', async ({ page }) => {
    await openCalculator(page)
    const panel = page.getByRole('complementary', { name: '입력 조정' })
    await panel.getByLabel('가스터빈 모델').selectOption('GT_MOCK_H_CLASS')
    await expect(panel.getByLabel('GT 배기온도', { exact: true })).toHaveValue('640') // H-Class 운전 조건
    await expect(page.getByTestId('gauge-hrsgGasDp')).toHaveAttribute('data-status', 'caution') // H 설계 27, 주의 30

    await panel.getByRole('button', { name: /설계값으로 초기화/ }).click()
    await expect(panel.getByLabel('HRSG 차압 (ΔP)', { exact: true })).toHaveValue('27')
    await expect(lossValue(page)).toHaveText('0.00')
  })

  test('월간 가동시간은 회수기간에, 연간 운전시간은 연간 손실에 쓰인다', async ({ page }) => {
    await openCalculator(page)
    const panel = page.getByRole('complementary', { name: '입력 조정' })
    await openTab(page, 'pinch')
    await expect(page.getByTestId('perf-payback')).toContainText('3.54')
    await panel.getByRole('button', { name: /경제성/ }).click()
    await expect(panel.getByLabel('월간 가동시간', { exact: true })).toHaveValue('720')
    await panel.getByLabel('월간 가동시간', { exact: true }).fill('360')
    await expect(page.getByTestId('perf-payback')).toContainText('7.08')
    await expect(page.getByTestId('perf-annualLoss')).toContainText('22.68억 원') // 연간 운전시간 8000 h 그대로
  })

  test('AI에게 질문하기 → calcId를 가지고 /chat 이동', async ({ page }) => {
    await openCalculator(page)
    await page.getByRole('button', { name: 'AI에게 이 결과 질문하기' }).click()
    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByTestId('chat-calc-context')).toBeVisible()
    await expect(page.getByRole('button', { name: '이 계산 결과 해석해줘' })).toBeVisible()
  })
})

test.describe('모바일 360px', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true })

  const sheet = (page: Page) => page.getByRole('dialog', { name: '입력 조정' })

  test('바텀시트에서 입력 → 시트 요약과 대시보드 갱신', async ({ page }) => {
    await openCalculator(page)
    await expect(page.getByRole('complementary')).toHaveCount(0) // 사이드 패널 없음

    await page.getByRole('button', { name: '입력 조정' }).tap()
    await expect(sheet(page)).toBeVisible()
    await expect(page.getByTestId('sheet-summary-loss')).toHaveText('1.89 MW')

    await enterFouledState(sheet(page))
    await expect(page.getByTestId('sheet-summary-loss')).toHaveText('5.40 MW') // 시트를 연 채로 결과 확인
    await expect(page.getByTestId('sheet-summary')).toContainText('위험')

    await page.keyboard.press('Escape')
    await expect(sheet(page)).toBeHidden()
    await expectFouledDashboard(page)
  })

  test('시트: 높이 전환 · 배경 탭 닫기 · 아래로 끌어 닫기', async ({ page }) => {
    await openCalculator(page)
    const fab = page.getByRole('button', { name: '입력 조정' })

    await fab.tap()
    await expect(sheet(page)).toHaveAttribute('data-snap', '0')
    await page.getByRole('button', { name: '시트 높이 전환' }).tap()
    await expect(sheet(page)).toHaveAttribute('data-snap', '1')
    await page.touchscreen.tap(180, 30) // 시트 위쪽 배경
    await expect(sheet(page)).toBeHidden()

    await fab.tap()
    // 올라오는 애니메이션이 끝난 뒤 손잡이 위치를 잰다 (도중에 재면 끌기 시작점이 어긋남)
    await sheet(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    const handle = page.getByRole('button', { name: '시트 높이 전환' })
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 320, { steps: 8 })
    await page.mouse.up()
    await expect(sheet(page)).toBeHidden()
  })

  test('도식 설비 탭 → 툴팁(화면 안), 공법 비교는 카드 목록', async ({ page }) => {
    await openCalculator(page)
    await page.locator('[data-testid=hrsg-schematic] [data-part=economizer]').tap()
    const tooltip = page.getByTestId('schematic-tooltip')
    await expect(tooltip).toContainText('표시 오염도')
    const box = (await tooltip.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(360)

    await openTab(page, 'cleaning')
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('list', { name: '세정 공법별 비용 비교' }).getByRole('listitem')).toHaveCount(4)
  })

  test('게이지는 가로 스와이프 + 페이지 점', async ({ page }) => {
    await openCalculator(page)
    const dots = page.getByRole('button', { name: /번째 지표 보기/ })
    await expect(dots).toHaveCount(3)
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true')
    await dots.nth(2).tap()
    await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true')
    await expect(page.getByTestId('gauge-stackTemp')).toBeInViewport()
  })

  test('입력·시트를 열어도 페이지 가로 넘침 없음', async ({ page }) => {
    await openCalculator(page)
    await page.getByRole('button', { name: '입력 조정' }).tap()
    await enterFouledState(sheet(page))
    await page.keyboard.press('Escape')
    await expect(lossValue(page)).toHaveText('5.40')
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    await page.screenshot({ path: test.info().outputPath('mobile-fouled.png'), fullPage: true })
  })
})
