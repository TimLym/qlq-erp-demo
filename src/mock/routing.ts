import { reactive } from 'vue'
import { users, type Role, type ApprovalStep } from './data'

/*
 * 簽核路由設定（圖形模型）
 *
 * 1. 要簽核的功能先「註冊」一筆單據類型：代號、名稱、分組，以及「判斷因子」
 *    （送審時這張單能交給引擎的欄位，每個有型別：金額、百分比、天數、是否、列舉）。
 * 2. 每種單據一張圖：起點、角色節點、終點，用線接順序。一個節點可以拉出多條線：
 *    有條件的線先比（依順序），命中就走；沒有條件的那條是預設。這一個規則涵蓋了「多一關」與「跳過一關」。
 *    一條線可以掛多個條件，任一成立就走（例如 PO 金額達 100 萬「或」成本異動都加執行長）。
 *    線上的條件只能從該單據註冊的因子來組，所以請假不會出現金額。
 * 3. 送審那一刻 evaluate() 從起點走到終點，走出來的角色序列寫進簽核單；之後改設定只影響新送的單。
 *    必填說明、附件、審核標示不進這裡，寫在各送審畫面的程式裡。
 *
 * 新功能要接簽核：在 docTypes 加一筆（正式版是一列資料），送審時把因子值丟給 evaluate()。引擎與設定頁不用改。
 */

export type FactKind = '金額' | '百分比' | '天數' | '是否' | '列舉'
export interface Fact {
  key: string
  label: string
  kind: FactKind
  options?: string[]
}

export type DocGroup = '業務' | '採購' | '財務' | '行政'
export interface DocTypeDef {
  key: string
  label: string
  group: DocGroup
  desc: string
  /** 送審的來源畫面，給註冊表看 */
  source: string
  facts: Fact[]
}

/** 「直屬主管」在送審時依申請人換成實際角色 */
export type Step = Role | '直屬主管'
export type Op = '≥' | '<' | '低於門檻' | '是' | '否' | '屬於'

/** 節點上的「誰來簽」：任一人＝該角色所有人收到、一人核准即可；依申請人＝申請人同部門的該角色；指定人＝固定一位 */
export type AssignMode = '任一人' | '依申請人' | '指定人'
export interface Assign {
  mode: AssignMode
  userId?: string
  /** 代理人：這個角色沒有人時由他簽（高層預先指定，業務不能改） */
  proxyUserId?: string
}

export interface Condition {
  fact: string
  op: Op
  /** 數字：金額／百分比／天數；字串：列舉「是」；陣列：列舉「屬於」 */
  value?: number | string | string[]
}

export interface RouteNode {
  id: string
  kind: 'start' | 'end' | 'role'
  role?: Step
  assign?: Assign
  x: number
  y: number
}

export interface RouteEdge {
  id: string
  from: string
  to: string
  /** 有條件的線依這個順序比對，小的先 */
  priority: number
  /** 沒有條件＝預設線；多個條件任一成立即走 */
  conds?: Condition[]
  note?: string
}

export interface DocRouting {
  docType: string
  nodes: RouteNode[]
  edges: RouteEdge[]
}

export interface RoutingConfig {
  version: number
  updatedAt: string
  updatedBy: string
  /** 低毛利門檻（小數），百分比因子的「低於門檻」用它 */
  lowMarginThreshold: number
  docs: DocRouting[]
}

export const STEP_OPTIONS: Step[] = ['直屬主管', '業務主管', '業務最高主管', '執行長', '採購', '採購主管', '財務主管', '會計']
export const OPS_BY_KIND: Record<FactKind, Op[]> = {
  金額: ['≥', '<'],
  天數: ['≥', '<'],
  百分比: ['≥', '<', '低於門檻'],
  是否: ['是', '否'],
  列舉: ['是', '屬於'],
}

/* ---------- 單據類型註冊表 ---------- */

