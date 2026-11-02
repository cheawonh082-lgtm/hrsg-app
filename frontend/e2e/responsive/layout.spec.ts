/** 반응형 레이아웃 검수 (PRD §6.3 D) — 1주차: AppShell 골격 + 가로 넘침(V-01) 자동 검사 */
import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { width: 360, height: 740 }, // 소형 폰
  { width: 390, height: 844 }, // 일반 폰
  { width: 844, height: 390 }, // 폰 가로
  { width: 768, height: 1024 }, // 태블릿 세로
  { width: 1024, height: 768 }, // 태블릿 가로
  { width: 1280, height: 800 }, // 노트북
  { width: 1920, height: 1080 }, // 데스크톱
]
const PAGES = ['/', '/calculator', '/chat', '/checklist']
const LG = 1024

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, '페이지 가로 스크롤이 생기면 안 됨 (R-1)').toBeLessThanOrEqual(clientWidth)
}

async function openPage(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  if (path === '/calculator') {
    // 계산 결과와 차트까지 그려진 뒤 검사
    await expect(page.getByTestId('kpi-totalLoss-value')).toHaveText(/\d/)
    await expect(page.getByTestId('trend-chart').locator('canvas')).toBeVisible()
  }
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp, hasTouch: vp.width < LG })

    for (const path of PAGES) {
      test(`V-01 가로 넘침 없음 ${path}`, async ({ page }) => {
        await openPage(page, path)
        await expectNoHorizontalOverflow(page)
        await page.screenshot({ path: test.info().outputPath('page.png'), fullPage: true })
      })
    }

    test('내비게이션: lg 이상 좌측 사이드바, 미만 BottomTabBar + 메뉴 버튼', async ({ page }) => {
      await openPage(page, '/calculator')
      const sidebar = page.getByTestId('sidebar')
      const bottomNav = page.getByTestId('bottom-nav')
      const menuButton = page.getByRole('button', { name: '메뉴 열기' })
      if (vp.width >= LG) {
        await expect(sidebar).toBeVisible()
        await expect(sidebar.getByRole('link', { name: /^세정 공법별/ })).toBeVisible() // 계산기 하위 메뉴 펼침
        await expect(bottomNav).toBeHidden()
        await expect(menuButton).toBeHidden()
      } else {
        await expect(sidebar).toBeHidden()
        await expect(bottomNav).toBeVisible()
        await expect(menuButton).toBeVisible()
      }
    })

    test('MOCK 배너 표시', async ({ page }) => {
      await openPage(page, '/calculator')
      await expect(page.getByRole('status').filter({ hasText: 'MOCK DATA' })).toBeVisible()
    })
  })
}

test.describe('모바일 상호작용 (360px)', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true })

  test('하단 탭으로 화면 이동', async ({ page }) => {
    await openPage(page, '/calculator')
    await page.getByTestId('bottom-nav').getByRole('link', { name: '질문하기' }).tap()
    await expect(page).toHaveURL(/\/chat$/)
  })

  test('메뉴 드로어 → 계산기 하위 화면(세정 공법 비교)으로 이동', async ({ page }) => {
    await openPage(page, '/')
    await page.getByRole('button', { name: '메뉴 열기' }).tap()
    const drawer = page.getByRole('dialog', { name: '메뉴' })
    await drawer.getByRole('button', { name: '계산기 하위 메뉴' }).tap()
    await drawer.getByRole('link', { name: /^세정 공법별/ }).tap()
    await expect(page).toHaveURL(/\/calculator\?tab=cleaning$/)
    await expect(drawer).toBeHidden()
    await expect(page.getByRole('tab', { name: /^세정 공법별/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('V-08 영어 전환 후에도 넘침 없음', async ({ page }) => {
    await openPage(page, '/calculator')
    await page.getByRole('button', { name: 'EN' }).tap()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Performance & Economics Calculator')
    await expectNoHorizontalOverflow(page)
  })

  test('MOCK 배너 탭하면 전체 문구', async ({ page }) => {
    await openPage(page, '/calculator')
    await page.getByRole('button', { name: '안내 전체 보기' }).tap()
    await expect(page.getByRole('button', { name: '안내 접기' })).toContainText('표시 수치는 검증되지 않은 가상 값입니다')
  })

  test('테마 토글: 라이트 → 다크', async ({ page }) => {
    await openPage(page, '/calculator')
    const html = page.locator('html')
    const toggle = page.getByRole('button', { name: /^테마:/ })
    // 시스템 → 라이트 → 다크 순환
    while (!(await toggle.getAttribute('aria-label'))?.includes('라이트')) await toggle.tap()
    await expect(html).not.toHaveClass(/dark/)
    await toggle.tap()
    await expect(html).toHaveClass(/dark/)
  })
})
