/** 계산기 화면 E2E (PRD §6.3 A, D) — 360px 모바일 / 1280px 데스크톱 */
import { expect, type Locator, type Page, test } from '@playwright/test'

const lossValue = (page: Page) => page.getByTestId('kpi-totalLoss-value')

/** 설계점(F-Class 기본값)에서 시작 — 손실 0 */
async function openCalculator(page: Page) {
  await page.goto('/calculator')
  await expect(lossValue(page)).toHaveText('0.00')
}

/** /api/calc/evaluate 요청 본문 기록 */
function trackEvaluate(page: Page) {
  const bodies: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/api/calc/evaluate')) bodies.push(r.postData() ?? '')
  })
  return bodies
}

/** ΔP 35 mbar(+40%), 스택 110℃(+20℃) — Mock 기준 총 손실 3.16 MW, 위험 */
async function enterFouledState(scope: Locator) {
  await scope.getByLabel('HRSG 차압 (ΔP)', { exact: true }).fill('35')
  await scope.getByLabel('스택 온도', { exact: true }).fill('110')
}

async function expectFouledDashboard(page: Page) {
  await expect(lossValue(page)).toHaveText('3.16')
  await expect(page.getByTestId('kpi-status')).toContainText('위험')
  await expect(page.getByTestId('kpi-totalLoss')).toContainText('▲')

  const dpGauge = page.getByTestId('gauge-hrsgGasDp')
  await expect(dpGauge).toHaveAttribute('data-value', '35')
  await expect(dpGauge).toHaveAttribute('data-status', 'danger')
  await expect(dpGauge.locator('canvas')).toHaveCount(1)

  await expect(page.getByTestId('trend-chart')).toHaveAttribute('data-current-x', '35')
  await expect(page.getByTestId('trend-chart').locator('canvas')).toBeVisible()
  await expect(page.locator('[data-testid=hrsg-diagram] [data-section=HP_EVA]')).toHaveAttribute('data-status', 'danger')
  await expect(page.locator('[data-testid=hrsg-diagram] [data-section=STACK]')).toHaveAttribute('data-status', 'danger')
}

test.describe('데스크톱 1280px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('좌측 입력 패널 조작 → KPI·게이지·도식·감도 곡선 갱신', async ({ page }) => {
    await openCalculator(page)
    const panel = page.getByRole('complementary', { name: '입력 조정' })
    await expect(panel).toBeVisible()
    expect((await panel.boundingBox())!.width).toBe(320)
    await expect(page.getByTestId('hrsg-diagram')).toHaveAttribute('data-orientation', 'horizontal')

    const bodies = trackEvaluate(page)
    await enterFouledState(panel)
    await expectFouledDashboard(page)

    // 디바운스: 연달아 바꾼 두 값이 한 요청에 함께 담긴다
    expect(bodies.length).toBeLessThanOrEqual(2)
    expect(bodies.at(-1)).toContain('"hrsgGasDpMbar":35')
    expect(bodies.at(-1)).toContain('"stackTempC":110')
  })

  test('섹션에 마우스를 올리면 온도·상태 툴팁', async ({ page }) => {
    await openCalculator(page)
    await page.locator('[data-testid=hrsg-diagram] [data-section=HP_EVA]').hover()
    const tooltip = page.getByTestId('hrsg-tooltip')
    await expect(tooltip).toContainText('고압 증발기')
    await expect(tooltip).toContainText('가스 입구')
    await expect(tooltip).toContainText('정상')
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
    await expect(lossValue(page)).toHaveText('0.00')
  })

  test('핀치 입력을 비우면 "데이터 필요" + 체크리스트 링크', async ({ page }) => {
    await openCalculator(page)
    const panel = page.getByRole('complementary', { name: '입력 조정' })
    const hp = page.getByTestId('pinch-HP')
    await expect(hp).toHaveAttribute('data-status', 'normal')

    await panel.getByRole('button', { name: /고급 입력/ }).click()
    await panel.getByRole('button', { name: 'HP 드럼 압력 비우기' }).click()
    await expect(hp).toHaveAttribute('data-status', 'insufficient_data')
    await hp.getByRole('link', { name: '체크리스트에서 데이터 요청' }).click()
    await expect(page).toHaveURL(/\/checklist$/)
  })

  test('공법 비교 표: 추천 배지와 정렬', async ({ page }) => {
    await openCalculator(page)
    await enterFouledState(page.getByRole('complementary', { name: '입력 조정' }))
    await expect(lossValue(page)).toHaveText('3.16')

    const table = page.getByRole('table')
    const firstRow = table.locator('tbody tr').first()
    await expect(firstRow).toContainText('추천') // 기본 정렬: 순편익 높은 순
    await expect(table.locator('tbody tr').filter({ hasText: '추천' })).toHaveCount(1)

    await table.getByRole('button', { name: '비용' }).click()
    await expect(table.getByRole('columnheader', { name: '비용' })).toHaveAttribute('aria-sort', 'descending')
    await expect(firstRow).toContainText('화학 세정') // Mock 단가가 가장 높은 공법
  })

  test('모델을 바꾸면 해당 모델 기본값으로 바뀐다', async ({ page }) => {
    await openCalculator(page)
    const panel = page.getByRole('complementary', { name: '입력 조정' })
    await panel.getByLabel('가스터빈 모델').selectOption('GT_MOCK_H_CLASS')
    await expect(panel.getByLabel('HRSG 차압 (ΔP)', { exact: true })).toHaveValue('28')
    await expect(page.getByTestId('gauge-hrsgGasDp')).toHaveAttribute('data-value', '28')
  })

  test('AI에게 질문하기 → calcId를 가지고 /chat 이동', async ({ page }) => {
    await openCalculator(page)
    await page.getByRole('button', { name: 'AI에게 이 결과 질문하기' }).click()
    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByTestId('chat-calc-context')).toBeVisible()
    await expect(page.getByRole('button', { name: '이 결과 해석해줘' })).toBeVisible()
  })
})

test.describe('모바일 360px', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true })

  const sheet = (page: Page) => page.getByRole('dialog', { name: '입력 조정' })

  test('바텀시트에서 입력 → 시트 요약과 대시보드 갱신', async ({ page }) => {
    await openCalculator(page)
    await expect(page.getByRole('complementary')).toHaveCount(0) // 사이드 패널 없음
    await expect(page.getByTestId('hrsg-diagram')).toHaveAttribute('data-orientation', 'vertical')

    await page.getByRole('button', { name: '입력 조정' }).tap()
    await expect(sheet(page)).toBeVisible()
    await expect(page.getByTestId('sheet-summary-loss')).toHaveText('0.00 MW')

    await enterFouledState(sheet(page))
    await expect(page.getByTestId('sheet-summary-loss')).toHaveText('3.16 MW') // 시트를 연 채로 결과 확인
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
    const handle = page.getByRole('button', { name: '시트 높이 전환' })
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 320, { steps: 8 })
    await page.mouse.up()
    await expect(sheet(page)).toBeHidden()
  })

  test('세로 도식 섹션 탭 → 정보 패널, 공법 비교는 카드 목록', async ({ page }) => {
    await openCalculator(page)
    await page.locator('[data-testid=hrsg-diagram] [data-section=HP_EVA]').tap()
    await expect(page.getByTestId('hrsg-info')).toContainText('고압 증발기')
    await expect(page.getByTestId('hrsg-info')).toContainText('가스 출구')

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
    await expect(lossValue(page)).toHaveText('3.16')
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    await page.screenshot({ path: test.info().outputPath('mobile-fouled.png'), fullPage: true })
  })
})