export const docTypes: DocTypeDef[] = [
  {
    key: '上單', label: '上單', group: '業務', desc: '業務送審報價版本。', source: '上單送審頁',
    facts: [
      { key: 'margin', label: '整案毛利率', kind: '百分比' },
      { key: 'amount', label: '金額', kind: '金額' },
      { key: 'useStock', label: '用庫存', kind: '是否' },
      { key: 'insistBuy', label: '有庫存仍另行採購', kind: '是否' },
      { key: 'collision', label: '撞單', kind: '是否' },
    ],
  },
  {
    key: 'PO', label: 'PO', group: '採購', desc: '採購向供應商下單。', source: '採購單列表「建立 PO」',
    facts: [
      { key: 'amount', label: '金額', kind: '金額' },
      { key: 'preOrder', label: '預下單', kind: '是否' },
      { key: 'costBreach', label: '成本異動', kind: '是否' },
      { key: 'newVendor', label: '新供應商', kind: '是否' },
    ],
  },
  {
    key: '預付', label: '預付', group: '業務', desc: '業務在商機提出預付款。', source: '商機抽屜「申請預付款」',
    facts: [
      { key: 'amount', label: '金額', kind: '金額' },
      { key: 'ratio', label: '預付比例', kind: '百分比' },
    ],
  },
  {
    key: '供應商建檔', label: '供應商建檔', group: '採購', desc: '新供應商或銀行帳號異動。', source: '供應商主檔',
    facts: [
      { key: 'bankChange', label: '變更銀行帳號', kind: '是否' },
      { key: 'overseas', label: '境外供應商', kind: '是否' },
    ],
  },
  {
    key: '品項參考成本', label: '品項參考成本', group: '採購', desc: '採購提出庫存品項參考成本異動。', source: '料號與品項參考成本',
    facts: [
      { key: 'amount', label: '新品項參考成本', kind: '金額' },
      { key: 'changePct', label: '異動幅度', kind: '百分比' },
    ],
  },
  {
    key: '報帳與代墊款', label: '報帳與代墊款', group: '行政', desc: '月度報帳。', source: '行政申請',
    facts: [
      { key: 'amount', label: '金額', kind: '金額' },
      { key: 'kind', label: '類別', kind: '列舉', options: ['交通', '餐費', '住宿', '客戶招待', '代墊採購', '其他'] },
      { key: 'onProject', label: '掛到案子', kind: '是否' },
    ],
  },
  {
    key: '請假與出勤', label: '請假與出勤', group: '行政', desc: '請假、出勤補登。', source: '行政申請',
    facts: [
      { key: 'kind', label: '假別', kind: '列舉', options: ['特休', '事假', '病假', '公假', '出勤補登'] },
      { key: 'days', label: '天數', kind: '天數' },
      { key: 'crossMonth', label: '跨月', kind: '是否' },
      { key: 'agentSet', label: '已指定代理人', kind: '是否' },
    ],
  },
  {
    key: '用印名片與請購', label: '用印名片與請購', group: '行政', desc: '用印、名片、內部請購、固定支出。', source: '行政申請',
    facts: [
      { key: 'kind', label: '項目', kind: '列舉', options: ['用印（合約）', '用印（投標文件）', '名片', '內部請購', '固定支出'] },
      { key: 'amount', label: '金額', kind: '金額' },
    ],
  },
]

export const docTypeOf = (key: string) => docTypes.find((d) => d.key === key)
export const factOf = (docKey: string, factKey: string) => docTypeOf(docKey)?.facts.find((f) => f.key === factKey)

/* ---------- 現行設定：圖 ---------- */

const X = (col: number) => 40 + col * 190
const MAIN = 90
const BRANCH = 210
const S = (): RouteNode => ({ id: 'start', kind: 'start', role: undefined, x: X(0), y: MAIN })
const E = (col: number): RouteNode => ({ id: 'end', kind: 'end', x: X(col), y: MAIN })
const N = (role: Step, col: number, y = MAIN): RouteNode => ({ id: `n-${role}`, kind: 'role', role, x: X(col), y })
const L = (from: string, to: string, priority = 0, conds?: Condition[], note?: string): RouteEdge => ({ id: `${from}>${to}`, from, to, priority, conds, note })

