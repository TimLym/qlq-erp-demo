import type { Role } from './mock/data'

export type Phase = 1 | 2 | 3 | 'ext' | 'tbd'

export interface NavItem {
  label: string
  path: string
  /** 已有畫面的頁面為 true，其餘導向規劃說明頁 */
  ready?: boolean
  notes?: string[]
  /** 看得到這一頁的角色；不填代表所有人 */
  roles?: Role[]
}

export interface NavGroup {
  key: string
  label: string
  base: string
  phase: Phase
  items: NavItem[]
  /** 看得到整個群組的角色；不填代表所有人（再依項目各自過濾） */
  roles?: Role[]
  /** 單一項目的群組：不顯示群組標題、不能收合，例如首頁 */
  single?: boolean
}

export const phaseLabel: Record<Phase, string> = {
  1: '一期',
  2: '二期',
  3: '三期',
  ext: '外部',
  tbd: '待決',
}

export const navGroups: NavGroup[] = [
  {
    key: 'home',
    label: '首頁',
    base: '/',
    phase: 1,
    single: true,
    items: [{ label: '首頁', path: '/', ready: true }],
  },
  {
    key: 'approvals',
    label: '簽核中心',
    base: '/approvals',
    phase: 1,
    items: [
      { label: '我待簽核', path: '/approvals', ready: true },
      { label: '等待他人', path: '/approvals/mine', ready: true },
      { label: '簽核歷程', path: '/approvals/history', ready: true },
      { label: '等待簽收', path: '/approvals/signoff', ready: true },
      { label: '附件總覽', path: '/approvals/files', ready: true },
    ],
  },
  {
    key: 'sales',
    label: '業務',
    base: '/sales',
    phase: 1,
    items: [
      /* 上單送審從導覽拿掉：從商機抽屜的「上單送審」進入；下一階段整合進抽屜 */
      { label: '潛在商機（Pipeline）', path: '/sales/pipeline', ready: true },
      { roles: ['業務', '業務主管', '執行長', '採購', '財務主管', '會計', '工程主管', '工程師'], label: '銷售訂單（SO）', path: '/sales/orders', ready: true },
      { roles: ['業務', '業務主管', '執行長', '採購'], label: '客戶管理（CRM）', path: '/sales/customers', ready: true },
      { roles: ['業務', '業務主管', '執行長', '財務主管'], label: '業績與獎金', path: '/sales/performance', ready: true },
    ],
  },
  {
    key: 'purchase',
    label: '採購',
    base: '/purchase',
    phase: 1,
    items: [
      { roles: ['業務', '業務主管', '執行長', '採購', '財務主管', '會計'], label: '採購單（PO）', path: '/purchase/po', ready: true },
      { roles: ['採購', '執行長'], label: 'PO 分配', path: '/purchase/allocate', ready: true },
      { roles: ['採購', '財務主管', '執行長'], label: '料號與品項參考成本', path: '/purchase/transfer-prices', ready: true },
      { roles: ['業務', '業務主管', '採購', '財務主管', '會計', '執行長'], label: '供應商主檔', path: '/purchase/vendors', ready: true },
    ],
  },
  {
    key: 'inventory',
    label: '庫存與授權',
    base: '/inventory',
    phase: 1,
    items: [
      /* 業務從 SO 抽屜的「交付與授權」看自己訂單的出貨與授權到期；跨訂單的庫存與出貨作業台留給採購、主管 */
      { roles: ['業務', '業務主管', '執行長', '採購', '財務主管'], label: '庫存查詢', path: '/inventory', ready: true },
      { roles: ['採購', '執行長'], label: '進貨單', path: '/inventory/receipts', notes: ['供應商出貨單簽收', '批次成本建立'] },
      { roles: ['業務', '業務主管', '採購', '執行長'], label: '出貨單', path: '/inventory/shipments', ready: true },
      { roles: ['業務', '業務主管', '採購', '執行長'], label: '到期項目', path: '/inventory/licenses', ready: true },
    ],
  },
  {
    key: 'reports',
    label: '報表',
    base: '/reports',
    phase: 1,
    items: [
      { roles: ['業務主管', '執行長', '財務主管'], label: '毛利分析', path: '/reports/margin', notes: ['依案件、部門、業務', '原始與最終金額對照'] },
      { roles: ['業務主管', '執行長'], label: 'Pipeline 統計', path: '/reports/pipeline', notes: ['依階段、機率加權金額'] },
      { roles: ['採購', '財務主管', '會計', '執行長'], label: '採購與付款狀態', path: '/reports/purchase', notes: ['預付、分期、到期'] },
    ],
  },
  {
    key: 'engineering',
    label: '工程',
    base: '/engineering',
    phase: 2,
    roles: ['業務主管', '執行長', '工程主管', '工程師', '系統管理員'],
    items: [
      { label: '派工與指派', path: '/engineering/dispatch', notes: ['工程主管派工、多點施工追蹤'] },
      { label: '專案協作', path: '/engineering/collab', notes: ['專案看板、交辦事項、會議決議追蹤', '現行系統的內部協作、內部會議、專案管理板歸入此處'] },
      { label: '客戶入口', path: '/engineering/portal', notes: ['客戶註冊裝置、授權查詢'] },
    ],
  },
  {
    key: 'accounting',
    label: '財務會計',
    base: '/accounting',
    phase: 3,
    roles: ['財務主管', '會計', '執行長', '系統管理員'],
    items: [
      { label: '傳票與日記賬', path: '/accounting/vouchers', notes: ['自動生成、連結憑證附件'] },
      { label: '應收應付', path: '/accounting/ar-ap', notes: ['收款沖帳、付款作業'] },
      { label: '銀行對帳與借款', path: '/accounting/bank', notes: ['銀行 API 交易明細、借款額度與撥款'] },
      { label: '電子發票', path: '/accounting/einvoice', notes: ['開立與作廢'] },
    ],
  },
  {
    key: 'admin-apps',
    label: '行政申請',
    base: '/apps',
    phase: 'tbd',
    single: true,
    items: [{ label: '行政申請', path: '/apps', ready: true }],
  },
  {
    key: 'admin',
    label: '系統管理',
    base: '/admin',
    phase: 1,
    items: [
      { roles: ['執行長', '財務主管', '系統管理員'], label: '簽核進度設定', path: '/admin/approval-rules', ready: true },
      { roles: ['業務主管', '執行長', '系統管理員'], label: '離職業務交接', path: '/admin/handover', ready: true },
      { roles: ['執行長', '系統管理員'], label: '到期類型', path: '/admin/expiry-kinds', ready: true },
      { roles: ['執行長', '系統管理員', '業務主管'], label: '自有服務項目', path: '/admin/own-services', ready: true },
      { roles: ['執行長', '系統管理員'], label: '使用者與部門', path: '/admin/users', notes: ['帳號只停用不刪除', '離職指定承接人，代辦自動轉移'] },
      { roles: ['執行長', '財務主管', '系統管理員'], label: '審計紀錄', path: '/admin/audit', notes: ['誰、何時、改了哪些欄位、前後值', '可匯出 Excel'] },
      { roles: ['執行長', '系統管理員'], label: '同步作業監控', path: '/admin/sync', notes: ['與現行 ERP 的同步批次與差異報表'] },
    ],
  },
]

/** 依角色過濾後的導覽：群組沒有任何項目就整組不顯示 */
export function navForRole(role: Role): NavGroup[] {
  return navGroups
    .filter((g) => !g.roles || g.roles.includes(role))
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.roles || it.roles.includes(role)) }))
    .filter((g) => g.items.length > 0)
}

export const allNavItems: { group: NavGroup; item: NavItem }[] = navGroups.flatMap((group) =>
  group.items.map((item) => ({ group, item })),
)

export function findNavItem(path: string): { group: NavGroup; item: NavItem } | undefined {
  return allNavItems.find((x) => x.item.path === path)
}
