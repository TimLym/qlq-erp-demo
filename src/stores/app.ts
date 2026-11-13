import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { applyTheme, readSavedTheme, type ThemeId } from '../theme'
import {
  users,
  todos as seedTodos,
  approvals as seedApprovals,
  notifications as seedNotifications,
  announcements as seedAnnouncements,
  attachments as seedAttachments,
  orders,
  quotes,
  deals,
  purchaseOrders,
  milestonesFromTemplate,
  stock,
  transferPrices,
  transferChanges,
  vendors,
  applications,
  type Attachment,
  type Approval,
  type Role,
  type Todo,
  type Notification,
  type Order,
  vendorRenewalRules,
  ruleForSku,
  type VendorRenewalRule,
  dealMembers,
  comments as seedComments,
  type Comment,
  type Deal,
  type EngRequest,
  type User,
  type OrderLog,
  type Shipment,
  type License,
  customers,
  expiryKinds,
  natureOf,
  addMonths,
  addDays,
  quoteTaxTotal,
  quoteTotal,
  hasExpiryDate,
  stockHolds,
  HOLD_TODAY,
  type StockHold,
  engGroups,
  isIdle,
  stageIdleDays,
  IDLE_TODAY,
  isOrderClosed,
  shipments,
  orderLinesFromQuote,
  isGuarantee,
  type GuaranteeReason,
} from '../mock/data'

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export interface Delegate {
  enabled: boolean
  userId: string
  from: string
  to: string
}

/* 通知分類：鈴鐺下拉與通知中心共用的頁簽 */
export const NOTIFY_CATS = ['全部', '簽核', '提及與留言', '訂單與財務', '工程'] as const
export type NotifyCat = (typeof NOTIFY_CATS)[number]
/** 右下角重要通知卡：輪到我簽、被退回、被提及 */
export interface ImportantItem {
  key: string
  label: string
  text: string
  tone: 'amber' | 'red' | 'teal'
  to: string
}

