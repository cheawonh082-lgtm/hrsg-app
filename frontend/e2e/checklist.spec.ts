/** 체크리스트 E2E — 항목·상태·메일 문구는 팀 공통 키트(checklist.json 49개). 실제 서버 상태 파일을 쓰므로 매번 초기화 */
import { expect, type Page, test } from '@playwright/test'

// 상태 파일 하나를 공유하므로 이 파일의 테스트는 순서대로 실행한다
test.describe.configure({ mode: 'serial' })

const progress = (page: Page) => page.getByTestId('checklist-progress')
const item = (page: Page, id: string) => page.getByTestId(`item-${id}`)

async function openChecklist(page: Page) {
  await page.request.post('/api/checklist/reset')
  await page.goto('/checklist')
  await page.evaluate(() => localStorage.removeItem('hrsg-checklist-pending-v2'))
  await expect(page.getByTestId('progress-percent')).toHaveText('0%')
}

/**
 * 체크박스 클릭. 화면 갱신은 쿼리 캐시 알림(다음 tick)으로 이뤄져 locator.check()의 즉시 검증과 어긋나므로
 * click + 재시도 단언을 쓴다.
 */
async function tick(checkbox: ReturnType<Page['getByRole']>) {
  await checkbox.click()
  await expect(checkbox).toBeChecked()
}

/** PATCH 응답까지 기다린다 — 새로고침 전에 서버 저장이 끝났는지 보장 */
async function saved(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse((r) => r.url().includes('/api/checklist/items/') && r.request().method() === 'PATCH')
  await action()
  expect((await response).ok()).toBeTruthy()
}

