/** 체크리스트 E2E (PRD §6.3 C: K-01~K-04, D: 모바일 FAB) — 실제 서버 상태 파일을 쓰므로 매번 초기화 */
import { expect, type Page, test } from '@playwright/test'

// 상태 파일 하나를 공유하므로 이 파일의 테스트는 순서대로 실행한다
test.describe.configure({ mode: 'serial' })

const progress = (page: Page) => page.getByTestId('checklist-progress')
const item = (page: Page, id: string) => page.getByTestId(`item-${id}`)

async function openChecklist(page: Page) {
  await page.request.post('/api/checklist/reset')
  await page.goto('/checklist')
  await page.evaluate(() => localStorage.removeItem('hrsg-checklist-pending'))
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

  test('K-01 체크 → 진행률 즉시 갱신 → 새로고침 후 유지', async ({ page }) => {
    await openChecklist(page)
    const gt = item(page, 'gt.model')
    await saved(page, () => tick(gt.getByRole('checkbox')))

    await expect(gt).toHaveAttribute('data-checked', 'true')
    await expect(gt.getByRole('combobox')).toHaveValue('received')
    await expect(page.getByTestId('progress-percent')).toHaveText('4%')
    await expect(page.getByTestId('progress-required')).toHaveText('필수 1/13')
    await expect(page.getByTestId('progress-gas_turbine')).toContainText('1/4')

    await page.reload()
    await expect(item(page, 'gt.model')).toHaveAttribute('data-checked', 'true')
    await expect(page.getByTestId('progress-percent')).toHaveText('4%')
  })

  test('상태 드롭다운: 받음=자동 체크, 해당 없음=진행률 분모에서 제외', async ({ page }) => {
    await openChecklist(page)
    await saved(page, () => item(page, 'exh.temp').getByRole('combobox').selectOption('received'))
    await expect(item(page, 'exh.temp')).toHaveAttribute('data-checked', 'true')

    await saved(page, () => item(page, 'doc.pid').getByRole('combobox').selectOption('na'))
    await expect(progress(page)).toContainText('(1/25)')
    await expect(item(page, 'doc.pid').getByRole('checkbox')).toBeDisabled()
  })

  test('메모 입력은 자동 저장되고 새로고침 후에도 남는다', async ({ page }) => {
    await openChecklist(page)
    const row = item(page, 'gt.back_pressure')
    await row.getByRole('button', { name: /메모$/ }).click()
    await saved(page, () => row.getByRole('textbox').fill('DCS 태그 PT-101 확인 중'))

    await page.reload()
    await expect(item(page, 'gt.back_pressure').getByRole('textbox')).toHaveValue('DCS 태그 PT-101 확인 중')
  })

  test('필터·검색·섹션 전체 체크', async ({ page }) => {
    await openChecklist(page)
    await page.getByRole('button', { name: '필수', exact: true }).click()
    await expect(page.locator('[data-testid^="item-"]')).toHaveCount(13)

    await page.getByRole('button', { name: '전체', exact: true }).click()
    await page.getByRole('searchbox', { name: '항목 검색' }).fill('스택')
    await expect(page.locator('[data-testid^="item-"]')).toHaveCount(1)
    await page.getByRole('searchbox', { name: '항목 검색' }).fill('')

    await tick(page.getByRole('checkbox', { name: '가스터빈 전체 체크' }))
    await expect(page.getByTestId('section-gas_turbine')).toContainText('4/4')
    await page.getByRole('button', { name: '미완료', exact: true }).click()
    await expect(page.getByTestId('section-gas_turbine')).toHaveCount(0)
  })

  test('K-02~K-04 이메일 미리보기: 미완료·ko / en / 실명 미포함 → 클립보드 복사', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openChecklist(page)
    await saved(page, () => tick(item(page, 'gt.model').getByRole('checkbox')))
    const row = item(page, 'exh.hrsg_dp')
    await row.getByRole('button', { name: /메모$/ }).click()
    await saved(page, () => row.getByRole('textbox').fill('가상그린발전소 2호기 기준'))

    await page.getByRole('button', { name: '이메일 텍스트 복사' }).click()
    const dialog = page.getByRole('dialog', { name: '데이터 요청 이메일' })
    const preview = dialog.getByTestId('email-preview')

    // K-02 미완료 항목만, 카테고리별 번호 목록
    await expect(preview).toHaveValue(/^제목: \[HRSG 성능 진단\]/)
    await expect(preview).toHaveValue(/안녕하세요, 고객사 담당자님\./)
    await expect(preview).toHaveValue(/■ 가스터빈\n {2}1\. 부하별 운전 이력 \[필수\]/)
    await expect(preview).not.toHaveValue(/GT 모델 및 정격 출력/)
    await expect(dialog).toContainText('요청 항목 25개')

    // K-04 메모 포함 시에도 실명 대신 별칭
    await dialog.getByLabel(/메모 포함/).check()
    await expect(preview).toHaveValue(/메모: PLANT-A UNIT-X 기준/)
    await expect(preview).not.toHaveValue(/가상그린/)

    // K-03 영어 템플릿
    await dialog.getByLabel('이메일 언어').selectOption('en')
    await expect(preview).toHaveValue(/^Subject: \[HRSG performance review\]/)
    await expect(preview).toHaveValue(/Dear Customer contact,/)

    await dialog.getByRole('button', { name: '클립보드에 복사' }).click()
    await expect(page.getByTestId('toast')).toContainText('이메일 텍스트를 복사했습니다 (요청 항목 25개)')
    // Windows 클립보드는 줄바꿈을 CRLF로 돌려준다
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard.replace(/\r\n/g, '\n')).toBe(await preview.inputValue())

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('계산기 핀치 "데이터 필요" → 체크리스트 핀치 섹션·관련 항목 강조', async ({ page }) => {
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
    const section = page.getByTestId('section-pinch_approach')
    await expect(section).toHaveAttribute('data-highlighted', 'true')
    await expect(section).toBeInViewport()
    await expect(item(page, 'pinch.evap_gas_out')).toHaveAttribute('data-highlighted', 'true')
    await expect(item(page, 'fw.drum_pressure')).not.toHaveAttribute('data-highlighted', 'true')
    // 강조는 잠시 뒤 사라진다
    await expect(section).not.toHaveAttribute('data-highlighted', 'true', { timeout: 8000 })
  })

  test('서버 저장 실패 → 임시 저장 배너 → 다시 저장', async ({ page }) => {
    await openChecklist(page)
    await page.route('**/api/checklist/items/**', (route) => route.abort())
    await tick(item(page, 'gt.model').getByRole('checkbox'))
    await expect(page.getByRole('alert').filter({ hasText: '임시 저장' })).toBeVisible()
    await expect(page.getByTestId('progress-percent')).toHaveText('4%') // 낙관적 업데이트는 유지

    await page.unroute('**/api/checklist/items/**')
    await saved(page, () => page.getByRole('button', { name: '다시 저장' }).click())
    await expect(page.getByRole('alert').filter({ hasText: '임시 저장' })).toBeHidden()
    await page.reload()
    await expect(item(page, 'gt.model')).toHaveAttribute('data-checked', 'true')
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
    await expect(dialog.getByTestId('email-preview')).toHaveValue(/제목:/)
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
    const row = item(page, 'gt.back_pressure')
    const rowBox = (await row.boundingBox())!
    for (const control of [row.getByRole('combobox'), row.getByRole('button', { name: /메모$/ })]) {
      const b = (await control.boundingBox())!
      expect(b.x + b.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1)
      expect(b.height).toBeGreaterThanOrEqual(44) // 터치 영역 (R-9)
    }
  })
})