export const useAppStore = defineStore('app', () => {
  const theme = ref<ThemeId>(readSavedTheme())
  applyTheme(theme.value)
  function setTheme(id: ThemeId) {
    theme.value = id
    applyTheme(id)
  }

  const currentUserId = ref('u-lin')
  const currentUser = computed(() => users.find((u) => u.id === currentUserId.value)!)
  const role = computed<Role>(() => currentUser.value.role)

  const todos = ref<Todo[]>(seedTodos.map((t) => ({ ...t })))
  const approvals = ref<Approval[]>(seedApprovals.map((a) => ({ ...a, history: [...a.history] })))
  const notifications = ref<Notification[]>(seedNotifications.map((n) => ({ ...n })))

  const myTodos = computed(() =>
    todos.value.filter((t) => {
      if (t.forUserIds && t.forUserIds.length) return t.forUserIds.includes(currentUserId.value)
      return t.forRoles.includes(role.value)
    }),
  )

  const myNotifications = computed(() => notifications.value.filter((n) => (n.forUserIds && n.forUserIds.length ? n.forUserIds.includes(currentUserId.value) : n.forRoles.includes(role.value))))
  const unreadCount = computed(() => myNotifications.value.filter((n) => !n.read).length)

  /* 輪到我簽：角色對、候選人有我；代理的關卡看候選人。同一張單已核准過一關的人不能再簽（內控三關三人） */
  function canActOn(a: Approval): boolean {
    if (a.status !== '待簽核') return false
    const step = a.steps?.[a.currentStep]
    const cands = step?.candidateIds
    const mine = step?.proxy ? !!cands?.includes(currentUserId.value) : a.route[a.currentStep] === role.value && (!cands || cands.includes(currentUserId.value))
    if (!mine) return false
    /* 簽過別一關的人不能再簽；同一關被駁回回來可以重簽 */
    const me = currentUser.value
    return !a.history.some((h) => h.action === '核准' && (h.userId ? h.userId === me.id : h.name === me.name) && h.step !== a.currentStep)
  }
  const pendingForMe = computed(() => approvals.value.filter((a) => canActOn(a)))
  const submittedByMe = computed(() => approvals.value.filter((a) => a.submitterId === currentUserId.value))
  /** 我送出、還在等別人簽的 */
  const waitingOnOthers = computed(() => submittedByMe.value.filter((a) => a.status === '待簽核'))

  /* 我的最愛：存瀏覽器，正式版存 core 個人偏好 */
  const favorites = ref<string[]>(readJson(`erp.fav.${currentUserId.value}`, []))
  function isFavorite(path: string) {
    return favorites.value.includes(path)
  }
  function toggleFavorite(path: string) {
    favorites.value = isFavorite(path) ? favorites.value.filter((p) => p !== path) : [...favorites.value, path]
    writeJson(`erp.fav.${currentUserId.value}`, favorites.value)
  }

  /* 公告：置頂優先，再依時間新到舊 */
  const announcements = ref(seedAnnouncements.map((a) => ({ ...a })))
  const myAnnouncements = computed(() => [...announcements.value].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at)))

  /* 附件：單據上傳後統一進附件中心 */
  const attachments = ref<Attachment[]>(seedAttachments.map((a) => ({ ...a })))
  function addAttachment(a: Omit<Attachment, 'id' | 'uploader' | 'at' | 'scan' | 'hash'>) {
    const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
    const item: Attachment = {
      ...a,
      id: `f-${Date.now()}`,
      uploader: currentUser.value.name,
      at: new Date().toISOString(),
      scan: '通過',
      hash: `${hex()}…${hex()}`,
    }
    attachments.value.unshift(item)
    return item
  }

  /* 簽核代理人 */
  const delegate = ref<Delegate>(readJson(`erp.delegate.${currentUserId.value}`, { enabled: false, userId: '', from: '', to: '' }))
  function saveDelegate(d: Delegate) {
    delegate.value = { ...d }
    writeJson(`erp.delegate.${currentUserId.value}`, delegate.value)
  }

  /* 資料範圍分兩層：職務範圍（業務自己的、主管事業部、執行長全部）看得到金額；協作成員（被拉進來、被派工的）只看非金額資訊 */
  const membersOf = (dealId: string) => dealMembers.filter((m) => m.dealId === dealId)
  function accessOf(d: Deal): 'full' | 'member' | 'none' {
    const me = currentUserId.value
    const r = role.value
    if (r === '執行長' || r === '系統管理員') return 'full'
    if (d.ownerId === me) return 'full'
    if (r === '業務主管' && d.dept === currentUser.value.dept) return 'full'
    if (dealMembers.some((m) => m.dealId === d.id && m.userId === me)) return 'member'
    if (r === '工程主管' && (d.engRequests?.length ?? 0) > 0) return 'member'
    return 'none'
  }
  const scopedDeals = computed(() => deals.filter((d) => accessOf(d) !== 'none'))
  /* 業務看自己的；工程主管、工程師看自己參與案件的 SO（派工在 SO 做）；其他角色看全部 */
  const scopedOrders = computed(() =>
    role.value === '業務'
      ? orders.filter((o) => { if (o.owner === currentUser.value.name) return true; const d = deals.find((x) => x.id === o.dealId); return !!d && accessOf(d) !== 'none' })
      : ['工程主管', '工程師'].includes(role.value)
        ? orders.filter((o) => { const d = deals.find((x) => x.id === o.dealId); return !!d && accessOf(d) !== 'none' })
        : orders,
  )
  const memberOnlyRole = computed(() => ['採購', '財務主管', '會計', '工程主管', '工程師'].includes(role.value))
  const scopeNote = computed(() => (role.value === '業務' ? `只顯示 ${currentUser.value.name} 負責與被加入的` : memberOnlyRole.value ? '只顯示你被加入的商機' : '顯示部門全部的'))
  const canSeeMoney = (d: Deal) => accessOf(d) === 'full'
  /* SO 金額：工程看不到；業務只有負責或同事業部主管（完整權限）才看得到，協作成員看不到；採購、財務、會計、執行長看得到 */
  const canSeeOrderMoney = (o: Order) => {
    if (['工程主管', '工程師'].includes(role.value)) return false
    if (role.value === '業務' || role.value === '業務主管') {
      const d = deals.find((x) => x.id === o.dealId)
      return o.owner === currentUser.value.name || (!!d && accessOf(d) === 'full')
    }
    return true
  }
  const canManageMembers = (d: Deal) => accessOf(d) === 'full' && role.value !== '工程主管'
  function addMembers(d: Deal, userIds: string[]) {
    const now = new Date().toISOString()
    const added: User[] = []
    userIds.forEach((id) => {
      const u = users.find((x) => x.id === id)
      if (!u || u.role === '工程師' || d.ownerId === id || dealMembers.some((m) => m.dealId === d.id && m.userId === id)) return
      dealMembers.push({ dealId: d.id, userId: id, kind: '協作成員', addedById: currentUserId.value, addedAt: now })
      notifications.value.unshift({ id: `n-${Date.now()}-${id}`, kind: '系統', text: `${currentUser.value.name} 把你加入 ${d.customer} ${d.product} 商機，可以看留言與被提及`, at: now, read: false, forRoles: [u.role], forUserIds: [id] })
      added.push(u)
    })
    if (added.length) comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `將 ${added.map((u) => u.name).join('、')} 加入商機（協作成員）` })
    d.updatedAt = now
    return added
  }
  function removeMember(d: Deal, userId: string) {
    const i = dealMembers.findIndex((m) => m.dealId === d.id && m.userId === userId)
    if (i < 0) return
    const u = users.find((x) => x.id === userId)
    dealMembers.splice(i, 1)
    todos.value = todos.value.filter((t) => !(t.dealId === d.id && t.forUserIds?.includes(userId) && (t.kind === '回覆' || t.kind === '工程')))
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: new Date().toISOString(), text: `將 ${u?.name ?? userId} 移出商機` })
  }

  /* 留言放 store，Pipeline 的留言泡泡與未讀提及才算得出來 */
  const comments = ref<Comment[]>(seedComments.map((c) => ({ ...c })))
  const mentionRead = ref<Record<string, string[]>>({})
  const unreadMentions = (dealId: string) => comments.value.filter((c) => c.dealId === dealId && c.mentionIds?.includes(currentUserId.value) && !(mentionRead.value[c.id] ?? []).includes(currentUserId.value))
  const unreadMentionDeals = computed(() => scopedDeals.value.filter((d) => unreadMentions(d.id).length > 0))
  const unreadMentionTotal = computed(() => unreadMentionDeals.value.reduce((n, d) => n + unreadMentions(d.id).length, 0))
  function markMentionsRead(dealId: string) {
    unreadMentions(dealId).forEach((c) => { mentionRead.value = { ...mentionRead.value, [c.id]: [...(mentionRead.value[c.id] ?? []), currentUserId.value] } })
  }
  /** 商機的參與者：負責業務、該事業部主管、執行長、成員；留言 @ 只能提及這些人 */
  function participantsOf(d: Deal): User[] {
    return users.filter((u) => u.id === d.ownerId || u.role === '執行長' || (u.role === '業務主管' && u.dept === d.dept) || dealMembers.some((m) => m.dealId === d.id && m.userId === u.id) || (u.role === '工程主管' && (d.engRequests?.length ?? 0) > 0))
  }

  /* 技術服務單：一個商機多張，各自派工；工程師派過就留在「工程支援人員」裡（完成後還能留言），只有改派或取消讓他沒有任何單才離開 */
  const engRequestsOf = (d: Deal) => d.engRequests ?? []
  const shortNo = (t: EngRequest) => t.requestNo.slice(t.requestNo.lastIndexOf('-') + 1)
  function nextRequestNo(d: Deal) {
    const n = (d.engRequests ?? []).length + 1
    const so = orders.find((o) => o.dealId === d.id)
    return `${so ? so.soNo : d.dealNo}-T${String(n).padStart(2, '0')}`
  }
  function syncEngineerMembers(d: Deal) {
    const active = (d.engRequests ?? []).filter((t) => t.status === '待接受' || t.status === '已派工' || t.status === '已完成')
    users.filter((u) => u.role === '工程師').forEach((u) => {
      const ids = active.filter((t) => t.assigneeIds.includes(u.id)).map((t) => t.id)
      const idx = dealMembers.findIndex((m) => m.dealId === d.id && m.userId === u.id && m.kind === '工程師')
      if (ids.length && idx < 0) dealMembers.push({ dealId: d.id, userId: u.id, kind: '工程師', addedById: currentUserId.value, addedAt: new Date().toISOString(), engRequestIds: ids })
      else if (ids.length && idx >= 0) dealMembers[idx]!.engRequestIds = ids
      else if (!ids.length && idx >= 0) dealMembers.splice(idx, 1)
    })
    d.needsEng = (d.engRequests ?? []).some((t) => t.status !== '已取消')
  }
  /* 誰能派工：工程主管；派給組的單，組長也能派（只能派組內的人） */
  const groupOf = (t: EngRequest) => engGroups.find((g) => g.id === t.groupId)
  const canDispatch = (t: EngRequest) => ['待派工', '待接受', '已派工'].includes(t.status) && (role.value === '工程主管' || (!!groupOf(t) && groupOf(t)!.leaderId === currentUserId.value))
  /* 整張單回到待派工：清掉這一輪的人、接受紀錄與工程代辦 */
  function resetDispatch(t: EngRequest) {
    todos.value = todos.value.filter((x) => !((x.kind === '工程' || x.kind === '派工') && x.engRequestId === t.id))
    Object.assign(t, { status: '待派工', assigneeIds: [], acceptedIds: [], assignedAt: undefined, assignedById: undefined })
  }
  const isAccepted = (t: EngRequest, id: string) => t.status === '已派工' || t.status === '已完成' || !!t.acceptedIds?.includes(id)
  function pushDispatchTodo(d: Deal, t: EngRequest) {
    todos.value = todos.value.filter((x) => !(x.kind === '派工' && x.engRequestId === t.id))
    const g = groupOf(t)
    if (g) {
      todos.value.unshift({ id: `t-${Date.now()}-${t.id}-g`, kind: '派工', title: `待派工（${g.name}）${shortNo(t)}｜${t.type}｜${d.customer} ${t.title}`, refNo: d.dealNo, due: t.dueDate, forRoles: ['工程師'], forUserIds: [g.leaderId], dealId: d.id, engRequestId: t.id, route: `/sales/pipeline?deal=${d.id}`, createdAt: new Date().toISOString() })
      return
    }
    todos.value.unshift({ id: `t-${Date.now()}-${t.id}`, kind: '派工', title: `${t.urgent ? '【急件】' : ''}待派工 ${shortNo(t)}｜${t.type}｜${d.customer} ${t.title}`, refNo: d.dealNo, due: t.dueDate, forRoles: ['工程主管'], dealId: d.id, engRequestId: t.id, route: `/sales/pipeline?deal=${d.id}`, createdAt: new Date().toISOString() })
    notifications.value.unshift({ id: `n-${Date.now()}-${t.id}`, kind: '派工', text: `${currentUser.value.name} 開了服務單 ${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」，需求日期 ${t.dueDate}`, at: new Date().toISOString(), read: false, forRoles: ['工程主管'] })
  }
  function requestEngineering(d: Deal, form: { type: EngRequest['type']; title: string; desc: string; dueDate: string; urgent: boolean; suggestedId?: string; suggestReason?: string }) {
    const now = new Date().toISOString()
    const t: EngRequest = { id: `er-${Date.now()}`, requestNo: nextRequestNo(d), status: '待派工', type: form.type, title: form.title, desc: form.desc, dueDate: form.dueDate, urgent: form.urgent, requestedById: currentUserId.value, requestedBy: currentUser.value.name, requestedAt: now, assigneeIds: [] }
    if (form.suggestedId) Object.assign(t, { suggestedId: form.suggestedId, suggestReason: form.suggestReason || undefined })
    d.engRequests = [...(d.engRequests ?? []), t]
    d.updatedAt = now
    syncEngineerMembers(d)
    pushDispatchTodo(d, t)
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `開服務單 ${shortNo(t)}：${form.type}「${form.title}」，需求日期 ${form.dueDate}` })
    return t
  }
  function resubmitEngineering(d: Deal, t: EngRequest, form: { type: EngRequest['type']; title: string; desc: string; dueDate: string; urgent: boolean }) {
    const now = new Date().toISOString()
    resetDispatch(t)
    Object.assign(t, { ...form, status: '待派工', groupId: undefined, assignNote: undefined, rejectReason: undefined, requestedAt: now, requestedById: currentUserId.value, requestedBy: currentUser.value.name })
    d.updatedAt = now
    syncEngineerMembers(d)
    pushDispatchTodo(d, t)
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `${shortNo(t)} 補件後重送：${form.type}「${form.title}」` })
  }
  /* 派給組：組長收到派工代辦 */
  function assignToGroup(d: Deal, t: EngRequest, groupId: string, note: string) {
    const g = engGroups.find((x) => x.id === groupId)
    if (!g || role.value !== '工程主管' || !canDispatch(t)) return
    const now = new Date().toISOString()
    const prev = [...t.assigneeIds]
    resetDispatch(t)
    prev.forEach((id) => notifications.value.unshift({ id: `n-${Date.now()}-off-${id}`, kind: '派工', text: `${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」改交${g.name}派人，你不再負責這張服務單`, at: now, read: false, forRoles: ['工程師'], forUserIds: [id] }))
    syncEngineerMembers(d)
    t.groupId = groupId
    t.assignNote = note || undefined
    pushDispatchTodo(d, t)
    notifications.value.unshift({ id: `n-${now}-grp-${t.id}`, kind: '派工', text: `${currentUser.value.name} 把 ${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」交給${g.name}，請派人`, at: now, read: false, forRoles: ['工程師'], forUserIds: [g.leaderId] })
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `${shortNo(t)} 交給${g.name}（組長 ${users.find((u) => u.id === g.leaderId)?.name}）派人${note ? `，${note}` : ''}` })
  }
  /* 工程師接受：全部接受才變進行中 */
  function acceptEngineering(d: Deal, t: EngRequest) {
    const me = currentUserId.value
    if (t.status !== '待接受' || !t.assigneeIds.includes(me)) return
    const now = new Date().toISOString()
    t.acceptedIds = [...new Set([...(t.acceptedIds ?? []), me])]
    todos.value = todos.value.filter((x) => !(x.kind === '工程' && x.engRequestId === t.id && x.forUserIds?.includes(me)))
    todos.value.unshift({ id: `t-${Date.now()}-${t.id}-${me}-ok`, kind: '工程', title: `工程支援 ${shortNo(t)}｜${t.type}｜${d.customer} ${t.title}`, refNo: d.dealNo, due: t.dueDate, forRoles: ['工程師'], forUserIds: [me], dealId: d.id, engRequestId: t.id, route: `/sales/pipeline?deal=${d.id}`, createdAt: now })
    if (t.assigneeIds.every((id) => t.acceptedIds!.includes(id))) t.status = '已派工'
    if (t.assignedById) notifications.value.unshift({ id: `n-${Date.now()}-acc`, kind: '派工', text: `${currentUser.value.name} 已接受 ${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」`, at: now, read: false, forRoles: ['工程主管', '工程師'], forUserIds: [t.assignedById] })
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `接受 ${shortNo(t)}` })
  }
  /* 工程師婉拒：退回派工的人重派 */
  function declineEngineering(d: Deal, t: EngRequest, reason: string) {
    const me = currentUserId.value
    if (t.status !== '待接受' || !t.assigneeIds.includes(me)) return
    const now = new Date().toISOString()
    const assigner = t.assignedById
    const others = t.assigneeIds.filter((id) => id !== me)
    t.declines = [...(t.declines ?? []), { userId: me, reason, at: now }]
    resetDispatch(t)
    pushDispatchTodo(d, t)
    others.forEach((id) => notifications.value.unshift({ id: `n-${Date.now()}-re-${id}`, kind: '派工', text: `${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」有人婉拒，整張重新派工`, at: now, read: false, forRoles: ['工程師'], forUserIds: [id] }))
    syncEngineerMembers(d)
    t.assignedById = assigner
    if (t.assignedById) notifications.value.unshift({ id: `n-${Date.now()}-dec`, kind: '退回', text: `${currentUser.value.name} 婉拒 ${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」：${reason}`, at: now, read: false, forRoles: ['工程主管', '工程師'], forUserIds: [t.assignedById] })
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `婉拒 ${shortNo(t)}：${reason}` })
  }
  function assignEngineers(d: Deal, t: EngRequest, ids: string[], note: string): string[] {
    if (!canDispatch(t) || !ids.length) return []
    if (role.value !== '工程主管' && !ids.every((id) => groupOf(t)?.memberIds.includes(id))) return []
    const now = new Date().toISOString()
    const prev = [...t.assigneeIds]
    const names: string[] = []
    ids.forEach((id) => {
      const u = users.find((x) => x.id === id && x.role === '工程師')
      if (!u) return
      names.push(u.name)
      if (!prev.includes(id)) {
        todos.value.unshift({ id: `t-${Date.now()}-${t.id}-${id}`, kind: '工程', title: `待接受 ${shortNo(t)}｜${t.type}｜${d.customer} ${t.title}`, refNo: d.dealNo, due: t.dueDate, forRoles: ['工程師'], forUserIds: [id], dealId: d.id, engRequestId: t.id, route: `/sales/pipeline?deal=${d.id}`, createdAt: now })
        notifications.value.unshift({ id: `n-${Date.now()}-${t.id}-${id}`, kind: '派工', text: `${currentUser.value.name} 指派你負責 ${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」，需求日期 ${t.dueDate}`, at: now, read: false, forRoles: ['工程師'], forUserIds: [id] })
      }
    })
    prev.filter((id) => !ids.includes(id)).forEach((id) => {
      todos.value = todos.value.filter((x) => !(x.kind === '工程' && x.engRequestId === t.id && x.forUserIds?.includes(id)))
      notifications.value.unshift({ id: `n-${Date.now()}-off-${id}`, kind: '派工', text: `${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」已改派，你不再負責這張服務單`, at: now, read: false, forRoles: ['工程師'], forUserIds: [id] })
    })
    /* 已接受的人沿用；新派的人要接受，全部接受才是進行中 */
    const accepted = ids.filter((id) => prev.includes(id) && isAccepted(t, id))
    Object.assign(t, { status: accepted.length === ids.length ? '已派工' : '待接受', assigneeIds: ids, acceptedIds: accepted, assignedAt: now, assignedById: currentUserId.value, assignNote: note || t.assignNote, rejectReason: undefined })
    d.updatedAt = now
    todos.value = todos.value.filter((x) => !(x.kind === '派工' && x.engRequestId === t.id))
    syncEngineerMembers(d)
    notifications.value.unshift({ id: `n-${Date.now()}-owner`, kind: '派工', text: `${shortNo(t)}「${t.type}｜${t.title}」已派工給 ${names.join('、')}`, at: now, read: false, forRoles: ['業務'], forUserIds: [d.ownerId] })
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `${shortNo(t)} ${prev.length ? '改派' : '派工'}：${names.join('、')}${note ? `，${note}` : ''}` })
    return names
  }
  function rejectEngineering(d: Deal, t: EngRequest, reason: string) {
    const now = new Date().toISOString()
    Object.assign(t, { status: '已退回', rejectReason: reason })
    todos.value = todos.value.filter((x) => !(x.kind === '派工' && x.engRequestId === t.id))
    todos.value.unshift({ id: `t-${Date.now()}-engback`, kind: '回覆', title: `服務單 ${shortNo(t)} 被退回：${reason}`, refNo: d.dealNo, forRoles: ['業務'], forUserIds: [t.requestedById], dealId: d.id, engRequestId: t.id, route: `/sales/pipeline?deal=${d.id}`, createdAt: now })
    notifications.value.unshift({ id: `n-${Date.now()}-engback`, kind: '退回', text: `${currentUser.value.name} 退回 ${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」：${reason}`, at: now, read: false, forRoles: ['業務'], forUserIds: [t.requestedById] })
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `退回 ${shortNo(t)}：${reason}` })
  }
  function cancelEngineering(d: Deal, t: EngRequest, reason: string) {
    const now = new Date().toISOString()
    Object.assign(t, { status: '已取消', cancelReason: reason })
    todos.value = todos.value.filter((x) => !((x.kind === '派工' || x.kind === '工程') && x.engRequestId === t.id))
    syncEngineerMembers(d)
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `取消 ${shortNo(t)}：${reason}` })
  }
  function completeEngineering(d: Deal, t: EngRequest, done: { workSummary: string; arrivedAt: string; completedAt: string }) {
    const now = new Date().toISOString()
    Object.assign(t, { status: '已完成', workSummary: done.workSummary, arrivedAt: done.arrivedAt, completedAt: done.completedAt })
    todos.value = todos.value.filter((x) => !(x.kind === '工程' && x.engRequestId === t.id))
    syncEngineerMembers(d)
    notifications.value.unshift({ id: `n-${Date.now()}-done`, kind: '系統', text: `${currentUser.value.name} 已完成 ${shortNo(t)}「${t.type}｜${d.customer} ${t.title}」`, at: now, read: false, forRoles: ['業務'], forUserIds: [d.ownerId] })
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: role.value, at: now, text: `${shortNo(t)} 完成` })
  }
  /** Pipeline 摘要：待派工 N · 進行中 N · 共 N；排序權重給工程主管用 */
  function engSummary(d: Deal) {
    const ts = d.engRequests ?? []
    const pending = ts.filter((t) => t.status === '待派工')
    const active = ts.filter((t) => t.status === '已派工' || t.status === '待接受').length
    const done = ts.filter((t) => t.status === '已完成').length
    const returned = ts.filter((t) => t.status === '已退回').length
    const weight = pending.some((t) => t.urgent) ? 400 + pending.length : pending.length ? 300 + pending.length : returned ? 200 : active ? 100 + active : done ? 10 : 0
    return { total: ts.length, pending: pending.length, urgent: pending.some((t) => t.urgent), active, done, returned, weight }
  }

  /* 續約前提：原商機已有 SO（SO 只在上單核准後產生），而且還沒有進行中的續約商機 */
  /** 續約窗口（依原廠規則）：未開窗 → 續約窗口 → 急件 → 寬限中 → 已失效 */
  type RenewalWindow = '未開窗' | '續約窗口' | '急件' | '寬限中' | '已失效'
  function renewalWindow(left: number, rule: VendorRenewalRule): RenewalWindow {
    if (left > rule.openDays) return '未開窗'
    if (left > rule.urgentDays) return '續約窗口'
    if (left >= 0) return '急件'
    if (left >= -rule.graceDays) return '寬限中'
    return '已失效'
  }
  /* 授權狀態：剩餘天數、到期狀態、原廠規則、續約窗口、既有續約商機；授權到期頁與授權抽屜共用（Demo 以 2026-10-08 為今天） */
  const LICENSE_TODAY = new Date('2026-10-08')
  function licenseStatus(o: Order, l: License) {
    /* 未起算（工程還沒確認起算日）沒有剩餘天數：排在最後、不提醒 */
    const left = hasExpiryDate(l) ? Math.round((new Date(l.expires).getTime() - LICENSE_TODAY.getTime()) / 86400000) : Number.POSITIVE_INFINITY
    const rule = ruleForSku(l.sku)
    const win = renewalWindow(left, rule)
    const state: '已到期' | '即將到期' | '有效' = left < 0 ? '已到期' : left <= rule.remindDays ? '即將到期' : '有效'
    const notice = left > rule.noticeBefore ? `${rule.noticeBefore} 天前原廠通知客戶` : left >= 0 ? '原廠已通知客戶' : rule.noticeAfter && left >= -rule.noticeAfter ? `過期 ${rule.noticeAfter} 天原廠再通知` : ''
    return { left, rule, win, state, notice, renewal: activeRenewalOf(o.dealId) }
  }
  /* ---------- 預留貨：業務申請、採購核准（可縮短天數）、到期自動釋放 ---------- */
  const holdAvail = (sku: string) => stock.filter((x) => x.sku === sku).reduce((n, x) => n + x.qty - x.reserved, 0)
  function requestHold(d: Deal, sku: string, qty: number, days: number) {
    const now = new Date().toISOString()
    const h: StockHold = { id: `h-${Date.now()}`, dealId: d.id, dealNo: d.dealNo, sku, qty, days, status: '待核准', requesterId: currentUserId.value, requester: currentUser.value.name, requestedAt: now }
    stockHolds.unshift(h)
    todos.value.unshift({ id: `t-${Date.now()}-hold`, kind: '簽核', title: `預留貨：${d.customer} ${sku} × ${qty}（${days} 天）`, refNo: d.dealNo, forRoles: ['採購'], dealId: d.id, route: '/inventory', createdAt: now })
    return h
  }
  function approveHold(h: StockHold, days: number): boolean {
    if (h.status !== '待核准' || !['採購', '採購主管'].includes(role.value)) return false
    /* 先進先出、可跨批：整批空著就整批保留，否則拆出子批，每批只屬於一個對象 */
    const lots = stock.filter((x) => x.sku === h.sku && x.reserved === 0 && x.qty > 0).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    if (lots.reduce((n, x) => n + x.qty, 0) < h.qty) return false
    let want = h.qty
    const allocs: { batch: string; qty: number }[] = []
    for (const lot of lots) {
      if (want <= 0) break
      const take = Math.min(lot.qty, want)
      if (take === lot.qty) {
        lot.reserved = take
        lot.reservedFor = h.dealNo
        allocs.push({ batch: lot.batch, qty: take })
      } else {
        lot.qty -= take
        const child = `${lot.batch}-H${stock.filter((x) => x.batch.startsWith(`${lot.batch}-H`)).length + 1}`
        stock.push({ ...lot, batch: child, qty: take, reserved: take, reservedFor: h.dealNo })
        allocs.push({ batch: child, qty: take })
      }
      want -= take
    }
    h.status = '保留中'
    h.days = days
    h.allocs = allocs
    h.approvedAt = new Date().toISOString()
    h.approver = currentUser.value.name
    h.expiresAt = addDays(HOLD_TODAY, days)
    todos.value = todos.value.filter((t) => !(t.route === '/inventory' && t.refNo === h.dealNo && t.title.includes(h.sku)))
    notifications.value.unshift({ id: `n-${Date.now()}-hold`, kind: '系統', text: `預留貨核准：${h.sku} × ${h.qty} 保留到 ${h.expiresAt}`, at: h.approvedAt, read: false, forRoles: ['業務'], forUserIds: [h.requesterId] })
    return true
  }
  function rejectHold(h: StockHold, note: string) {
    if (h.status !== '待核准') return
    h.status = '已退回'
    h.note = note || undefined
    todos.value = todos.value.filter((t) => !(t.route === '/inventory' && t.refNo === h.dealNo && t.title.includes(h.sku)))
  }
  function releaseHold(h: StockHold, note?: string) {
    if (h.status !== '保留中') return
    ;(h.allocs ?? []).forEach((a) => {
      const lot = stock.find((x) => x.batch === a.batch)
      if (!lot || lot.reservedFor !== h.dealNo) return
      lot.reserved = Math.max(0, lot.reserved - a.qty)
      if (!lot.reserved) lot.reservedFor = undefined
    })
    h.status = '已釋放'
    h.note = note
  }
  /* 到期自動釋放（示範資料以 HOLD_TODAY 為今天；過了保留日才釋放） */
  stockHolds.filter((h) => h.status === '保留中' && h.expiresAt && h.expiresAt < HOLD_TODAY).forEach((h) => releaseHold(h, '到期自動釋放'))
  /* SO 成立（含保證單轉正式）：商機保留中的庫存轉給這張 SO，回傳各料號轉入的數量 */
  function transferHolds(dealId: string, soNo: string): Map<string, number> {
    const moved = new Map<string, number>()
    stockHolds.filter((h) => h.dealId === dealId && h.status === '保留中').forEach((h) => {
      h.status = '已轉 SO'
      ;(h.allocs ?? []).forEach((a) => {
        const lot = stock.find((x) => x.batch === a.batch)
        if (lot) lot.reservedFor = soNo
      })
      moved.set(h.sku, (moved.get(h.sku) ?? 0) + h.qty)
    })
    return moved
  }
  /** 我的預留貨：3 天內到期 */
  const myHoldsExpiring = computed(() => stockHolds.filter((h) => h.status === '保留中' && h.requesterId === currentUserId.value && !!h.expiresAt && h.expiresAt <= addDays(HOLD_TODAY, 3)))

  /* 授權起算：驗收或工程上授權後由工程輸入實際起算日，回寫到期日 */
  function setLicenseStart(o: Order, l: License, start: string) {
    if (!start || !l.months) return
    l.start = start
    l.expires = addMonths(start, l.months)
    logOrder(o, '執行', `${l.kind} ${l.name} 起算 ${start}，到期 ${l.expires}`)
  }
  /* 到期日只在到期項目抽屜改，改了寫一筆流程紀錄 */
  function setLicenseExpiry(o: Order, l: License, value: string) {
    if (!value || value === l.expires) return
    logOrder(o, '執行', `${l.kind} ${l.name} 到期日 ${l.expires} 改為 ${value}`)
    l.expires = value
  }
  /* 建立續約商機（結案 SO 右上角「續約」）：已有進行中的就回傳它；續約項目預設帶原 SO 全部授權 */
  function createRenewalDeal(o: Order): { deal?: Deal; existing?: Deal } {
    const existing = activeRenewalOf(o.dealId)
    if (existing) return { existing }
    const orig = deals.find((d) => d.id === o.dealId)
    const c = customers.find((x) => x.name === o.customer)
    const now = new Date()
    const ymd = now.toISOString().slice(0, 10)
    const seq = deals.filter((d) => d.dealNo.includes(ymd.slice(5, 7) + ymd.slice(8, 10))).length + 1
    const dated = o.licenses.filter(hasExpiryDate)
    const earliest = [...dated.map((l) => l.expires)].sort()[0]
    /* 預估金額：原 SO 報價單裡這些授權項次的單價 × 授權數量；對不到就 0，由業務填 */
    const q = quotes.find((x) => x.id === o.quoteId)
    const est = o.licenses.reduce((sum, l) => {
      const line = q?.lines.find((y) => y.intSku === l.sku)
      const item = line ? q?.items.find((i) => i.no === line.itemNo) : undefined
      return sum + (item ? Math.round(item.unitPrice * l.qty) : 0)
    }, 0)
    const d: Deal = {
      id: `d-${now.getTime()}`,
      dealNo: `D-${ymd.slice(0, 4)}-${ymd.slice(5, 7)}${ymd.slice(8, 10)}-${String(seq).padStart(3, '0')}`,
      customer: o.customer,
      customerDept: orig?.customerDept ?? c?.depts[0]?.name ?? '資訊部',
      via: orig?.via ?? '直接交易',
      endUser: orig?.endUser,
      kind: o.licenses[0]?.kind === '服務合約' ? '服務' : o.licenses[0]?.kind === '維護合約' || o.licenses[0]?.kind === '保固' ? '維護' : '授權',
      renewalOfDealId: o.dealId,
      renewalReason: '到期續簽',
      renewalItems: dated.map((l) => l.id),
      ownerId: users.find((u) => u.name === o.owner)?.id ?? currentUserId.value,
      owner: o.owner,
      dept: orig?.dept ?? currentUser.value.dept,
      prob: 0,
      amount: est,
      stage: '規劃預算',
      updatedAt: now.toISOString(),
      expectClose: earliest ?? new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10),
      nextAction: '',
      needsEng: false,
      preOrder: false,
      prepay: false,
      quoteVersions: 0,
      product: `${o.product} 續約`,
    }
    deals.unshift(d)
    todos.value = todos.value.filter((t) => !(t.kind === '到期' && t.refNo === o.soNo))
    return { deal: d }
  }
  const activeRenewalOf = (dealId: string) => deals.find((x) => x.renewalOfDealId === dealId && x.stage !== '未成交' && x.stage !== 'SO已成立')
  /** 可當「續約自」的商機：同客戶、SO 成立以上；已有進行中續約的列出但不可選 */
  function renewalCandidates(customer: string, excludeId?: string) {
    return deals
      .filter((d) => d.customer === customer && d.id !== excludeId)
      .map((d) => ({ d, so: orders.find((o) => o.dealId === d.id), active: activeRenewalOf(d.id) }))
      .filter((x) => !!x.so)
      .map((x) => ({ d: x.d, so: x.so!, active: x.active }))
  }

  /* 流程紀錄：執行／財務／合約每走一步寫一筆，SO 抽屜的「紀錄與附件」顯示 */
  function logOrder(o: Order, track: OrderLog['track'], text: string, by?: string) {
    if (!o.log) o.log = []
    o.log.unshift({ at: new Date().toISOString(), by: by ?? currentUser.value.name, track, text })
  }

  const ownerIdOf = (o: Order) => users.find((u) => u.name === o.owner)?.id

  /* 客戶簽收：四個入口（SO 抽屜、簽核中心等待簽收、出貨單頁、客戶線上簽收）共用；
   * 執行階段進到「驗收」、這張 SO 還沒簽的出貨單全部標已簽收、簽收代辦移除、寫流程紀錄、通知業務 */
  function signOff(o: Order, method: string, by?: string, file?: string) {
    const now = new Date()
    if (o.stageIndex < 6) o.stageIndex = 6
    shipments.filter((s) => s.orderId === o.id && s.status === '已出貨').forEach((s) => {
      s.status = '已簽收'
      s.signedAt = now.toISOString().slice(0, 10)
      s.method = method
      s.signFile = file
    })
    todos.value = todos.value.filter((t) => !(t.kind === '簽收' && t.refNo === o.soNo))
    /* 保固、維護、服務合約：驗收日起算；授權由工程確認實際起算日（setLicenseStart） */
    const ymd = now.toISOString().slice(0, 10)
    o.licenses.filter((l) => !l.start && l.months && l.kind !== '授權').forEach((l) => {
      l.start = ymd
      l.expires = addMonths(ymd, l.months!)
    })
    logOrder(o, '執行', `客戶簽收（${method}），進入「驗收」階段`, by)
    notifications.value.unshift({ id: `n-${now.getTime()}-signed`, kind: '系統', text: `${o.customer} 已簽收 ${o.soNo}（${method}）`, at: now.toISOString(), read: false, forRoles: ['業務', '業務主管'], forUserIds: ownerIdOf(o) ? [ownerIdOf(o)!] : undefined })
  }

  /* 重新簽收：同一張出貨單換一份簽收檔（iPad／連結／掃描都可以），舊附件作廢、寫一筆流程紀錄 */
  function resign(o: Order, s: Shipment, method: string, by?: string, file?: string) {
    const old = attachments.value.find((a) => a.type === '出貨簽收' && a.refNo === o.soNo && a.fileName === s.signFile && !a.voided)
    if (old && old.fileName !== file) old.voided = true
    s.status = '已簽收'
    s.signedAt = new Date().toISOString().slice(0, 10)
    s.method = method
    s.signFile = file
    logOrder(o, '執行', `出貨單 ${s.shipNo} 重新簽收（${method}）`, by)
  }

  /* 請款、開票、收款：業務申請 → 會計開票（填發票號碼）→ 收款沖帳；每一步都通知業務，全部收款且已簽收就結案 */
  function requestBilling(o: Order, idx: number) {
    const m = o.milestones[idx]
    if (!m || m.status !== '待請款' || !m.planInvoiceAt || !m.planPayAt) return
    const now = new Date()
    m.status = '已申請'
    m.requestedAt = now.toISOString().slice(0, 10)
    logOrder(o, '財務', `第 ${idx + 1} 期「${m.label}」申請請款`)
    todos.value.unshift({ id: `t-${now.getTime()}-inv`, kind: '付款', title: `開立發票：${o.customer} ${o.soNo} 第 ${idx + 1} 期 ${m.label}（${m.amount.toLocaleString()}）`, refNo: o.soNo, due: new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10), forRoles: ['會計'], route: '/sales/orders', createdAt: now.toISOString() })
    notifications.value.unshift({ id: `n-${now.getTime()}-inv`, kind: '系統', text: `${currentUser.value.name} 申請請款：${o.customer} ${o.soNo} 第 ${idx + 1} 期 ${m.label}`, at: now.toISOString(), read: false, forRoles: ['會計', '財務主管'] })
  }
  function issueInvoice(o: Order, idx: number, invoiceNo: string) {
    const m = o.milestones[idx]
    if (!m || m.status !== '已申請') return
    const now = new Date()
    m.status = '已開票'
    m.invoiceNo = invoiceNo
    m.invoicedAt = now.toISOString().slice(0, 10)
    logOrder(o, '財務', `第 ${idx + 1} 期「${m.label}」開立發票 ${invoiceNo}`)
    todos.value = todos.value.filter((t) => !(t.kind === '付款' && t.refNo === o.soNo && t.title.includes(`第 ${idx + 1} 期`)))
    notifications.value.unshift({ id: `n-${now.getTime()}-invd`, kind: '系統', text: `${o.customer} ${o.soNo} 第 ${idx + 1} 期 ${m.label} 發票已開立（${invoiceNo}），等客戶付款`, at: now.toISOString(), read: false, forRoles: ['業務'], forUserIds: ownerIdOf(o) ? [ownerIdOf(o)!] : undefined })
  }
  function confirmPaid(o: Order, idx: number) {
    const m = o.milestones[idx]
    if (!m || m.status !== '已開票') return
    const now = new Date()
    m.status = '已收款'
    m.paidAt = now.toISOString().slice(0, 10)
    logOrder(o, '財務', `第 ${idx + 1} 期「${m.label}」收款 ${m.amount.toLocaleString()}${isOrderClosed(o) ? '，訂單結案' : ''}`)
    notifications.value.unshift({ id: `n-${now.getTime()}-paid`, kind: '收款到帳', text: `${o.customer} ${o.soNo} 第 ${idx + 1} 期 ${m.label} 已收款 ${m.amount.toLocaleString()}`, at: now.toISOString(), read: false, forRoles: ['業務'], forUserIds: ownerIdOf(o) ? [ownerIdOf(o)!] : undefined })
  }

  /* 業務勾了「預下單」：給採購一件代辦、通知業務主管；同一商機不重複 */
  function requestPreOrder(deal: { id: string; dealNo: string; customer: string; product: string; owner: string }) {
    const refNo = `預下單 ${deal.dealNo}`
    if (todos.value.some((t) => t.kind === '下單' && t.refNo === refNo)) return false
    todos.value.unshift({
      id: `t-${Date.now()}-pre`,
      kind: '下單',
      title: `預下單：建立 PO（${deal.customer} ${deal.product}）`,
      refNo,
      forRoles: ['採購'],
      dealId: deal.id,
      route: `/purchase/po?so=${encodeURIComponent(refNo)}`,
      createdAt: new Date().toISOString(),
    })
    notifications.value.unshift({
      id: `n-${Date.now()}-pre`,
      kind: '系統',
      text: `${deal.owner} 將 ${deal.customer} ${deal.product} 標為預下單，採購已收到建立 PO 代辦（需業務主管核准）`,
      at: new Date().toISOString(),
      read: false,
      forRoles: ['業務主管', '採購'],
    })
    return true
  }

  /* 到期提醒天數：每人可覆寫，沒設就用該類型的預設（系統管理員維護） */
  const remindDays = ref<Record<string, number>>(readJson(`erp.remind.${currentUserId.value}`, {}))
  const remindDaysOf = (kind: string) => remindDays.value[kind] ?? expiryKinds.find((k) => k.key === kind)?.defaultRemindDays ?? 90
  function setRemindDays(kind: string, n: number | null) {
    if (n === null || n === undefined) delete remindDays.value[kind]
    else remindDays.value[kind] = n
    writeJson(`erp.remind.${currentUserId.value}`, remindDays.value)
  }
  /* 我負責範圍內、已進入提醒天數的到期項目（首頁待辦「到期」） */
  const myExpiring = computed(() =>
    scopedOrders.value
      .flatMap((o) => o.licenses.map((l) => ({ o, l, left: licenseStatus(o, l).left })))
      .filter((r) => r.left <= remindDaysOf(r.l.kind))
      .sort((a, b) => a.left - b.left),
  )

  function switchUser(id: string) {
    currentUserId.value = id
    remindDays.value = readJson(`erp.remind.${id}`, {})
    favorites.value = readJson(`erp.fav.${id}`, [])
    delegate.value = readJson(`erp.delegate.${id}`, { enabled: false, userId: '', from: '', to: '' })
  }

  function markRead(id: string) {
    const n = notifications.value.find((x) => x.id === id)
    if (n) n.read = true
  }

  function markAllRead() {
    myNotifications.value.forEach((n) => (n.read = true))
  }
  function notifyCat(n: Notification): Exclude<NotifyCat, '全部'> {
    if (n.kind === '提及') return '提及與留言'
    if (n.kind === '派工') return '工程'
    if (n.kind === '下單完成' || n.kind === '收款到帳') return '訂單與財務'
    if (/服務單|派工|工程/.test(n.text)) return '工程'
    if (n.kind === '核准' || n.kind === '退回' || /簽核|上單|核准|退回/.test(n.text)) return '簽核'
    return '訂單與財務'
  }
  function notifyLink(n: Notification): string {
    if (n.approvalId) return `/approvals/mine?open=${n.approvalId}`
    const c = notifyCat(n)
    return c === '簽核' ? '/approvals/mine' : c === '訂單與財務' ? '/sales/orders' : c === '工程' ? '/sales/pipeline' : '/notifications'
  }
  /* 重要通知卡：按「知道了」或「去處理」就不再出現（依身分各自記，這次開啟有效） */
  const dismissed = ref<Record<string, string[]>>({})
  const importantItems = computed<ImportantItem[]>(() => {
    const gone = dismissed.value[currentUserId.value] ?? []
    const list: ImportantItem[] = [
      ...pendingForMe.value.map((a) => ({ key: `ap-${a.id}-${a.currentStep}`, label: '輪到你簽', text: `${a.type}：${a.title}`, tone: 'amber' as const, to: `/approvals?open=${a.id}` })),
      ...myNotifications.value.filter((n) => n.kind === '退回' && !n.read).map((n) => ({ key: `n-${n.id}`, label: '被退回', text: n.text, tone: 'red' as const, to: notifyLink(n) })),
      ...unreadMentionDeals.value.map((d) => ({ key: `m-${d.id}-${unreadMentions(d.id).length}`, label: '被提及', text: `${d.customer} ${d.customerDept}：${unreadMentions(d.id).length} 則留言提到你`, tone: 'teal' as const, to: `/sales/pipeline?deal=${d.id}` })),
    ]
    return list.filter((x) => !gone.includes(x.key))
  })
  function dismissImportant(key: string) {
    dismissed.value = { ...dismissed.value, [currentUserId.value]: [...(dismissed.value[currentUserId.value] ?? []), key] }
    if (key.startsWith('n-')) markRead(key.slice(2))
  }

  function removeTodoByApproval(approvalId: string, forRole: Role) {
    todos.value = todos.value.filter((t) => !(t.approvalId === approvalId && t.forRoles.includes(forRole)))
  }

  function approve(id: string, note?: string) {
    const a = approvals.value.find((x) => x.id === id)
    if (!a || !canActOn(a)) return
    const me = currentUser.value
    const stepRole = a.route[a.currentStep]
    a.history.push({ role: me.role, name: me.name, userId: me.id, step: a.currentStep, action: '核准', at: new Date().toISOString(), note })
    removeTodoByApproval(id, stepRole)
    /* 上單簽核：送審期間商機停在待接單、SO 還不存在；最後一關核准這一刻才產生 SO，採購建 PO */
    let order: Order | undefined
    if (a.currentStep >= a.route.length - 1) {
      a.status = '已核准'
      a.currentStep = a.route.length
      /* 重審核准：新版本金額併入訂單，採購改 PO */
      const changing = a.diff && a.dealId ? orders.find((o) => o.dealId === a.dealId && o.changeQuoteId) : undefined
      if (changing) {
        const delta = a.amount - changing.amount
        changing.amount = a.amount
        if (a.cost !== undefined) changing.cost = a.cost
        changing.quoteId = changing.changeQuoteId
        changing.changeQuoteId = undefined
        const nq = quotes.find((x) => x.id === changing.quoteId)
        if (nq) changing.lines = orderLinesFromQuote(nq)
        changing.taxTotal = nq ? quoteTaxTotal(nq) : undefined
        logOrder(changing, '合約', `合約變更核准，訂單金額 ${changing.amount.toLocaleString()}（${delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()}）`)
        /* 金額差額落在最後一期還沒請款的期數，合計維持等於訂單金額 */
        const open = [...changing.milestones].reverse().find((m) => m.status === '待請款')
        if (open) open.amount += delta
        todos.value.unshift({
          id: `t-${Date.now()}-po2`,
          kind: '下單',
          title: `變更 PO：${changing.customer} ${changing.product}（合約變更核准）`,
          refNo: changing.soNo,
          forRoles: ['採購'],
          route: '/purchase/po',
          createdAt: new Date().toISOString(),
        })
      }
      if (a.type === '上單' && a.dealId && !a.diff) {
        /* 事後追認的案子訂單已經存在就沿用；其餘在這裡給 SO 編號 */
        order = orders.find((o) => o.dealId === a.dealId && !o.voidedAt)
        if (order && isGuarantee(order)) {
          const g = order
          const ymd = new Date().toISOString().slice(0, 10)
          const pre = g.soNo
          g.soNo = `SO-${ymd.slice(0, 4)}-${ymd.slice(5, 7)}${ymd.slice(8, 10)}-${String(orders.length + 10).padStart(3, '0')}`
          g.phase = '正式'
          g.quoteId = a.quoteId ?? g.quoteId
          g.amount = a.amount
          if (a.cost !== undefined) g.cost = a.cost
          if (a.milestones?.length) g.milestones = a.milestones.map((m) => ({ ...m }))
          const qn = quotes.find((x) => x.id === g.quoteId)
          if (qn) g.lines = orderLinesFromQuote(qn)
          if (qn) g.taxTotal = quoteTaxTotal(qn)
          logOrder(g, '合約', `議價完成，保證單 ${pre} 轉正式 SO ${g.soNo}`)
          logOrder(g, '執行', '核准通過 SO 成立，進入「接單」階段')
          qn?.lines.forEach((l, i) => {
            const n = natureOf(l)
            if ((n === '維護合約' || n === '服務合約') && l.months) g.licenses.push({ id: `lic-${Date.now()}-${i + 1}`, kind: n, sku: l.intSku, name: l.extName, qty: l.qty, months: l.months, expires: '—' })
          })
          purchaseOrders.filter((p) => p.dealId === a.dealId && p.soNo === `預下單 ${g.dealNo}`).forEach((p) => { p.soNo = g.soNo; p.orderId = g.id })
        }
        if (!order) {
          const d = deals.find((x) => x.id === a.dealId)
          const ymd = new Date().toISOString().slice(0, 10)
          const soNo = `SO-${ymd.slice(0, 4)}-${ymd.slice(5, 7)}${ymd.slice(8, 10)}-${String(orders.length + 10).padStart(3, '0')}`
          order = { id: `o-${Date.now()}`, soNo, dealId: a.dealId, dealNo: d?.dealNo ?? a.refNo, customer: d?.customer ?? '', product: d?.product ?? '', owner: d?.owner ?? a.submitter, amount: a.amount, cost: a.cost ?? 0, stageIndex: 0, quoteId: a.quoteId, milestones: (a.milestones ?? milestonesFromTemplate('once', a.amount)).map((m) => ({ ...m })), licenses: [] }
          orders.unshift(order)
          logOrder(order, '執行', '核准通過 SO 成立，進入「接單」階段')
          /* 維護合約／服務合約項次：SO 成立就有一筆到期項目，起日等驗收；單次服務不產生 */
          const q0 = quotes.find((x) => x.id === order!.quoteId)
          /* 訂單明細：成立當下從核准版報價單快照，之後報價版本再變也不影響 SO */
          if (q0) order.lines = orderLinesFromQuote(q0)
          if (q0) order.taxTotal = quoteTaxTotal(q0)
          q0?.lines.forEach((l, i) => {
            const n = natureOf(l)
            if ((n === '維護合約' || n === '服務合約') && l.months) order!.licenses.push({ id: `lic-${Date.now()}-${i + 1}`, kind: n, sku: l.intSku, name: l.extName, qty: l.qty, months: l.months, expires: addMonths(new Date().toISOString().slice(0, 10), l.months) })
          })
          /* 預下單時先開的 PO 掛到新成立的 SO */
          const so = order
          purchaseOrders.filter((p) => p.dealId === a.dealId && p.soNo === `預下單 ${so.dealNo}`).forEach((p) => { p.soNo = so.soNo; p.orderId = so.id })
        }
      }
      if (order) {
        const so = order
        /* SO 成立：商機階段自動轉為SO已成立（系統狀態，機率 95%） */
        const deal = deals.find((d) => d.id === so.dealId)
        if (deal) {
          deal.stage = 'SO已成立'
          deal.stageAt = new Date().toISOString()
          deal.prob = 0.95
          deal.updatedAt = new Date().toISOString()
        }
        /* 用庫存的項次：SO 成立當下依先進先出保留批次給這張 SO；剩下要採購的才給採購代辦 */
        const q = quotes.find((x) => x.id === so.quoteId)
        let needBuy = false
        /* 報價階段保留的庫存先轉給這張 SO，下面只配缺額，避免同一需求保留兩次 */
        const moved = so.dealId ? transferHolds(so.dealId, so.soNo) : new Map<string, number>()
        q?.lines.forEach((l) => {
          if (l.vendor === '自有工程') return
          let want = Math.min(l.stockQty ?? 0, l.qty)
          const fromHold = Math.min(moved.get(l.intSku) ?? 0, want)
          if (fromHold) {
            want -= fromHold
            moved.set(l.intSku, (moved.get(l.intSku) ?? 0) - fromHold)
          }
          if (l.qty - (l.stockQty ?? 0) > 0) needBuy = true
          for (const s of [...stock].filter((x) => x.sku === l.intSku && x.qty - x.reserved > 0).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))) {
            if (want <= 0) break
            const free = s.qty - s.reserved
            const take = Math.min(free, want)
            if (take === free && s.reserved === 0) {
              s.reserved = take
              s.reservedFor = so.soNo
            } else {
              s.qty -= take
              stock.push({ ...s, batch: `${s.batch}-${so.soNo.slice(-3)}`, qty: take, reserved: take, reservedFor: so.soNo })
            }
            want -= take
          }
        })
        if (needBuy) {
          todos.value.unshift({
            id: `t-${Date.now()}-po`,
            kind: '下單',
            title: `建立 PO：${so.customer} ${so.product}`,
            refNo: so.soNo,
            forRoles: ['採購'],
            route: `/purchase/po?so=${encodeURIComponent(so.soNo)}`,
            createdAt: new Date().toISOString(),
          })
        } else if (q) {
          /* 全部用庫存：不用 PO，直接「已入庫」；公司成本＝保留批次成本＋自有工程 */
          so.stageIndex = 3
          logOrder(so, '執行', '全部用公司庫存，進入「已入庫」階段')
          so.actualCost = stock.filter((s) => s.reservedFor === so.soNo).reduce((s, x) => s + x.reserved * x.unitCost, 0) + q.lines.filter((l) => l.vendor === '自有工程').reduce((s, l) => s + l.qty * (l.unitCost ?? 0), 0)
        }
      }
      /* 供應商建檔核准：非正式 → 正式；銀行變更生效 */
      if (a.type === '供應商建檔') {
        const v = vendors.find((x) => x.approvalId === a.id)
        if (v) {
          if (v.pendingBank) {
            v.bank = v.pendingBank
            v.pendingBank = undefined
          }
          v.status = '正式'
          v.note = undefined
        }
      }
      /* 行政申請核准 */
      if (a.type === '申請') {
        const app = applications.find((x) => x.approvalId === a.id)
        if (app) app.status = '已核准'
      }
      /* 品項參考成本核准：生效，之後送審的案用新價 */
      if (a.type === '品項參考成本') {
        const c = transferChanges.find((x) => x.approvalId === a.id)
        if (c) {
          c.status = '已核准'
          transferPrices[c.sku] = c.to
        }
      }
      /* PO 核准：標已下單，訂單進到「已下單」 */
      if (a.type === 'PO') {
        const po = purchaseOrders.find((p) => p.poNo === a.refNo)
        if (po) {
          po.status = '已下單'
          const o = orders.find((x) => x.soNo === po.soNo)
          if (o) {
            if (o.stageIndex < 1) o.stageIndex = 1
            logOrder(o, '執行', `PO ${po.poNo} 核准，進入「已下單」階段`)
            /* 實際成本 = 這張 SO 所有已核准 PO 的金額 + 自有工程成本 */
            const poSum = purchaseOrders.filter((p) => p.soNo === o.soNo && p.status !== '待核准').reduce((s, p) => s + p.amount, 0)
            const q = quotes.find((x) => x.id === o.quoteId)
            const own = q ? q.lines.filter((l) => l.vendor === '自有工程').reduce((s, l) => s + l.qty * (l.unitCost ?? 0), 0) : 0
            const stockCost = stock.filter((s) => s.reservedFor === o.soNo).reduce((s, x) => s + x.reserved * x.unitCost, 0)
            o.actualCost = poSum + own + stockCost
            if (o.actualCost > o.cost) {
              notifications.value.unshift({
                id: `n-${Date.now()}-cost`,
                kind: '系統',
                text: `${o.soNo} 實際成本 ${o.actualCost.toLocaleString()} 高於預估 ${o.cost.toLocaleString()}，實際毛利 ${(((o.amount - o.actualCost) / o.amount) * 100).toFixed(1)}%`,
                at: new Date().toISOString(),
                read: false,
                forRoles: ['業務', '業務主管', '財務主管'],
              })
            }
          }
        }
      }
      notifications.value.unshift({
        id: `n-${Date.now()}`,
        kind: '核准',
        text: `${a.type}已核准：${a.title}${order ? `，${order.soNo} 成立` : ''}`,
        at: new Date().toISOString(),
        read: false,
        forRoles: ['業務', '業務主管', '採購'],
      })
    } else {
      a.currentStep += 1
      const nextRole = a.route[a.currentStep]
      todos.value.unshift({
        id: `t-${Date.now()}`,
        kind: nextRole === '採購' && a.type === '上單' ? '稽核' : '簽核',
        title: `${a.type}：${a.title}`,
        refNo: a.refNo,
        forRoles: [nextRole],
        forUserIds: a.steps?.[a.currentStep]?.candidateIds,
        approvalId: a.id,
      })
    }
  }

  /* 駁回：回上一關重簽，整張單還在簽核中；上一關的人重新收到代辦 */
  function sendBack(id: string, note: string) {
    const a = approvals.value.find((x) => x.id === id)
    if (!a || !canActOn(a) || a.currentStep === 0) return
    const me = currentUser.value
    const now = new Date().toISOString()
    a.history.push({ role: me.role, name: me.name, action: '駁回', at: now, note })
    removeTodoByApproval(id, a.route[a.currentStep])
    a.currentStep -= 1
    const prevRole = a.route[a.currentStep]
    todos.value.unshift({
      id: `t-${Date.now()}-back`,
      kind: prevRole === '採購' && a.type === '上單' ? '稽核' : '簽核',
      title: `${a.type}：${a.title}（${me.role}駁回：${note}）`,
      refNo: a.refNo,
      forRoles: [prevRole],
      forUserIds: a.steps?.[a.currentStep]?.candidateIds,
      approvalId: a.id,
      createdAt: now,
    })
    notifications.value.unshift({ id: `n-${Date.now()}-back`, kind: '退回', text: `${me.name}駁回${a.type}：${a.title}，回到 ${prevRole} 重簽。原因：${note}`, at: now, read: false, approvalId: a.id, forRoles: [prevRole, '業務'], forUserIds: [a.submitterId, ...(a.steps?.[a.currentStep]?.candidateIds ?? [])] })
  }

  /* 收回：送件人在第一關還沒回應前把單收回，單據解鎖、可以修改後重送 */
  function recall(id: string) {
    const a = approvals.value.find((x) => x.id === id)
    if (!a || a.status !== '待簽核' || a.currentStep !== 0 || a.submitterId !== currentUserId.value) return
    const me = currentUser.value
    a.history.push({ role: me.role, name: me.name, action: '收回', at: new Date().toISOString() })
    a.status = '已收回'
    releaseDocument(a, '送件人收回')
    removeTodoByApproval(id, a.route[0])
  }

  function reject(id: string, note: string) {
    const a = approvals.value.find((x) => x.id === id)
    if (!a || !canActOn(a)) return
    const me = currentUser.value
    const stepRole = a.route[a.currentStep]
    a.history.push({ role: me.role, name: me.name, action: '退回', at: new Date().toISOString(), note })
    a.status = '已退回'
    releaseDocument(a, note)
    removeTodoByApproval(id, stepRole)
    todos.value.unshift({
      id: `t-${Date.now()}`,
      kind: '回覆',
      title: `${me.name}退回${a.type}：${note}`,
      refNo: a.refNo,
      forRoles: ['業務'],
      forUserIds: [a.submitterId],
      approvalId: a.id,
    })
    notifications.value.unshift({
      id: `n-${Date.now()}`,
      kind: '退回',
      text: `${me.name}退回${a.type}：${a.title}。原因：${note}`,
      at: new Date().toISOString(),
      read: false,
      forRoles: ['業務'],
      forUserIds: [a.submitterId],
      approvalId: a.id,
    })
  }

  /* 退回或收回之後：把掛在這張簽核單底下的單據解鎖，讓送件人可以改了重送 */
  function releaseDocument(a: Approval, note: string) {
    if (a.type === 'PO') {
      const po = purchaseOrders.find((p) => p.poNo === a.refNo)
      /* PO 被退回：留在待核准，採購修改後重送 */
      if (po) po.status = '待核准'
    }
    if (a.type === '品項參考成本') {
      const c = transferChanges.find((x) => x.approvalId === a.id)
      if (c) c.status = '已退回'
    }
    if (a.type === '供應商建檔') {
      const v = vendors.find((x) => x.approvalId === a.id)
      if (v) {
        v.pendingBank = undefined
        v.note = `建檔被退回：${note}`
      }
    }
    if (a.type === '申請') {
      const app = applications.find((x) => x.approvalId === a.id)
      if (app) app.status = '已退回'
    }
    if (a.type === '上單' && a.dealId) {
      /* 退回：SO 還沒產生，只把原回簽版本解除送審鎖定，業務補內部資料後可「補件並重新送審」，不用再回簽 */
      if (!a.diff) {
        const qq = quotes.find((x) => x.id === a.quoteId) ?? quotes.filter((x) => x.dealId === a.dealId && x.status === '報價回簽' && x.submittedAt).sort((p, n) => n.version - p.version)[0]
        if (qq) qq.submittedAt = undefined
      }
      /* 重審退回：新版本作廢，訂單維持原版本 */
      const changing = a.diff ? orders.find((x) => x.dealId === a.dealId && x.changeQuoteId) : undefined
      if (changing) {
        const q = quotes.find((x) => x.id === changing.changeQuoteId)
        if (q) {
          q.submittedAt = undefined
          q.note = `重審退回：${note}`
        }
        changing.changeQuoteId = undefined
        logOrder(changing, '合約', `合約變更重審退回：${note}`)
      }
    }
  }

  /*
   * 保證單（草案）：客戶已回簽，但還要議價、要先預下單或還沒正式合約，先開保證單（PRE-…），不計業績、可派工、不請款不出貨；
   * 議價完照常上單送審，最後一關核准時轉正式 SO。暫不需簽核，待客戶確認。
   */
  function createGuarantee(d: Deal, reason: GuaranteeReason, note: string) {
    if (orders.some((o) => o.dealId === d.id && !o.voidedAt)) return undefined
    const q = quotes.filter((x) => x.dealId === d.id && x.status === '報價回簽').sort((a, b) => b.version - a.version)[0]
    if (!q) return undefined
    const now = new Date()
    const ymd = now.toISOString().slice(0, 10)
    const pre = `PRE-${ymd.slice(0, 4)}-${ymd.slice(5, 7)}${ymd.slice(8, 10)}-${String(orders.filter((o) => o.guaranteeNo).length + 1).padStart(3, '0')}`
    const amount = quoteTotal(q)
    const cost = q.lines.reduce((n, l) => n + (l.unitCost ?? 0) * l.qty, 0)
    const g: Order = {
      id: `o-${now.getTime()}`, soNo: pre, guaranteeNo: pre, phase: '保證單', guaranteeReason: reason,
      dealId: d.id, dealNo: d.dealNo, customer: d.customer, product: d.product, owner: d.owner,
      amount, taxTotal: quoteTaxTotal(q), cost, stageIndex: 0, quoteId: q.id,
      milestones: (q.milestones ?? milestonesFromTemplate('once', amount)).map((m) => ({ ...m })),
      licenses: [], lines: orderLinesFromQuote(q),
    }
    orders.unshift(g)
    logOrder(g, '合約', `客戶回簽 v${q.version}，因「${reason}」轉保證單 ${pre}${note.trim() ? `：${note.trim()}` : ''}`)
    comments.value.push({ id: `c-${now.getTime()}`, dealId: d.id, author: currentUser.value.name, role: currentUser.value.role, at: now.toISOString(), text: `轉保證單 ${pre}（${reason}）` })
    d.updatedAt = now.toISOString()
    notifications.value.unshift({ id: `n-${now.getTime()}-pre`, kind: '系統', text: `${currentUser.value.name} 將 ${d.customer} ${d.product} 轉保證單 ${pre}（${reason}）`, at: now.toISOString(), read: false, forRoles: ['業務主管', '執行長'] })
    return g
  }

  /* 保證單作廢：客戶沒有下單，或改由其他案件承接；商機一併轉未成交，還在簽的單收回 */
  function voidGuarantee(o: Order, reason: '客戶未下單' | '改由其他案件承接', note: string, succeededByDealId?: string) {
    if (!isGuarantee(o) || o.voidedAt) return
    const now = new Date().toISOString()
    const by = succeededByDealId ? deals.find((x) => x.id === succeededByDealId) : undefined
    const why = by ? `改由 ${by.dealNo} 承接` : reason
    o.voidedAt = now.slice(0, 10)
    o.voidReason = `${why}${note.trim() ? `：${note.trim()}` : ''}`
    o.succeededByDealId = by?.id
    logOrder(o, '合約', `保證單作廢（${o.voidReason}）`)
    /* 預下單 PO：還在待核准的收回簽核並撤回；已下單、已到貨的改為公司庫存備貨（草案假設，待客戶確認成本怎麼處理） */
    purchaseOrders.filter((p) => p.dealId === o.dealId && (p.soNo === `預下單 ${o.dealNo}` || p.soNo === o.soNo)).forEach((p) => {
      if (p.status === '待核准') {
        const ap = approvals.value.find((a) => a.id === p.approvalId && a.status === '待簽核')
        if (ap) {
          ap.status = '已收回'
          ap.history.push({ role: currentUser.value.role, name: currentUser.value.name, action: '收回', at: now, note: '保證單作廢，預下單 PO 撤回' })
        }
        todos.value = todos.value.filter((t) => t.approvalId !== p.approvalId)
        const i = purchaseOrders.indexOf(p)
        if (i >= 0) purchaseOrders.splice(i, 1)
        logOrder(o, '合約', `預下單 PO ${p.poNo} 撤回`)
      } else {
        p.soNo = '公司庫存'
        p.sourceDealId = p.dealId
        p.sourceGuaranteeNo = o.soNo
        p.dealId = undefined
        p.orderId = undefined
        stock.filter((b) => b.poNo === p.poNo && b.reservedFor).forEach((b) => { b.reservedFor = undefined; b.reserved = 0 })
        logOrder(o, '合約', `預下單 PO ${p.poNo} 已${p.status}，改為公司庫存備貨`)
      }
    })
    const d = deals.find((x) => x.id === o.dealId)
    if (d) {
      d.stage = '未成交'
      d.stageAt = now
      d.prob = 0
      d.lostReason = `保證單作廢：${o.voidReason}`
      d.updatedAt = now
      approvals.value.filter((a) => a.dealId === d.id && a.status === '待簽核').forEach((a) => {
        a.status = '已收回'
        a.history.push({ role: currentUser.value.role, name: currentUser.value.name, action: '收回', at: now, note: '保證單作廢，簽核單自動收回' })
      })
      todos.value = todos.value.filter((t) => !(t.refNo === d.dealNo || t.dealId === d.id || t.refNo === o.soNo))
      comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: currentUser.value.role, at: now, text: `保證單 ${o.soNo} 作廢（${o.voidReason}）` })
    }
  }

  /* 下一步只存一份：商機與 SO 都能改，異動記一則留言 */
  function setNextAction(d: Deal, text: string) {
    const v = text.trim()
    if (v === d.nextAction) return false
    d.nextHistory = [...(d.nextHistory ?? []), { at: new Date().toISOString(), by: currentUser.value.name, text: v }]
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: currentUser.value.role, at: new Date().toISOString(), text: `下一步：${d.nextAction || '（空）'} → ${v || '（空）'}` })
    d.nextAction = v
    d.updatedAt = new Date().toISOString()
    return true
  }

  /* ---------- 閒置：三個月階段沒變 → 通知業務本人與主管；主管手動釋放（設未成交），同承辦人的防撞佔位跟著解除 ---------- */
  const managersOf = (d: Deal) => users.filter((u) => u.role === '業務主管' && u.dept === d.dept)
  deals.filter((d) => isIdle(d) && !d.idleNotifiedAt).forEach((d) => {
    d.idleNotifiedAt = IDLE_TODAY
    const ids = [d.ownerId, ...managersOf(d).map((u) => u.id)]
    notifications.value.unshift({ id: `n-idle-${d.id}`, kind: '系統', text: `${d.customer} ${d.customerDept}「${d.product}」階段「${d.stage}」已 ${stageIdleDays(d)} 天沒變（閒置）`, at: `${IDLE_TODAY}T08:00:00+08:00`, read: false, forRoles: ['業務', '業務主管'], forUserIds: ids })
  })
  const canReleaseIdle = (d: Deal) => isIdle(d) && (role.value === '執行長' || (role.value === '業務主管' && managersOf(d).some((u) => u.id === currentUserId.value)))
  function releaseIdle(d: Deal, note: string) {
    if (!canReleaseIdle(d)) return false
    const now = new Date().toISOString()
    d.stage = '未成交'
    d.stageAt = now
    d.prob = 0
    d.lostReason = `閒置釋放${note ? `：${note}` : ''}`
    d.updatedAt = now
    approvals.value.filter((a) => a.dealId === d.id && a.status === '待簽核').forEach((a) => {
      a.status = '已收回'
      a.history.push({ role: currentUser.value.role, name: currentUser.value.name, action: '收回', at: now, note: '商機閒置釋放，簽核單自動收回' })
    })
    todos.value = todos.value.filter((t) => !(t.refNo === d.dealNo || t.dealId === d.id))
    stockHolds.filter((h) => h.dealId === d.id && h.status === '保留中').forEach((h) => releaseHold(h, '商機閒置釋放'))
    comments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: currentUser.value.name, role: currentUser.value.role, at: now, text: `閒置釋放（階段 ${stageIdleDays({ ...d, stage: '議價' })} 天沒變）${note ? `：${note}` : ''}` })
    notifications.value.unshift({ id: `n-${Date.now()}-rel`, kind: '系統', text: `${currentUser.value.name} 釋放閒置商機 ${d.dealNo}（${d.customer} ${d.customerDept}）`, at: now, read: false, forRoles: ['業務'], forUserIds: [d.ownerId] })
    return true
  }

  /* 合約結束日：業務填（可從驗收完成起算），過了就不能合約變更 */
  function setContractEnd(o: Order, date: string) {
    if (o.contractEndAt === date) return
    logOrder(o, '合約', `合約結束日 ${o.contractEndAt ?? '（未填）'} → ${date || '（未填）'}`)
    o.contractEndAt = date || undefined
  }

  /* 工程結案：工程提出結案，SO 才能整案結案（另需已驗收、全部收款） */
  function closeEngineering(o: Order): boolean {
    if (o.engClosedAt) return false
    const d = deals.find((x) => x.id === o.dealId)
    const ts = d?.engRequests ?? []
    if (ts.some((t) => !['已完成', '已取消'].includes(t.status))) return false
    const salesSide = ['業務', '業務主管', '執行長'].includes(role.value) && (role.value !== '業務' || o.owner === currentUser.value.name)
    /* 會議：工程師提出結案；負責過這個案子服務單的工程師、工程主管、執行長可結案，沒有服務單時業務端也可以 */
    const myEng = role.value === '工程師' && ts.some((t) => t.assigneeIds.includes(currentUserId.value))
    if (!(['工程主管', '執行長'].includes(role.value) || myEng || (!ts.length && salesSide))) return false
    o.engClosedAt = new Date().toISOString().slice(0, 10)
    logOrder(o, '執行', `工程結案${isOrderClosed(o) ? '，訂單結案' : ''}`)
    notifications.value.unshift({ id: `n-${Date.now()}-engc`, kind: '系統', text: `${o.customer} ${o.soNo} 工程已結案`, at: new Date().toISOString(), read: false, forRoles: ['業務', '業務主管'] })
    return true
  }

  function completeTodo(id: string) {
    todos.value = todos.value.filter((t) => t.id !== id)
  }

  return {
    theme,
    setTheme,
    scopedDeals,
    scopedOrders,
    deals,
    accessOf,
    canSeeMoney,
    canSeeOrderMoney,
    canActOn,
    notifyCat,
    notifyLink,
    importantItems,
    dismissImportant,
    canReleaseIdle,
    releaseIdle,
    canDispatch,
    isAccepted,
    assignToGroup,
    acceptEngineering,
    declineEngineering,
    setLicenseStart,
    holdAvail,
    requestHold,
    approveHold,
    rejectHold,
    releaseHold,
    myHoldsExpiring,
    canManageMembers,
    membersOf,
    addMembers,
    removeMember,
    comments,
    unreadMentions,
    unreadMentionDeals,
    unreadMentionTotal,
    markMentionsRead,
    participantsOf,
    engRequestsOf,
    requestBilling,
    issueInvoice,
    confirmPaid,
    vendorRenewalRules,
    ruleForSku,
    renewalWindow,
    activeRenewalOf,
    licenseStatus,
    setLicenseExpiry,
    createRenewalDeal,
    renewalCandidates,
    engSummary,
    requestEngineering,
    resubmitEngineering,
    assignEngineers,
    rejectEngineering,
    cancelEngineering,
    completeEngineering,
    logOrder,
    setNextAction,
    closeEngineering,
    setContractEnd,
    createGuarantee,
    voidGuarantee,
    signOff,
    resign,
    scopeNote,
    requestPreOrder,
    remindDays,
    remindDaysOf,
    setRemindDays,
    myExpiring,
    users,
    currentUserId,
    currentUser,
    role,
    todos,
    myTodos,
    approvals,
    pendingForMe,
    submittedByMe,
    waitingOnOthers,
    favorites,
    isFavorite,
    toggleFavorite,
    myAnnouncements,
    delegate,
    saveDelegate,
    attachments,
    addAttachment,
    notifications,
    myNotifications,
    unreadCount,
    switchUser,
    markRead,
    markAllRead,
    approve,
    reject,
    sendBack,
    recall,
    completeTodo,
  }
})
