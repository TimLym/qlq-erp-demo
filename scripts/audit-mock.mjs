// 假資料一致性檢查：商機 ↔ 報價單 ↔ 簽核單 ↔ 訂單 ↔ 代辦 ↔ PO
// 用法：node scripts/audit-mock.mjs
import { createServer } from 'vite'
import { checkExtra } from './audit-extra.mjs'
import { checkDates } from './audit-dates.mjs'

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })
const m = await server.ssrLoadModule('/src/mock/data.ts')
const { deals, quotes, orders, approvals, todos, purchaseOrders, dealMembers } = m
const issues = []
const byId = (arr, id) => arr.find((x) => x.id === id)

// 報價單 → 商機
for (const q of quotes) {
  if (!byId(deals, q.dealId)) issues.push(`報價單 ${q.id} 的商機 ${q.dealId} 不存在`)
}
// 訂單 → 商機、報價版本
for (const o of orders) {
  const d = byId(deals, o.dealId)
  if (!d) issues.push(`訂單 ${o.soNo} 的商機 ${o.dealId} 不存在`)
  else {
    if (d.dealNo !== o.dealNo) issues.push(`訂單 ${o.soNo} 商機編號 ${o.dealNo} ≠ 商機 ${d.dealNo}`)
    if (o.phase === '保證單') {
      if (!o.soNo.startsWith('PRE-') || o.guaranteeNo !== o.soNo) issues.push(`保證單 ${o.soNo} 編號應為 PRE- 開頭且與 guaranteeNo 一致`)
      if (!o.voidedAt && (d.stage === 'SO已成立' || d.stage === '未成交')) issues.push(`保證單 ${o.soNo} 進行中，商機 ${d.dealNo} 不該是 ${d.stage}`)
      if (o.voidedAt && d.stage !== '未成交') issues.push(`保證單 ${o.soNo} 已作廢，商機 ${d.dealNo} 應為未成交`)
      if (!quotes.some((q) => q.id === o.quoteId && q.status === '報價回簽')) issues.push(`保證單 ${o.soNo} 應對應客戶已回簽的報價版本`)
    } else if (d.stage !== 'SO已成立') issues.push(`訂單 ${o.soNo} 存在（SO 只在上單核准後產生），商機 ${d.dealNo} 階段應為SO已成立，實際 ${d.stage}`)
    if (o.stageIndex < 0 || o.stageIndex > 6) issues.push(`訂單 ${o.soNo} 的 stageIndex ${o.stageIndex} 超出 0–6（接單…驗收）`)
    if (d.customer !== o.customer) issues.push(`訂單 ${o.soNo} 客戶 ${o.customer} ≠ 商機 ${d.customer}`)
  }
  if (o.quoteId && !byId(quotes, o.quoteId)) issues.push(`訂單 ${o.soNo} 的報價版本 ${o.quoteId} 不存在`)
  if (o.changeQuoteId && !byId(quotes, o.changeQuoteId)) issues.push(`訂單 ${o.soNo} 的合約變更版本 ${o.changeQuoteId} 不存在`)
}
// 技術服務單：待派工要有派工代辦；進行中的工程師要是成員且有工程代辦；成員裡的工程師要有進行中的單
for (const d of deals) {
  for (const t of d.engRequests ?? []) {
    if (!t.requestNo.startsWith(d.dealNo)) issues.push(`服務單 ${t.requestNo} 不屬於商機 ${d.dealNo}`)
    if (t.status === '待派工' && !todos.some((x) => x.kind === '派工' && x.engRequestId === t.id)) issues.push(`服務單 ${t.requestNo} 待派工但工程主管沒有派工代辦`)
    const grp = (m.engGroups ?? []).find((g) => g.id === t.groupId)
    if (t.groupId && !grp) issues.push(`服務單 ${t.requestNo} 派給不存在的組`)
    if (t.status === '待派工' && grp && !todos.some((x) => x.kind === '派工' && x.engRequestId === t.id && x.forUserIds?.includes(grp.leaderId))) issues.push(`服務單 ${t.requestNo} 派給${grp.name}但組長沒有派工代辦`)
    if (t.status === '待接受') {
      if (!t.assigneeIds.length) issues.push(`服務單 ${t.requestNo} 待接受但沒有工程師`)
      if (t.assigneeIds.every((id) => t.acceptedIds?.includes(id))) issues.push(`服務單 ${t.requestNo} 全部接受了卻還是待接受`)
      for (const id of t.assigneeIds.filter((x) => !t.acceptedIds?.includes(x))) if (!todos.some((x) => x.kind === '工程' && x.engRequestId === t.id && x.forUserIds?.includes(id) && x.title.startsWith('待接受'))) issues.push(`服務單 ${t.requestNo} 的 ${id} 沒有待接受代辦`)
    }
    if (t.suggestedId && !m.users.some((u) => u.id === t.suggestedId && u.role === '工程師')) issues.push(`服務單 ${t.requestNo} 建議的工程師不存在`)
    if (t.status === '已派工') {
      if (!t.assigneeIds.length) issues.push(`服務單 ${t.requestNo} 已派工但沒有工程師`)
      for (const id of t.assigneeIds) {
        if (!dealMembers.some((m) => m.dealId === d.id && m.userId === id && m.kind === '工程師' && m.engRequestIds?.includes(t.id))) issues.push(`服務單 ${t.requestNo} 的工程師 ${id} 不在商機成員或沒對應到這張單`)
        if (!todos.some((x) => x.kind === '工程' && x.engRequestId === t.id && x.forUserIds?.includes(id))) issues.push(`服務單 ${t.requestNo} 的工程師 ${id} 沒有工程代辦`)
      }
    }
  }
  for (const m of dealMembers.filter((m) => m.dealId === d.id && m.kind === '工程師')) {
    if (!(d.engRequests ?? []).some((t) => (t.status === '待接受' || t.status === '已派工' || t.status === '已完成') && t.assigneeIds.includes(m.userId))) issues.push(`商機 ${d.dealNo} 的工程支援人員 ${m.userId} 沒有派過的服務單`)
  }
}
// 續約商機 → 原商機要存在、同客戶、已成立 SO
for (const d of deals) {
  if (!d.renewalOfDealId) continue
  const o = byId(deals, d.renewalOfDealId)
  if (!o) issues.push(`商機 ${d.dealNo} 續約自 ${d.renewalOfDealId} 不存在`)
  else {
    if (o.customer !== d.customer) issues.push(`商機 ${d.dealNo} 續約自 ${o.dealNo} 但客戶不同`)
    if (!orders.some((x) => x.dealId === o.id)) issues.push(`商機 ${d.dealNo} 續約自 ${o.dealNo}，但原商機沒有成立的 SO`)
    const licIds = orders.filter((x) => x.dealId === o.id).flatMap((x) => x.licenses.map((l) => l.id))
    for (const sn of d.renewalItems ?? []) if (!licIds.includes(sn)) issues.push(`商機 ${d.dealNo} 的續約項目 ${sn} 不在原 SO 的授權裡`)
  }
}
// SO已成立商機 → 必須有訂單與已送審的報價回簽版本
for (const d of deals) {
  if (d.stage === 'SO已成立') {
    if (!orders.some((o) => o.dealId === d.id)) issues.push(`商機 ${d.dealNo}（${d.customer}）SO已成立但沒有訂單`)
    if (!quotes.some((q) => q.dealId === d.id && q.status === '報價回簽' && q.submittedAt)) issues.push(`商機 ${d.dealNo} SO已成立但沒有已送審的報價回簽版本`)
  }
  const n = quotes.filter((q) => q.dealId === d.id).length
  if (d.quoteVersions !== n) issues.push(`商機 ${d.dealNo} quoteVersions=${d.quoteVersions}，實際 ${n} 版`)
}
// 上單簽核還沒走完或被退回：SO 不該存在（事後追認除外），送審中的商機停在待接單
for (const a of approvals) {
  if (a.type !== '上單' || !a.dealId || a.diff || a.postHoc || a.status === '已核准') continue
  if (orders.some((o) => o.dealId === a.dealId)) issues.push(`上單簽核 ${a.id} 狀態 ${a.status}，商機 ${a.refNo} 不該已有 SO`)
  const d = byId(deals, a.dealId)
  if (a.status === '待簽核' && d && d.stage !== '待接單') issues.push(`上單簽核 ${a.id} 送審中，商機 ${a.refNo} 階段應為待接單，實際 ${d.stage}`)
}
// 簽核單 → 商機、代辦
for (const a of approvals) {
  if (a.dealId && !byId(deals, a.dealId)) issues.push(`簽核單 ${a.id} 的商機 ${a.dealId} 不存在`)
  if (a.type === '上單' && a.dealId) {
    const d = byId(deals, a.dealId)
    if (d && a.status === '已核准' && d.stage !== 'SO已成立') issues.push(`簽核單 ${a.id}（${a.title}）已核准，但商機階段是 ${d.stage}`)
    if (d && a.status === '待簽核' && !a.postHoc && !a.diff && d.stage !== '待接單') issues.push(`簽核單 ${a.id}（${a.title}）送審中，商機階段應為待接單，實際 ${d.stage}`)
  }
  if (a.status === '待簽核') {
    const role = a.route[a.currentStep]
    const t = todos.find((t) => t.approvalId === a.id && t.forRoles.includes(role))
    if (!t) issues.push(`簽核單 ${a.id}（${a.title}）目前關卡 ${role} 沒有對應代辦`)
  }
}
for (const t of todos) {
  if (t.approvalId && !byId(approvals, t.approvalId)) issues.push(`代辦 ${t.id} 的簽核單 ${t.approvalId} 不存在`)
  if (t.approvalId) {
    const a = byId(approvals, t.approvalId)
    if (a && a.status === '待簽核' && t.kind !== '回覆' && !t.forRoles.includes(a.route[a.currentStep])) issues.push(`代辦 ${t.id}（${t.title}）角色 ${t.forRoles} 不是簽核單目前關卡 ${a.route[a.currentStep]}`)
  }
  if (t.dealId && !byId(deals, t.dealId)) issues.push(`代辦 ${t.id} 的商機 ${t.dealId} 不存在`)
  if (t.refNo.startsWith('SO-') && !orders.some((o) => o.soNo === t.refNo)) issues.push(`代辦 ${t.id} 的訂單 ${t.refNo} 不存在`)
  if (t.refNo.startsWith('D-') && !deals.some((d) => d.dealNo === t.refNo)) issues.push(`代辦 ${t.id} 的商機 ${t.refNo} 不存在`)
  const td = deals.find((d) => d.dealNo === t.refNo || d.id === t.dealId)
  if (td && td.stage === '未成交') issues.push(`代辦 ${t.id}（${t.title}）指向已未成交的商機 ${td.dealNo}，未成交時應一併結案`)
}
const { customers } = m
for (const d of deals) {
  const c = customers.find((x) => x.name === d.customer)
  if (!c) issues.push(`商機 ${d.dealNo} 的客戶 ${d.customer} 不在客戶主檔`)
  else if (!c.depts.some((x) => x.name === d.customerDept)) issues.push(`商機 ${d.dealNo} 的部門 ${d.customerDept} 不在 ${d.customer} 的主檔部門`)
}
const taxIds = customers.map((c) => c.taxId)
if (new Set(taxIds).size !== taxIds.length) issues.push('客戶主檔統編重複')
const { stock } = m
for (const h of m.stockHolds ?? []) {
  if (!deals.find((d) => d.id === h.dealId && d.dealNo === h.dealNo)) issues.push(`預留 ${h.id} 對不到商機`)
  if (h.status === '保留中' && (!h.allocs?.length || !h.expiresAt || !h.approvedAt)) issues.push(`預留 ${h.id} 保留中但缺批次、到期日或核准時間`)
  if (h.status === '保留中' && h.allocs?.reduce((n, a) => n + a.qty, 0) !== h.qty) issues.push(`預留 ${h.id} 各批數量加總不等於申請數量`)
  for (const a of h.status === '保留中' ? h.allocs ?? [] : []) {
    const lot = stock.find((x) => x.batch === a.batch)
    if (!lot || lot.sku !== h.sku || lot.reservedFor !== h.dealNo || lot.reserved !== a.qty) issues.push(`預留 ${h.id} 批次 ${a.batch} 對不上`)
  }
}
for (const q of quotes) for (const l of q.lines) {
  if (l.vendor === '自有工程' && m.ownServices && !m.ownServices.some((x) => x.code === l.intSku)) issues.push(`報價 ${q.id} 自有工程項次 ${l.intSku} 不在自有服務項目主檔`)
}
for (const st of stock) {
  if (st.reserved > st.qty) issues.push(`庫存批次 ${st.batch} 保留 ${st.reserved} 超過數量 ${st.qty}`)
  if (st.reservedFor) {
    const o = orders.find((x) => x.soNo === st.reservedFor)
    /* 報價階段的預留貨：保留給商機編號，要有保留中的申請且數量對得上 */
    const held = (m.stockHolds ?? []).filter((h) => h.status === '保留中' && h.dealNo === st.reservedFor).flatMap((h) => h.allocs ?? []).filter((a) => a.batch === st.batch)
    if (!o && !held.length) issues.push(`庫存批次 ${st.batch} 保留給不存在的 ${st.reservedFor}`)
    if (!o && held.length && held.reduce((n, a) => n + a.qty, 0) !== st.reserved) issues.push(`庫存批次 ${st.batch} 保留量和預留申請對不上`)
    else if (o) {
      const q = quotes.find((x) => x.id === o.quoteId)
      if (q && !q.lines.some((l) => l.intSku === st.sku)) issues.push(`庫存批次 ${st.batch}（${st.sku}）保留給 ${st.reservedFor}，但該訂單不需要這個料號`)
    }
  }
}
for (const po of purchaseOrders) {
  if (po.soNo.startsWith('SO-') && !orders.some((o) => o.soNo === po.soNo)) issues.push(`PO ${po.poNo} 的訂單 ${po.soNo} 不存在`)
  if (po.soNo.startsWith('預下單 ')) {
    const no = po.soNo.replace('預下單 ', '')
    const d = deals.find((d) => d.dealNo === no)
    if (!d) issues.push(`PO ${po.poNo} 的預下單商機 ${no} 不存在`)
    else if (!d.preOrder) issues.push(`PO ${po.poNo} 是預下單，但商機 ${no} 沒勾預下單`)
  }
}

checkExtra(m, issues)
checkDates(m, issues)

console.log('商機', deals.length, '｜報價單', quotes.length, '｜訂單', orders.length, '｜簽核單', approvals.length, '｜代辦', todos.length, '｜PO', purchaseOrders.length)
console.log('\n對照表')
for (const d of deals) {
  const qs = quotes.filter((q) => q.dealId === d.id).map((q) => `v${q.version}${q.status}`).join(' ')
  const os = orders.filter((o) => o.dealId === d.id).map((o) => `${o.soNo}@${o.stageIndex}`).join(' ')
  const as = approvals.filter((a) => a.dealId === d.id).map((a) => `${a.type}${a.diff ? '重審' : ''}${a.postHoc ? '追認' : ''}:${a.status}`).join(' ')
  console.log(`${d.dealNo} ${d.customer}（${d.customerDept}） ${d.stage} ${d.owner} | 報價:${qs || '無'} | 訂單:${os || '無'} | 簽核:${as || '無'}`)
}
console.log(issues.length ? '\n不一致：\n- ' + issues.join('\n- ') : '\n全部對得上')
await server.close()
