/**
 * 팀 공통 계산기·체크리스트 키트(hrsg_calc_kit_team2) README 「기대값」 표 중 계산기(탭 1~3) — 화면에 그대로 나오는지 확인한다.
 * 항목마다 (기대값, 화면 값)을 test-results/kit-expected.json 에 남긴다.
 * 체크리스트·이메일 기대값은 서버 상태를 공유하는 e2e/checklist.spec.ts(순서대로 실행)에 있다.
 */
import { writeFileSync } from 'node:fs'

import { expect, type Locator, type Page, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1440, height: 1000 } })

const rows: { screen: string; item: string; expected: string; actual: string; ok: boolean }[] = []
test.afterAll(() => writeFileSync('test-results/kit-expected.json', JSON.stringify(rows, null, 1)))

/** 화면 값을 기록하고 기대값과 비교한다 */
async function check(screen: string, item: string, expected: string, actual: string | Promise<string>) {
  const value = (await actual).replace(/\s+/g, ' ').trim()
  // 화면 글자 사이 간격이 공백 문자가 아니라 CSS 여백인 곳이 있어 공백은 무시하고 비교한다
  const squash = (x: string) => x.replace(/\s+/g, '')
  const ok = squash(value).includes(squash(expected))
  rows.push({ screen, item, expected, actual: value, ok })
  expect.soft(ok, `${screen} · ${item}: 기대 "${expected}", 화면 "${value}"`).toBe(true)
}

const text = (l: Locator) => l.innerText()
const attr = (l: Locator, name: string) => l.getAttribute(name).then((v) => v ?? '')

async function openCalculator(page: Page, tab = 'loss') {
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto(`/calculator?tab=${tab}`)
  if (tab === 'loss') await expect(page.getByTestId('kpi-totalLoss-value')).not.toHaveText('–')
  if (tab === 'cleaning') await expect(page.getByTestId('badge-max-net-benefit')).toBeVisible()
  if (tab === 'pinch') await expect(page.getByTestId('perf-overall')).toBeVisible()
}

async function reset(page: Page, tab = 'loss') {
  await page.getByRole('button', { name: '선택한 모델의 설계값으로 초기화 (손실 0)' }).click()
  if (tab === 'loss') await expect(page.getByTestId('kpi-totalLoss-value')).toHaveText('0.00')
  if (tab === 'cleaning') await expect(page.getByTestId('badge-max-net-benefit')).toHaveCount(0)
}

test('탭 1 처음 화면 (예시 운전 상태)', async ({ page }) => {
  await openCalculator(page)
  const s = '탭 1 처음'
  for (const [key, label, value, status] of [
    ['gtBackPressure', 'GT 배압', '30', 'normal'],
    ['hrsgGasDp', 'HRSG 차압', '30', 'caution'],
    ['stackTemp', '스택', '95', 'normal'],
  ] as const) {
    const g = page.getByTestId(`gauge-${key}`)
    await check(s, `${label} 값·판정`, `${value} ${status}`, `${await attr(g, 'data-value')} ${await attr(g, 'data-status')}`)
  }
  await check(s, '종합 상태', '주의', text(page.getByTestId('kpi-status')))
  await check(s, '총 출력 손실', '1.89', text(page.getByTestId('kpi-totalLoss-value')))
  await check(s, '손실 분해', 'GT 1.08 · ST 0.81 MW', text(page.getByTestId('kpi-totalLoss')))
  await check(s, '연간 손실', '22.68억 원', text(page.getByTestId('kpi-annualLoss-value')))
  await check(s, '기계식 세정 회수 출력', '0.85 MW', text(page.getByTestId('recovery-recoveredPower')))
  await check(s, '기계식 세정 연간 회수', '10.21억 원', text(page.getByTestId('kpi-annualRecovery-value')))
  await check(s, '손실 대비 회수율', '45%', text(page.getByTestId('kpi-annualRecovery')))
  await check(s, '열회수 효율 (현재)', '86.3%', text(page.getByTestId('recovery-currentEff')))
  await check(s, '열회수 효율 (세정 후)', '86.7%', text(page.getByTestId('recovery-afterEff')))
  await check(s, '열회수 효율 (설계)', '87.2', attr(page.getByTestId('efficiency-chart'), 'data-design'))
  await check(s, '오염 지수', '41', text(page.getByTestId('kpi-status-value')))
})

