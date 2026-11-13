/*
 * 部門名稱檢查（1112 會議 #6）：新增商機與客戶主檔新增部門共用。
 * 常見發包單位字眼（採購、總務…）要改填發起需求的單位；和既有部門很像（包含、去掉部處室後相同、編輯距離 1）時提醒是不是同一個單位。
 */
export const GENERIC_DEPT = ['採購', '總務', '行政', '管理部', '管理處']

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length]![b.length]!
}
export function similarDept(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  const strip = (x: string) => x.replace(/[部處室組課]|中心/g, '')
  if (strip(a) && strip(a) === strip(b)) return true
  return Math.min(a.length, b.length) >= 3 && distance(a, b) <= 1
}
export function deptWarningOf(name: string, existing: string[]): string {
  const n = name.trim()
  if (!n) return ''
  if (GENERIC_DEPT.some((k) => n.includes(k))) return `「${n}」通常是發包單位，請填發起需求的單位（例如資訊部）`
  const near = existing.find((d) => d !== n && similarDept(d, n))
  return near ? `和既有部門「${near}」很像，請確認是不是同一個單位` : ''
}
