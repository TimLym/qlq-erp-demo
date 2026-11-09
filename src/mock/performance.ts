import { orders } from './data'

/*
 * 首頁儀表板的業績與 KPI 資料。
 * 業績以 SO 成立月份認列（soNo 的年月）。Demo 只建了幾張 SO，其餘月份用 salesHistory 補齊，
 * 當成舊 ERP 轉入的接單紀錄；正式版全部由 SO 成立認列，KPI 存在 hr.sales_target（每人每月一筆）。
 */
export const YEAR = 2026
export const THIS_MONTH = 10
export const BONUS_RATE = 0.08 // 待確認：獎金率與計算基礎（業務毛利、收款後認列）
/** Demo 存五年：今年之外的年度全部是舊 ERP 轉入、已收款的紀錄 */
export const YEARS = [2026, 2025, 2024, 2023, 2022] as const
export const lastMonthOf = (year: number) => (year === YEAR ? THIS_MONTH : 12)

export const depts = ['北區業務', '南區業務'] as const
export type Dept = (typeof depts)[number]

export interface SalesRep {
  id: string
  name: string
  dept: Dept
  role: '業務' | '業務主管'
}
/** 有業績責任額的人：主管自己也有個人目標；南區兩位業務只出現在儀表板彙總，不在示範身分清單 */
export const salesReps: SalesRep[] = [
  { id: 'u-chen', name: '陳冠宇', dept: '北區業務', role: '業務' },
  { id: 'u-lin', name: '林雅婷', dept: '北區業務', role: '業務主管' },
  { id: 'u-chang', name: '張怡君', dept: '南區業務', role: '業務主管' },
  { id: 'u-lee', name: '李承翰', dept: '南區業務', role: '業務' },
  { id: 'u-wu', name: '吳佩珊', dept: '南區業務', role: '業務' },
]

/** 每人每月 KPI（接單金額）：今年的月目標，往前每年打折（公司逐年成長） */
const baseTargets: Record<string, number> = { 'u-chen': 1_000_000, 'u-lin': 600_000, 'u-chang': 500_000, 'u-lee': 800_000, 'u-wu': 700_000 }
const yearScale: Record<number, number> = { 2022: 0.7, 2023: 0.78, 2024: 0.85, 2025: 0.92, 2026: 1 }
export function kpiTargets(userId: string, year: number): number[] {
  const base = baseTargets[userId] ?? 0
  return Array(12).fill(Math.round((base * (yearScale[year] ?? 1)) / 10_000) * 10_000)
}

export interface HistoryEntry {
  userId: string
  month: string // YYYY-MM
  amount: number
  margin: number
  /** 已收款才算已發放獎金 */
  collected: boolean
}
const h = (userId: string, m: number, amount: number, margin: number, collected = true): HistoryEntry => ({
  userId,
  month: `${YEAR}-${String(m).padStart(2, '0')}`,
  amount,
  margin,
  collected,
})
export const salesHistory: HistoryEntry[] = [
  h('u-chen', 1, 820_000, 110_000), h('u-chen', 2, 1_150_000, 160_000), h('u-chen', 3, 640_000, 90_000), h('u-chen', 4, 1_280_000, 170_000),
  h('u-chen', 5, 910_000, 120_000), h('u-chen', 6, 1_020_000, 140_000), h('u-chen', 8, 460_000, 60_000),
  h('u-lin', 1, 520_000, 70_000), h('u-lin', 2, 380_000, 50_000), h('u-lin', 3, 660_000, 88_000), h('u-lin', 4, 450_000, 60_000),
  h('u-lin', 6, 720_000, 96_000), h('u-lin', 7, 300_000, 40_000), h('u-lin', 8, 540_000, 70_000), h('u-lin', 10, 220_000, 30_000, false),
  h('u-chang', 1, 420_000, 55_000), h('u-chang', 2, 510_000, 66_000), h('u-chang', 3, 380_000, 50_000), h('u-chang', 4, 600_000, 80_000),
  h('u-chang', 5, 450_000, 58_000), h('u-chang', 6, 530_000, 70_000), h('u-chang', 7, 470_000, 62_000), h('u-chang', 8, 610_000, 80_000),
  h('u-chang', 9, 520_000, 68_000, false), h('u-chang', 10, 180_000, 24_000, false),
  h('u-lee', 1, 760_000, 100_000), h('u-lee', 2, 880_000, 115_000), h('u-lee', 3, 690_000, 90_000), h('u-lee', 4, 920_000, 120_000),
  h('u-lee', 5, 810_000, 105_000), h('u-lee', 6, 1_050_000, 140_000), h('u-lee', 7, 740_000, 95_000), h('u-lee', 8, 860_000, 110_000),
  h('u-lee', 9, 930_000, 120_000, false), h('u-lee', 10, 410_000, 55_000, false),
  h('u-wu', 1, 540_000, 70_000), h('u-wu', 2, 610_000, 80_000), h('u-wu', 3, 700_000, 92_000), h('u-wu', 4, 580_000, 75_000),
  h('u-wu', 5, 660_000, 85_000), h('u-wu', 6, 720_000, 95_000), h('u-wu', 7, 650_000, 85_000), h('u-wu', 8, 590_000, 78_000),
  h('u-wu', 9, 740_000, 97_000, false), h('u-wu', 10, 260_000, 35_000, false),
]