test('탭 1 그래프 (처음 화면)', async ({ page }) => {
  await openCalculator(page)
  const s = '탭 1 그래프'
  const eff = page.getByTestId('efficiency-chart')
  await check(s, '효율 추이 점 개수', '13', attr(eff, 'data-points'))
  await check(s, '효율 추이 설계 → 현재', '87.2 → 86.3', `${await attr(eff, 'data-design')} → ${await attr(eff, 'data-current')}`)
  await check(s, '세정 후', '86.7', attr(eff, 'data-after'))
  const trend = page.getByTestId('trend-chart')
  await check(s, '감도 곡선 시작 (mbar:MW)', '15:0.81', attr(trend, 'data-first'))
  await check(s, '감도 곡선 끝 (mbar:MW)', '40:4.05', attr(trend, 'data-last'))
  await check(s, '주의 · 위험 · 현재', '27.5 · 32.5 · 30', `${await attr(trend, 'data-caution')} · ${await attr(trend, 'data-danger')} · ${await attr(trend, 'data-current-x')}`)
})

test('탭 1 초기화 (F-Class 설계)', async ({ page }) => {
  await openCalculator(page)
  await reset(page)
  const s = '탭 1 초기화'
  await check(s, '손실', '0.00', text(page.getByTestId('kpi-totalLoss-value')))
  await check(s, '오염 지수', '0', text(page.getByTestId('kpi-status-value')))
  await check(s, '종합 상태', '정상', text(page.getByTestId('kpi-status')))
})

const methodRow = (page: Page, name: string) => page.locator('table tbody tr').filter({ hasText: name })

test('탭 2 처음 화면', async ({ page }) => {
  await openCalculator(page, 'cleaning')
  const s = '탭 2 처음'
  await expect(page.locator('table tbody tr')).toHaveCount(4)
  await check(s, '「순편익 최대」 배지', '화학 세정', text(page.locator('tr', { has: page.getByTestId('badge-max-net-benefit') })))
  await check(s, '화학 세정 순편익', '11.86억 원', text(methodRow(page, '화학 세정')))
  for (const [name, cost, payback] of [
    ['기계식 세정', '3.25억 원', '3.54개월'],
    ['고압수 세정', '4.04억 원', '3.30개월'],
    ['드라이아이스 세정', '4.46억 원', '3.12개월'],
    ['화학 세정', '7.42억 원', '4.27개월'],
  ]) {
    const row = text(methodRow(page, name))
    await check(s, `${name} 비용`, cost, row)
    await check(s, `${name} 회수기간`, payback, row)
  }
})

test('탭 2 초기화', async ({ page }) => {
  await openCalculator(page, 'cleaning')
  await reset(page, 'cleaning')
  const s = '탭 2 초기화'
  const all = page.locator('table tbody tr')
  await expect(all).toHaveCount(4)
  const texts = await all.allInnerTexts()
  await check(s, '순편익 모두 마이너스', '4/4', `${texts.filter((t) => /-\d/.test(t.split('\t').at(-1) ?? '')).length}/4`)
  await check(s, '회수기간 「산출 불가」', '4/4', `${texts.filter((t) => t.includes('산출 불가')).length}/4`)
  await check(s, '「순편익 최대」 배지 없음', '0', String(await page.getByTestId('badge-max-net-benefit').count()))
})

test('탭 3 처음 화면', async ({ page }) => {
  await openCalculator(page, 'pinch')
  const s = '탭 3 처음'
  const hp = page.getByTestId('pinch-HP')
  await check(s, 'HP 핀치 · 어프로치 · 판정', '8.0℃ 5.0℃ normal', `${(await text(hp)).match(/\d+\.\d℃/g)?.slice(0, 3).filter((_, i) => i !== 1).join(' ')} ${await attr(hp, 'data-status')}`)
  await check(s, 'IP · LP', 'insufficient_data insufficient_data', `${await attr(page.getByTestId('pinch-IP'), 'data-status')} ${await attr(page.getByTestId('pinch-LP'), 'data-status')}`)
  await check(s, '종합', '설계 범위를 벗어난 지표가 있습니다', text(page.getByTestId('perf-overall-text')))
  await check(s, '스팀', '270 t/h', text(page.getByTestId('perf-steam')))
  await check(s, '열회수 효율', '86.3 %', text(page.getByTestId('perf-efficiency')))
  await check(s, '설계 대비', '0.85%p', text(page.getByTestId('perf-efficiency')))
  await check(s, '손실', '1.89 MW', text(page.getByTestId('perf-perfLoss')))
  await check(s, '세정 후 회복', '0.85 MW', text(page.getByTestId('perf-recovery')))
  await check(s, '세정 후 회복 비율', '45%', text(page.getByTestId('perf-recovery')))
  await check(s, '연간 손실', '22.68억 원', text(page.getByTestId('perf-annualLoss')))
  await check(s, '세정 비용', '3.25억 원', text(page.getByTestId('perf-cleaningCost')))
  await check(s, '세정 비용 공법', '기계식 세정', text(page.getByTestId('perf-cleaningCost')))
  await check(s, '투자 회수 기간', '3.54 개월', text(page.getByTestId('perf-payback')))
})