export const routing = reactive<RoutingConfig>({
  version: 3,
  updatedAt: '2026-09-01',
  updatedBy: '系統管理員',
  lowMarginThreshold: 0.05,
  docs: [
    {
      docType: '上單',
      /* 內控：至少三關三個不同人。第三關採購主管目前沒有人，由財務主管劉欣怡代理；撞單硬上單時加業務最高主管裁決（不是被撞單業務的主管） */
      nodes: [S(), { ...N('業務主管', 1), assign: { mode: '依申請人' } }, { ...N('業務最高主管', 2, MAIN - 120), assign: { mode: '任一人', proxyUserId: 'u-wang' } }, N('執行長', 3, BRANCH), N('採購', 4), { ...N('採購主管', 5), assign: { mode: '任一人', proxyUserId: 'u-liu' } }, E(6)],
      edges: [
        L('start', 'n-業務主管'),
        L('n-業務主管', 'n-業務最高主管', 1, [{ fact: 'collision', op: '是' }], '撞單硬要上單，由業務最高主管裁決'),
        L('n-業務主管', 'n-執行長', 2, [{ fact: 'margin', op: '<', value: 0 }], '負毛利先給執行長，避免採購白審'),
        L('n-業務主管', 'n-採購'),
        L('n-業務最高主管', 'n-執行長', 1, [{ fact: 'margin', op: '<', value: 0 }], '負毛利先給執行長'),
        L('n-業務最高主管', 'n-採購'),
        L('n-執行長', 'n-採購'),
        L('n-採購', 'n-採購主管'),
        L('n-採購主管', 'end'),
      ],
    },
    {
      docType: 'PO',
      nodes: [S(), N('業務主管', 1, BRANCH), N('財務主管', 2), N('執行長', 3, BRANCH), E(4)],
      edges: [
        L('start', 'n-業務主管', 1, [{ fact: 'preOrder', op: '是' }], '預下單要業務主管先認'),
        L('start', 'n-財務主管'),
        L('n-業務主管', 'n-財務主管'),
        L('n-財務主管', 'n-執行長', 1, [{ fact: 'amount', op: '≥', value: 1_000_000 }, { fact: 'costBreach', op: '是' }], '大額或實際成本高於報價版本且毛利掉到門檻以下'),
        L('n-財務主管', 'end'),
        L('n-執行長', 'end'),
      ],
    },
    {
      docType: '預付',
      nodes: [S(), N('業務主管', 1), N('執行長', 2, BRANCH), N('財務主管', 3), E(4)],
      edges: [
        L('start', 'n-業務主管'),
        L('n-業務主管', 'n-執行長', 1, [{ fact: 'amount', op: '≥', value: 500_000 }]),
        L('n-業務主管', 'n-財務主管'),
        L('n-執行長', 'n-財務主管'),
        L('n-財務主管', 'end'),
      ],
    },
    {
      docType: '供應商建檔',
      nodes: [S(), N('會計', 1), N('採購', 2), N('執行長', 3), E(4)],
      edges: [L('start', 'n-會計'), L('n-會計', 'n-採購'), L('n-採購', 'n-執行長'), L('n-執行長', 'end')],
    },
    {
      docType: '品項參考成本',
      nodes: [S(), N('財務主管', 1), E(2)],
      edges: [L('start', 'n-財務主管'), L('n-財務主管', 'end')],
    },
    {
      docType: '報帳與代墊款',
      nodes: [S(), N('直屬主管', 1), N('會計', 2), E(3)],
      edges: [L('start', 'n-直屬主管'), L('n-直屬主管', 'n-會計'), L('n-會計', 'end')],
    },
    {
      docType: '請假與出勤',
      nodes: [S(), N('直屬主管', 1), N('執行長', 2, BRANCH), E(3)],
      edges: [L('start', 'n-直屬主管'), L('n-直屬主管', 'n-執行長', 1, [{ fact: 'days', op: '≥', value: 5 }]), L('n-直屬主管', 'end'), L('n-執行長', 'end')],
    },
    {
      docType: '用印名片與請購',
      nodes: [S(), N('直屬主管', 1), N('財務主管', 2, BRANCH), E(3)],
      edges: [L('start', 'n-直屬主管'), L('n-直屬主管', 'n-財務主管', 1, [{ fact: 'amount', op: '≥', value: 20_000 }]), L('n-直屬主管', 'end'), L('n-財務主管', 'end')],
    },
  ],
})