/** 往年紀錄：用固定雜湊生出每人每月的接單（目標的 55%～135%），同一組輸入永遠同一個數字 */
function seeded(key: string) {
  let h = 2166136261
  for (const c of key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 1000) / 1000
}
export function historyFor(userId: string, year: number): HistoryEntry[] {
  if (year === YEAR) return salesHistory.filter((e) => e.userId === userId)
  if (!YEARS.includes(year as (typeof YEARS)[number])) return []
  const target = kpiTargets(userId, year)[0] ?? 0
  return Array.from({ length: 12 }, (_, i) => {
    const r = seeded(`${userId}/${year}/${i + 1}`)
    const amount = Math.round((target * (0.55 + r * 0.8)) / 10_000) * 10_000
    const margin = Math.round((amount * (0.12 + seeded(`m/${userId}/${year}/${i + 1}`) * 0.03)) / 1000) * 1000
    return { userId, month: `${year}-${String(i + 1).padStart(2, '0')}`, amount, margin, collected: true }
  })
}

export interface MonthRow {
  month: number // 1..12
  actual: number
  target: number
  margin: number
  collectedMargin: number
}
export interface Summary {
  year: number
  /** 這一年算到哪個月：今年是本月，往年是 12 月 */
  lastMonth: number
  months: MonthRow[]
  month: MonthRow // 本月（往年是 12 月）
  ytdActual: number
  ytdTarget: number
  yearTarget: number
  /** 年初至今的業務毛利與其中已收款的部分 */
  margin: number
  collectedMargin: number
  /** 已發放：已收款訂單的毛利 × 獎金率 */
  bonusPaid: number
  /** 待收款：已接單但還沒收款的毛利 × 獎金率 */
  bonusPending: number
  /** 預估年度：已接單毛利 × 獎金率，加上剩餘月份目標依年初至今毛利率推估 */
  bonusEstimate: number
}

const monthOfSo = (soNo: string) => Number(soNo.slice(8, 10))
const yearOfSo = (soNo: string) => Number(soNo.slice(3, 7))

/** 一個人某一年的逐月業績：SO 成立的訂單 + 歷史紀錄，對上 KPI */
export function repMonths(rep: SalesRep, year = YEAR): MonthRow[] {
  const targets = kpiTargets(rep.id, year)
  const history = historyFor(rep.id, year)
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const row: MonthRow = { month: m, actual: 0, target: targets[i] ?? 0, margin: 0, collectedMargin: 0 }
    orders
      .filter((o) => o.owner === rep.name && yearOfSo(o.soNo) === year && monthOfSo(o.soNo) === m)
      .forEach((o) => {
        const margin = o.amount - o.cost
        const received = o.milestones.filter((x) => x.status === '已收款').reduce((s, x) => s + x.amount, 0)
        row.actual += o.amount
        row.margin += margin
        if (received >= o.amount) row.collectedMargin += margin
      })
    history
      .filter((e) => e.month === `${year}-${String(m).padStart(2, '0')}`)
      .forEach((e) => {
        row.actual += e.amount
        row.margin += e.margin
        if (e.collected) row.collectedMargin += e.margin
      })
    return row
  })
}

function sumMonths(lists: MonthRow[][]): MonthRow[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    actual: lists.reduce((s, l) => s + (l[i]?.actual ?? 0), 0),
    target: lists.reduce((s, l) => s + (l[i]?.target ?? 0), 0),
    margin: lists.reduce((s, l) => s + (l[i]?.margin ?? 0), 0),
    collectedMargin: lists.reduce((s, l) => s + (l[i]?.collectedMargin ?? 0), 0),
  }))
}

export function summarize(months: MonthRow[], year = YEAR): Summary {
  const last = lastMonthOf(year)
  const ytd = months.filter((r) => r.month <= last)
  const ytdActual = ytd.reduce((s, r) => s + r.actual, 0)
  const ytdTarget = ytd.reduce((s, r) => s + r.target, 0)
  const yearTarget = months.reduce((s, r) => s + r.target, 0)
  const marginAll = months.reduce((s, r) => s + r.margin, 0)
  const marginRate = ytdActual ? marginAll / ytdActual : 0
  const remainingTarget = months.filter((r) => r.month > last).reduce((s, r) => s + r.target, 0)
  const collectedMargin = months.reduce((s, r) => s + r.collectedMargin, 0)
  return {
    year,
    lastMonth: last,
    months,
    month: months[last - 1]!,
    ytdActual,
    ytdTarget,
    yearTarget,
    margin: marginAll,
    collectedMargin,
    bonusPaid: Math.round(collectedMargin * BONUS_RATE),
    bonusPending: Math.round((marginAll - collectedMargin) * BONUS_RATE),
    bonusEstimate: Math.round((marginAll + remainingTarget * marginRate) * BONUS_RATE),
  }
}

export function repSummary(userId: string, year = YEAR): Summary | null {
  const rep = salesReps.find((r) => r.id === userId)
  return rep ? summarize(repMonths(rep, year), year) : null
}
export function deptSummary(dept: Dept, year = YEAR): Summary {
  return repsSummary(salesReps.filter((r) => r.dept === dept), year)
}
export function companySummary(year = YEAR): Summary {
  return repsSummary(salesReps, year)
}
export function deptOf(userId: string): Dept | null {
  return salesReps.find((r) => r.id === userId)?.dept ?? null
}
/** 看得到哪些人的業績：業務只看自己、業務主管看同事業部、執行長與財務主管看全公司（首頁與業績頁共用） */
export function repsFor(userId: string, role: string): SalesRep[] {
  if (role === '業務') return salesReps.filter((r) => r.id === userId)
  if (role === '業務主管') {
    const d = deptOf(userId)
    return d ? salesReps.filter((r) => r.dept === d) : []
  }
  return salesReps
}
/** 幾個人加總後的彙總 */
export function repsSummary(reps: SalesRep[], year = YEAR): Summary {
  return summarize(sumMonths(reps.map((r) => repMonths(r, year))), year)
}
export const monthKey = (m: number, year = YEAR) => `${year}-${String(m).padStart(2, '0')}`
export { monthOfSo, yearOfSo }
