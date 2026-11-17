import { reactive } from 'vue'
import { navGroups } from '../nav'
import type { Role } from './data'

/*
 * 角色與頁面權限（2026-11-17 規劃）：每個導覽頁一格，無／檢視／操作。
 * 只管「進不進得去這一頁、能不能在這頁做事」；看得到哪幾張單（資料範圍）與金額遮蔽另外由 store 判斷。
 * 預設值由原本 nav.ts 的角色設定轉成；系統管理「角色與權限」頁可改，儲存即生效並留異動紀錄。
 */
export type PermLevel = 'none' | 'view' | 'edit'
export const permLabel: Record<PermLevel, string> = { none: '無', view: '檢視', edit: '操作' }

export const ALL_ROLES: Role[] = ['業務', '業務主管', '業務最高主管', '執行長', '採購', '採購主管', '財務主管', '會計', '工程主管', '工程師', '系統管理員']

export interface PageDef {
  path: string
  label: string
  group: string
  /** 所有角色固定可進（首頁），矩陣不能改 */
  fixed?: boolean
}
/** 權限矩陣頁本身 */
export const PERM_PAGE = '/admin/permissions'

export const pageDefs: PageDef[] = navGroups.flatMap((g) =>
  g.items.map((it) => ({ path: it.path, label: it.label, group: g.single ? it.label : g.label, fixed: it.path === '/' })),
)

/* 原本 nav.ts 允許、但只該「檢視」的組合 */
const VIEW_ONLY: Record<string, Role[]> = {
  '/sales/orders': ['採購', '工程主管', '工程師'],
  '/sales/customers': ['採購'],
  '/sales/performance': ['業務', '業務主管', '財務主管'],
  '/purchase/po': ['業務', '業務主管', '會計', '財務主管'],
  '/purchase/transfer-prices': ['財務主管'],
  '/inventory': ['業務', '業務主管', '財務主管'],
  '/inventory/shipments': ['業務', '業務主管'],
  '/inventory/licenses': ['採購'],
}
/* 目前沒有人的角色（由代理人切換過去），預設比照相近的角色 */
const LIKE: Partial<Record<Role, Role>> = { 採購主管: '採購', 業務最高主管: '業務主管' }

function navAllows(role: Role, path: string): boolean {
  const g = navGroups.find((x) => x.items.some((it) => it.path === path))
  const it = g?.items.find((x) => x.path === path)
  if (!g || !it) return false
  return (!g.roles || g.roles.includes(role)) && (!it.roles || it.roles.includes(role))
}
function defaultLevel(role: Role, path: string): PermLevel {
  const base = LIKE[role] ?? role
  if (path === PERM_PAGE) return role === '執行長' || role === '系統管理員' ? 'edit' : 'none'
  if (!navAllows(base, path)) return 'none'
  return VIEW_ONLY[path]?.includes(base) ? 'view' : 'edit'
}
export function defaultMatrix(): Record<Role, Record<string, PermLevel>> {
  const m = {} as Record<Role, Record<string, PermLevel>>
  ALL_ROLES.forEach((r) => {
    m[r] = {}
    pageDefs.forEach((p) => (m[r][p.path] = defaultLevel(r, p.path)))
  })
  return m
}

export const permMatrix = reactive(defaultMatrix())

export interface PermChange {
  at: string
  by: string
  role: Role
  path: string
  from: PermLevel
  to: PermLevel
}
export const permLog: PermChange[] = reactive([])

/** 網址對應的頁面；不在導覽裡的頁（通知中心、個人設定、外部頁）回 undefined，表示不受矩陣管 */
export const pageOf = (path: string): PageDef | undefined => pageDefs.find((p) => p.path === path)
/** 系統管理員對權限矩陣頁固定可操作，避免把自己鎖在外面 */
export const isLocked = (role: Role, path: string) => path === '/' || (role === '系統管理員' && path === PERM_PAGE)