export interface RoutingHistory {
  version: number
  at: string
  by: string
  summary: string
}

export const routingHistory = reactive<RoutingHistory[]>([
  { version: 3, at: '2026-09-01', by: '系統管理員', summary: '上單：負毛利在業務主管後改走執行長' },
  { version: 2, at: '2026-06-15', by: '系統管理員', summary: 'PO：金額達 100 萬加執行長；預付：金額達 50 萬加執行長' },
  { version: 1, at: '2026-05-01', by: '系統管理員', summary: '初版：上單、PO、預付、供應商建檔、申請類' },
])

/* ---------- 引擎 ---------- */

/** 送審時交給引擎的因子值：百分比用 0–100 的數字 */
export type Facts = Record<string, number | string | boolean | undefined>

export interface EvalContext {
  facts?: Facts
  /** 用來換算「直屬主管」 */
  applicantRole?: Role
  /** 用來算「依申請人」的候選人 */
  applicantId?: string
}

export interface EvalResult {
  route: Role[]
  /** 走過的節點 id（含起點終點） */
  path: string[]
  /** 走過的線 id */
  edges: string[]
  /** 命中的條件線，給畫面說明用 */
  applied: { id: string; text: string }[]
  /** 每一關誰來簽（與 route 同長度） */
  steps: ApprovalStep[]
}

export const managerOf = (r: Role): Role => (r === '業務' ? '業務主管' : r === '會計' ? '財務主管' : '執行長')

export function hits(c: Condition, facts: Facts, threshold: number): boolean {
  const v = facts[c.fact]
  switch (c.op) {
    case '≥':
      return typeof v === 'number' && v >= Number(c.value ?? 0)
    case '<':
      return typeof v === 'number' && v < Number(c.value ?? 0)
    case '低於門檻':
      return typeof v === 'number' && v < threshold * 100
    case '是':
      return v === true || (typeof v === 'string' && v === c.value)
    case '否':
      return v === false || v === undefined
    case '屬於':
      return typeof v === 'string' && Array.isArray(c.value) && c.value.includes(v)
  }
}

const concrete = (n: RouteNode, ctx: EvalContext): Role => (n.role === '直屬主管' ? managerOf(ctx.applicantRole ?? '業務') : (n.role as Role))

export const assignModeOf = (n: RouteNode): AssignMode => n.assign?.mode ?? (n.role === '直屬主管' ? '依申請人' : '任一人')

/** 節點上顯示的小字 */
export function assignText(n: RouteNode): string {
  const m = assignModeOf(n)
  if (m === '依申請人') return '依申請人部門'
  if (m === '指定人') return `指定 ${users.find((u) => u.id === n.assign?.userId)?.name ?? '（未選）'}`
  return ''
}