test.describe('데스크톱 1280px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('키트 기대값: 처음 0% (0/49) · 필수 0/16 · 분류별 · 「필수」 16개 · 「핀치」 5건', async ({ page }) => {
    await openChecklist(page)
    await expect(progress(page)).toContainText('(0/49)')
    await expect(page.getByTestId('progress-required')).toHaveText('필수 0/16')
    for (const [id, total] of [['A', 6], ['B', 13], ['C', 9], ['D', 3], ['E', 18]] as const) {
      await expect(page.getByTestId(`progress-${id}`)).toContainText(`0/${total}`)
    }
  })

  test('키트 기대값: A-01 체크 2% (1/49) / B-13 해당 없음 분모 48 · 새로고침해도 유지', async ({ page }) => {
    await openChecklist(page)
    await saved(page, () => tick(item(page, 'A-01').getByRole('checkbox')))
    await expect(progress(page)).toContainText('(1/49)')
    await saved(page, () => item(page, 'B-13').getByRole('combobox').selectOption('na'))
    await expect(progress(page)).toContainText('(1/48)')
    await page.reload()
    await expect(progress(page)).toContainText('(1/48)')
    await expect(item(page, 'B-13').getByRole('combobox')).toHaveValue('na')
  })

  test('K-01 체크 → 진행률 즉시 갱신 → 새로고침 후 유지', async ({ page }) => {
    await openChecklist(page)
    const a01 = item(page, 'A-01')
    await saved(page, () => tick(a01.getByRole('checkbox')))

    await expect(a01).toHaveAttribute('data-checked', 'true')
    await expect(a01.getByRole('combobox')).toHaveValue('received')
    await expect(page.getByTestId('progress-percent')).toHaveText('2%')
    await expect(page.getByTestId('progress-required')).toHaveText('필수 1/16')
    await expect(page.getByTestId('progress-A')).toContainText('1/6')

    await page.reload()
    await expect(item(page, 'A-01')).toHaveAttribute('data-checked', 'true')
    await expect(page.getByTestId('progress-percent')).toHaveText('2%')
  })

  test('상태 드롭다운: 수령=자동 체크, 해당 없음=진행률 분모에서 제외', async ({ page }) => {
    await openChecklist(page)
    await saved(page, () => item(page, 'B-01').getByRole('combobox').selectOption('received'))
    await expect(item(page, 'B-01')).toHaveAttribute('data-checked', 'true')

    await saved(page, () => item(page, 'B-13').getByRole('combobox').selectOption('na'))
    await expect(progress(page)).toContainText('(1/48)')
    await expect(item(page, 'B-13').getByRole('checkbox')).toBeDisabled()
  })

  test('메모 입력은 자동 저장되고 새로고침 후에도 남는다', async ({ page }) => {
    await openChecklist(page)
    const row = item(page, 'A-02')
    await row.getByRole('button', { name: /메모$/ }).click()
    await saved(page, () => row.getByRole('textbox').fill('DCS 태그 PT-101 확인 중'))

    await page.reload()
    await expect(item(page, 'A-02').getByRole('textbox')).toHaveValue('DCS 태그 PT-101 확인 중')
  })

  test('필터·검색·섹션 전체 체크', async ({ page }) => {
    await openChecklist(page)
    await page.getByRole('button', { name: '필수', exact: true }).click()
    await expect(page.locator('li[data-testid^="item-"]')).toHaveCount(16)

    await page.getByRole('button', { name: '전체', exact: true }).click()
    await page.getByRole('searchbox', { name: '항목 검색' }).fill('핀치')
    await expect(page.locator('li[data-testid^="item-"]')).toHaveCount(5)
    await page.getByRole('searchbox', { name: '항목 검색' }).fill('')

    await tick(page.getByRole('checkbox', { name: 'A. 가스터빈/운전 전체 체크' }))
    await expect(page.getByTestId('section-A')).toContainText('6/6')
    await page.getByRole('button', { name: '미완료', exact: true }).click()
    await expect(page.getByTestId('section-A')).toHaveCount(0)
  })

  test('이메일 미리보기: 키트 문구 · 수령 항목 제외 · 메모·실명 미포함 → 클립보드 복사', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openChecklist(page)
    await saved(page, () => tick(item(page, 'A-01').getByRole('checkbox')))
    const row = item(page, 'A-03')
    await row.getByRole('button', { name: /메모$/ }).click()
    await saved(page, () => row.getByRole('textbox').fill('가상그린발전소 2호기 기준'))

    await page.getByRole('button', { name: '이메일 텍스트 복사' }).click()
    const dialog = page.getByRole('dialog', { name: '데이터 요청 이메일' })
    const preview = dialog.getByTestId('email-preview')

    await expect(preview).toHaveValue(/^HRSG 성능 진단을 위해 아래 데이터를 요청드립니다\./)
    await expect(preview).toHaveValue(/\[A\. 가스터빈\/운전\]\n- A-02 운전 배압/)
    await expect(preview).not.toHaveValue(/- A-01 /) // 수령한 항목은 빠짐
    await expect(preview).not.toHaveValue(/가상그린|PLANT-A/) // 메모는 넣지 않는다
    await expect(dialog).toContainText('요청 항목 48개')

    await dialog.getByRole('button', { name: '클립보드에 복사' }).click()
    await expect(page.getByTestId('toast')).toContainText('이메일 텍스트를 복사했습니다 (요청 항목 48개)')
    // Windows 클립보드는 줄바꿈을 CRLF로 돌려준다
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard.replace(/\r\n/g, '\n')).toBe(await preview.inputValue())

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('계산기 핀치 "데이터 필요" → 체크리스트 B 분류·HP 항목 강조', async ({ page }) => {
    await openChecklist(page)
    await page.goto('/calculator')
    const panel = page.getByRole('complementary', { name: '입력 조정' })
    await panel.getByRole('button', { name: /고급 입력/ }).click()
    await panel.getByRole('button', { name: 'HP 드럼 압력 비우기' }).click()
    await page.getByRole('tab', { name: /^핀치/ }).click()
    const hp = page.getByTestId('pinch-HP')
    await expect(hp).toHaveAttribute('data-status', 'insufficient_data')
    await hp.getByRole('link', { name: '체크리스트에서 데이터 요청' }).click()

    await expect(page).toHaveURL(/\/checklist$/)
    const section = page.getByTestId('section-B')
    await expect(section).toHaveAttribute('data-highlighted', 'true')
    await expect(section).toBeInViewport()
    await expect(item(page, 'B-02')).toHaveAttribute('data-highlighted', 'true') // sections.HP.drum_barg
    await expect(item(page, 'B-10')).not.toHaveAttribute('data-highlighted', 'true') // sections.IP
    // 강조는 잠시 뒤 사라진다
    await expect(section).not.toHaveAttribute('data-highlighted', 'true', { timeout: 8000 })
  })

  test('서버 저장 실패 → 임시 저장 배너 → 다시 저장', async ({ page }) => {
    await openChecklist(page)
    await page.route('**/api/checklist/items/**', (route) => route.abort())
    await tick(item(page, 'A-01').getByRole('checkbox'))
    await expect(page.getByRole('alert').filter({ hasText: '임시 저장' })).toBeVisible()
    await expect(page.getByTestId('progress-percent')).toHaveText('2%') // 낙관적 업데이트는 유지

    await page.unroute('**/api/checklist/items/**')
    await saved(page, () => page.getByRole('button', { name: '다시 저장' }).click())
    await expect(page.getByRole('alert').filter({ hasText: '임시 저장' })).toBeHidden()
    await page.reload()
    await expect(item(page, 'A-01')).toHaveAttribute('data-checked', 'true')
  })
})

test.describe('모바일 360px', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true })

  test('진행률은 스크롤해도 상단 고정, 하단 FAB → 전체 화면 이메일 다이얼로그', async ({ page }) => {
    await openChecklist(page)
    await page.mouse.wheel(0, 1500)
    await expect(progress(page)).toBeInViewport()

    const fab = page.getByRole('button', { name: '이메일 복사' })
    const fabBox = await fab.boundingBox()
    const tabBar = await page.getByRole('navigation', { name: '주요 메뉴' }).boundingBox()
    expect(fabBox!.y + fabBox!.height).toBeLessThanOrEqual(tabBar!.y)

    await fab.tap()
    const dialog = page.getByRole('dialog', { name: '데이터 요청 이메일' })
    await expect(dialog.getByTestId('email-preview')).toHaveValue(/^HRSG 성능 진단/)
    const box = await dialog.boundingBox()
    expect(box!.width).toBe(360)
    expect(box!.height).toBe(740)

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('항목은 2줄 구성 — 상태·메모가 화면 안에 들어온다', async ({ page }) => {
    await openChecklist(page)
    const row = item(page, 'A-02')
    const rowBox = (await row.boundingBox())!
    for (const control of [row.getByRole('combobox'), row.getByRole('button', { name: /메모$/ })]) {
      const b = (await control.boundingBox())!
      expect(b.x + b.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1)
      expect(b.height).toBeGreaterThanOrEqual(44) // 터치 영역 (R-9)
    }
  })
})