/** 算出這一關的候選人 */
export function resolveStep(n: RouteNode, role: Role, ctx: EvalContext): ApprovalStep {
  const m = assignModeOf(n)
  const proxy = n.assign?.proxyUserId ? users.find((x) => x.id === n.assign!.proxyUserId) : undefined
  if (proxy && m !== '指定人' && !users.some((x) => x.role === role)) {
    return { role, mode: m, candidateIds: [proxy.id], label: `代理 ${proxy.name}（缺${role}）`, proxy: true }
  }
  if (m === '指定人') {
    const u = users.find((x) => x.id === n.assign?.userId)
    if (u) return { role, mode: m, candidateIds: [u.id], label: `指定 ${u.name}` }
  }
  if (m === '依申請人') {
    const applicant = users.find((x) => x.id === ctx.applicantId)
    const same = applicant ? users.filter((x) => x.role === role && x.dept === applicant.dept) : []
    if (same.length) return { role, mode: m, candidateIds: same.map((x) => x.id), label: `依申請人部門（${applicant!.dept}）：${same.map((x) => x.name).join('、')}` }
    const any = users.filter((x) => x.role === role)
    return { role, mode: m, candidateIds: any.length ? any.map((x) => x.id) : undefined, label: `依申請人部門找不到${role}，改任一位${role}` }
  }
  return { role, mode: '任一人', label: `任一位${role}` }
}

export const isDefault = (e: RouteEdge) => !e.conds || e.conds.length === 0
/** 線的條件是否命中：任一成立 */
export const edgeHits = (e: RouteEdge, facts: Facts, threshold: number) => isDefault(e) || e.conds!.some((c) => hits(c, facts, threshold))

/** 一個節點的出線：有條件的依順序在前，預設線最後 */
export function outgoing(doc: DocRouting, nodeId: string): RouteEdge[] {
  return doc.edges.filter((e) => e.from === nodeId).sort((a, b) => Number(isDefault(a)) - Number(isDefault(b)) || a.priority - b.priority)
}

export function evaluate(docType: string, ctx: EvalContext = {}, cfg: RoutingConfig = routing): EvalResult {
  const doc = cfg.docs.find((d) => d.docType === docType)
  if (!doc) return { route: [], path: [], edges: [], applied: [], steps: [] }
  const facts = ctx.facts ?? {}
  const route: Role[] = []
  const steps: ApprovalStep[] = []
  const path: string[] = ['start']
  const edges: string[] = []
  const applied: EvalResult['applied'] = []
  let cur = 'start'
  for (let guard = 0; guard < 30 && cur !== 'end'; guard++) {
    const outs = outgoing(doc, cur)
    const next = outs.find((e) => edgeHits(e, facts, cfg.lowMarginThreshold))
    if (!next) break
    const n = doc.nodes.find((x) => x.id === next.to)
    if (!n) break
    edges.push(next.id)
    path.push(n.id)
    if (!isDefault(next)) applied.push({ id: next.id, text: `${edgeText(docType, next, cfg.lowMarginThreshold)} → ${n.kind === 'end' ? '直接結束' : n.role}` })
    if (n.kind === 'role') {
      const r = concrete(n, ctx)
      route.push(r)
      steps.push(resolveStep(n, r, ctx))
    }
    cur = n.id
  }
  /* 代理人剛好也是另一關唯一的簽核人（例：王承恩代理業務最高主管，又是執行長）→ 併成一關，避免同一人簽兩關卡死 */
  const sole = (s: ApprovalStep) => {
    if (s.candidateIds) return s.candidateIds.length === 1 ? s.candidateIds[0] : undefined
    const only = users.filter((u) => u.role === s.role)
    return only.length === 1 ? only[0]!.id : undefined
  }
  for (let i = steps.length - 1; i > 0; i--) {
    const who = sole(steps[i]!)
    const j = who ? steps.findIndex((s, k) => k < i && sole(s) === who) : -1
    if (j < 0) continue
    steps[j] = { ...steps[j]!, label: `${steps[j]!.label}，兼${route[i]}` }
    steps.splice(i, 1)
    route.splice(i, 1)
  }
  return { route, path, edges, applied, steps }
}

/** 相容舊呼叫 */
export const resolveRoute = evaluate

/* ---------- 文字 ---------- */

const num = (v: unknown) => Number(v ?? 0).toLocaleString('zh-TW')

export function conditionText(docType: string, c: Condition, threshold = routing.lowMarginThreshold): string {
  const f = factOf(docType, c.fact)
  const label = f?.label ?? c.fact
  switch (c.op) {
    case '低於門檻':
      return `${label} < ${Math.round(threshold * 1000) / 10}%`
    case '≥':
    case '<':
      return `${label} ${c.op} ${num(c.value)}${f?.kind === '百分比' ? '%' : f?.kind === '天數' ? ' 天' : ''}`
    case '是':
      return f?.kind === '列舉' ? `${label}是「${c.value}」` : label
    case '否':
      return `未${label}`
    case '屬於':
      return `${label}屬於 ${(Array.isArray(c.value) ? c.value : []).join('／')}`
  }
}

/** 一條線的條件文字：多個條件用「或」接 */
export const edgeText = (docType: string, e: RouteEdge, threshold = routing.lowMarginThreshold) => (e.conds ?? []).map((c) => conditionText(docType, c, threshold)).join(' 或 ')

export const nodeLabel = (n: RouteNode | undefined) => (!n ? '？' : n.kind === 'start' ? '起點' : n.kind === 'end' ? '終點' : (n.role as string))

export interface Description {
  /** 只走預設線的路徑（角色） */
  standard: Step[]
  reachedEnd: boolean
  branches: { edgeId: string; cond: string; path: Step[]; reachedEnd: boolean; note?: string }[]
  /** 誰來簽不是「任一人」的節點 */
  assignments: string[]
  problems: string[]
  warnings: string[]
}

/** 從某節點只走預設線，回傳經過的節點 id（不含起始節點） */
function defaultWalk(doc: DocRouting, from: string): { ids: string[]; reachedEnd: boolean } {
  const ids: string[] = []
  let cur = from
  for (let g = 0; g < 30 && cur !== 'end'; g++) {
    const d = outgoing(doc, cur).find(isDefault)
    if (!d) return { ids, reachedEnd: false }
    ids.push(d.to)
    cur = d.to
  }
  return { ids, reachedEnd: cur === 'end' }
}

export function describe(doc: DocRouting, cfg: RoutingConfig = routing): Description {
  const nodeOf = (id: string) => doc.nodes.find((n) => n.id === id)
  const steps = (ids: string[]): Step[] => ids.map(nodeOf).filter((n): n is RouteNode => !!n && n.kind === 'role').map((n) => n.role as Step)
  const std = defaultWalk(doc, 'start')
  const problems: string[] = []
  const warnings: string[] = []
  if (!std.reachedEnd) problems.push('標準路由（只走預設線）沒有連到終點')
  for (const n of doc.nodes) {
    if (n.kind === 'end') continue
    const outs = doc.edges.filter((e) => e.from === n.id)
    const defaults = outs.filter(isDefault)
    if (defaults.length === 0) problems.push(`「${nodeLabel(n)}」沒有預設的下一步`)
    if (defaults.length > 1) problems.push(`「${nodeLabel(n)}」有 ${defaults.length} 條預設線，只能一條`)
    if (n.kind === 'role' && !doc.edges.some((e) => e.to === n.id)) warnings.push(`「${nodeLabel(n)}」沒有線連進來，不會被走到`)
  }
  const branches: Description['branches'] = doc.edges
    .filter((e) => !isDefault(e))
    .sort((a, b) => a.priority - b.priority)
    .map((e) => {
      const before = defaultWalk(doc, 'start')
      const i = e.from === 'start' ? -1 : before.ids.indexOf(e.from)
      const prefix = e.from === 'start' ? [] : i >= 0 ? before.ids.slice(0, i + 1) : [e.from]
      const after = defaultWalk(doc, e.to)
      return { edgeId: e.id, cond: edgeText(doc.docType, e, cfg.lowMarginThreshold), path: steps([...prefix, e.to, ...after.ids]), reachedEnd: after.reachedEnd, note: e.note }
    })
  const assignments = doc.nodes.filter((n) => n.kind === 'role' && assignText(n)).map((n) => `${n.role}：${assignText(n)}`)
  return { standard: steps(std.ids), reachedEnd: std.reachedEnd, branches, assignments, problems, warnings }
}
