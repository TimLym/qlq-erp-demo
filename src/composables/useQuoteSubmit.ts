import { computed, watch, type Ref } from 'vue'
import { deals, quotes, orders, stock, transferOf, milestonesFromTemplate, milestoneProblems, quoteTotal, quoteCost, lineCost, TAX_RATE, type Role, type Quote, type QuoteItem, type QuoteLine } from '../mock/data'
import { evaluate, routing } from '../mock/routing'
import { useAppStore } from '../stores/app'
import { money, pct } from '../utils/format'

/** 上單條件卡的生命週期狀態：未成交 → 合約變更重審 → 已核准／SO → 送審中 → 退回 → 可送審 → 草稿 → 無報價 */
export type QuoteSubmitState = 'no-quote' | 'draft' | 'ready' | 'pending' | 'returned' | 'approved' | 'retry-ready' | 'retry-pending' | 'retry-returned' | 'lost'
export interface SubmitChecklistItem {
  key: 'vendorFiles' | 'signback' | 'milestones' | 'stage'
  label: string
  status: 'complete' | 'incomplete' | 'na'
  detail: string
}

/*
 * 一個商機的報價狀態與上單送審：報價單版本頁簽（QuoteWorkbench）與基本資料頁簽的「上單條件」卡共用。
 * 吃商機 id 與目前看的版本 id；版本 id 空字串就是最新版。
 * 狀態只有兩種：草稿（什麼都能改）與報價回簽（上傳客戶回簽後內容鎖定）；回簽版本送審後整版鎖定（submittedAt）。
 */
export function useQuoteSubmit(dealId: Ref<string | null | undefined>, activeQuoteId: Ref<string>) {
  const store = useAppStore()
  const deal = computed(() => deals.find((d) => d.id === dealId.value))
  const dealQuotes = computed(() => quotes.filter((q) => q.dealId === dealId.value).sort((a, b) => b.version - a.version))
  const q = computed<Quote | undefined>(() => dealQuotes.value.find((x) => x.id === activeQuoteId.value) ?? dealQuotes.value[0])

  /* ---------- 權限與狀態 ---------- */
  const salesSide = computed(() => !!deal.value && (deal.value.ownerId === store.currentUserId || ['業務主管', '執行長'].includes(store.role)))
  /** 可以開新版本：商機還沒上單、沒未成交 */
  const canNewVersion = computed(() => salesSide.value && !!deal.value && deal.value.stage !== 'SO已成立' && deal.value.stage !== '未成交' && !approvalPending.value)
  const changeOrder = computed(() => (deal.value ? orders.find((o) => o.dealId === deal.value!.id && o.changeQuoteId) : undefined))
  const isChangeQuote = (x: Quote | undefined) => !!x && !!changeOrder.value && changeOrder.value.changeQuoteId === x.id
  const isLatest = computed(() => !!q.value && q.value.id === dealQuotes.value[0]?.id)
  /** 草稿：對外欄位可改 */
  const draftEditable = computed(() => !!q.value && q.value.status === '草稿' && (canNewVersion.value || (isChangeQuote(q.value) && salesSide.value)))
  /** 附件類（廠商報價單、回簽、請款條件、送審理由）可改：還沒送審的最新版本／合約變更版本 */
  const internalEditable = computed(() => !!q.value && salesSide.value && !q.value.submittedAt && (isLatest.value || isChangeQuote(q.value)))
  /** 可送審：客戶已回簽的版本 */
  const submitStage = computed(() => internalEditable.value && q.value!.status === '報價回簽')
  const isRetry = computed(() => isChangeQuote(q.value))
  const retryOrder = computed(() => (isRetry.value ? changeOrder.value : undefined))
  const baseQuote = computed(() => (retryOrder.value ? quotes.find((x) => x.id === retryOrder.value!.quoteId) : undefined))
  const quoteApproval = computed(() => store.approvals.filter((a) => a.type === '上單' && a.dealId === dealId.value).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0])
  /** 送審中：簽核還沒走完 */
  const approvalPending = computed(() => quoteApproval.value?.status === '待簽核')
  /** 被退回待補件：最近一張上單簽核單被退回、對應這版回簽且已解鎖（SO 這時還不存在） */
  const returnedApproval = computed(() => (q.value && quoteApproval.value?.status === '已退回' && !quoteApproval.value.diff && (quoteApproval.value.quoteId ?? q.value.id) === q.value.id ? quoteApproval.value : undefined))
  const isReturned = computed(() => !!returnedApproval.value && !!q.value && q.value.status === '報價回簽' && !q.value.submittedAt)
  /** 內部項次欄位（成本、庫存、自有工程）可改：草稿，或退回待補件的回簽版本 */
  const lineEditable = computed(() => draftEditable.value || (isReturned.value && salesSide.value))
  /** 第幾次送審（同一商機的上單簽核單數＋1） */
  const attempt = computed(() => store.approvals.filter((a) => a.type === '上單' && a.dealId === dealId.value && !a.diff).length + 1)
  const lastReturnNote = computed(() => [...(quoteApproval.value?.history ?? [])].reverse().find((h) => h.action === '退回')?.note ?? '')
  /** 已有新版草稿的回簽版本 */
  const superseded = (v: Quote) => v.status === '報價回簽' && dealQuotes.value.some((x) => x.status === '草稿' && x.version > v.version)

  /* ---------- 金額 ---------- */
  const withTax = (n: number) => Math.round(n * (1 + TAX_RATE))
  const revenue = computed(() => (q.value ? quoteTotal(q.value) : 0))
  const cost = computed(() => (q.value ? quoteCost(q.value) : 0))
  const margin = computed(() => (revenue.value ? (revenue.value - cost.value) / revenue.value : 0))
  const linesOf = (item: QuoteItem) => (q.value?.lines ?? []).filter((l) => l.itemNo === item.no)
  const itemRevenue = (item: QuoteItem) => item.qty * item.unitPrice
  const itemCost = (item: QuoteItem) => linesOf(item).reduce((s, l) => s + lineCost(l), 0)
  const itemCostKnown = (item: QuoteItem) => linesOf(item).every((l) => lineUnitCost(l) !== null)
  const itemMargin = (item: QuoteItem) => (itemRevenue(item) ? (itemRevenue(item) - itemCost(item)) / itemRevenue(item) : 0)
  const stockPart = (l: QuoteLine) => Math.min(l.stockQty ?? 0, l.qty)
  const buyPart = (l: QuoteLine) => l.qty - stockPart(l)
  const lineUnitCost = (l: QuoteLine): number | null => (buyPart(l) > 0 && l.unitCost === null ? null : lineCost(l) / l.qty)
  const missingCost = computed(() => (q.value?.lines ?? []).filter((l) => buyPart(l) > 0 && l.unitCost === null).length)
  const needsFile = (l: QuoteLine) => l.vendor !== '自有工程' && buyPart(l) > 0
  const missingFiles = computed(() => (q.value?.lines ?? []).filter((l) => needsFile(l) && !l.vendorQuoteFile))

  /* ---------- 庫存 ---------- */
  function stockFor(sku: string) {
    return stock.filter((s) => s.sku === sku).reduce((n, s) => n + s.qty - s.reserved, 0)
  }
  const canUseStock = (l: QuoteLine) => l.vendor !== '自有工程' && stockFor(l.intSku) > 0 && transferOf(l.intSku) !== undefined
  const stockMode = (l: QuoteLine): 'stock' | 'buy' => (stockPart(l) > 0 ? 'stock' : 'buy')
  function setStockMode(l: QuoteLine, mode: 'stock' | 'buy') {
    if (mode === 'stock') {
      l.stockQty = Math.min(l.qty, stockFor(l.intSku))
      l.insistReason = undefined
    } else l.stockQty = 0
  }
  watch(
    q,
    (x) => {
      if (!x) return
      x.lines.forEach((l) => { if (l.stockQty === undefined && canUseStock(l)) l.stockQty = Math.min(l.qty, stockFor(l.intSku)) })
      if (!x.milestones && x.status !== '草稿') x.milestones = milestonesFromTemplate('once', quoteTotal(x))
    },
    { immediate: true },
  )

  /* ---------- 請款條件 ---------- */
  const milestones = computed({
    get: () => q.value?.milestones ?? [],
    set: (v) => { if (q.value) q.value.milestones = v },
  })

  /* ---------- 簽核路由與送審 ---------- */
  const routeOf = (m: number): Role[] => evaluate('上單', { facts: { margin: m * 100 } }).route
  const routeResolved = computed(() =>
    evaluate('上單', {
      applicantId: store.currentUserId,
      facts: {
        margin: margin.value * 100,
        amount: revenue.value,
        useStock: (q.value?.lines ?? []).some((l) => stockPart(l) > 0),
        insistBuy: (q.value?.lines ?? []).some((l) => canUseStock(l) && stockPart(l) === 0),
      },
    }),
  )
  const routePreview = computed<Role[]>(() => routeResolved.value.route)
  const needReason = computed(() => margin.value < 0)
  const flags = computed(() => (margin.value < 0 ? ['負毛利'] : margin.value < routing.lowMarginThreshold ? ['低毛利'] : undefined))
  const stageOk = computed(() => isRetry.value || deal.value?.stage === '待接單')
  const reason = computed({
    get: () => q.value?.submitReason ?? '',
    set: (v) => { if (q.value) q.value.submitReason = v || undefined },
  })
  const blockers = computed(() => {
    const x = q.value
    if (!x) return []
    const list: string[] = []
    if (!stageOk.value) list.push('階段未達「待接單」')
    if (!x.signbackFile) list.push('尚未上傳客戶回簽')
    if (missingFiles.value.length) list.push(`${missingFiles.value.length} 項缺廠商報價單`)
    if (missingCost.value) list.push(`${missingCost.value} 項成本未填`)
    const noReason = x.lines.filter((l) => canUseStock(l) && stockPart(l) === 0 && !(l.insistReason ?? '').trim())
    if (noReason.length) list.push(`${noReason.length} 項庫存夠卻另行採購，請填理由`)
    if (needReason.value && !reason.value.trim()) list.push('負毛利需填寫送審理由')
    if (!isRetry.value) list.push(...milestoneProblems(milestones.value, revenue.value))
    return list
  })
  const diff = computed(() => {
    const b = baseQuote.value
    const x = q.value
    if (!b || !x) return []
    const rows: { field: string; before: string; after: string }[] = []
    const tb = quoteTotal(b)
    const tq = quoteTotal(x)
    if (tb !== tq) rows.push({ field: '售價合計', before: money(tb), after: money(tq) })
    const mb = tb ? (tb - quoteCost(b)) / tb : 0
    const mq = tq ? (tq - quoteCost(x)) / tq : 0
    if (Math.abs(mb - mq) > 0.0005) rows.push({ field: '毛利率', before: pct(mb), after: pct(mq) })
    const rb = routeOf(mb).join(' → ')
    const rq = routeOf(mq).join(' → ')
    if (rb !== rq) rows.push({ field: '簽核進度', before: rb, after: rq })
    x.items.forEach((i) => {
      const prev = b.items.find((p) => p.custName === i.custName)
      if (!prev) rows.push({ field: `項次 ${i.no} ${i.custName}`, before: '（無）', after: `${i.qty} × ${money(i.unitPrice)}` })
      else {
        if (prev.unitPrice !== i.unitPrice) rows.push({ field: `項次 ${i.no} 單價`, before: money(prev.unitPrice), after: money(i.unitPrice) })
        if (prev.qty !== i.qty) rows.push({ field: `項次 ${i.no} 數量`, before: String(prev.qty), after: String(i.qty) })
      }
    })
    b.items.forEach((i) => { if (!x.items.some((p) => p.custName === i.custName)) rows.push({ field: `項次 ${i.custName}`, before: `${i.qty} × ${money(i.unitPrice)}`, after: '（刪除）' }) })
    return rows
  })
  /** 送出上單簽核；成功回傳要顯示的訊息，呼叫端負責跳訊息與發事件 */
  function submit(): string | undefined {
    const x = q.value
    const d = deal.value
    if (blockers.value.length || !x || !d) return undefined
    const id = `a-${Date.now()}`
    const now = new Date()
    store.approvals.unshift({
      id,
      type: '上單',
      title: isRetry.value ? `${d.customer} ${d.product} 合約變更重審` : attempt.value > 1 ? `${d.customer} ${d.product}（第 ${attempt.value} 次送審）` : `${d.customer} ${d.product}`,
      refNo: d.dealNo,
      dealId: d.id,
      diff: isRetry.value ? diff.value : undefined,
      submitterId: store.currentUserId,
      submitter: store.currentUser.name,
      submittedAt: now.toISOString(),
      amount: revenue.value,
      cost: cost.value,
      quoteId: x.id,
      milestones: isRetry.value ? undefined : milestones.value.map((m) => ({ ...m })),
      route: routePreview.value,
      steps: routeResolved.value.steps,
      flags: flags.value,
      currentStep: 0,
      status: '待簽核',
      reason: reason.value || undefined,
      history: [{ role: store.role, name: store.currentUser.name, action: '送出', at: now.toISOString(), note: attempt.value > 1 && !isRetry.value ? '補件後重新送審' : undefined }],
    })
    store.todos.unshift({ id: `t-${now.getTime()}`, kind: '簽核', title: `${isRetry.value ? '上單重審' : attempt.value > 1 ? '上單補件重送' : '上單'}：${d.customer} ${d.product}`, refNo: d.dealNo, forRoles: [routePreview.value[0]!], forUserIds: routeResolved.value.steps[0]?.candidateIds, approvalId: id })
    if (isRetry.value) {
      x.submittedAt = now.toISOString()
      return `重審已送出，v${x.version} 鎖定；核准後 ${retryOrder.value!.soNo} 金額更新為 ${money(revenue.value)}`
    }
    /* SO 不在這裡產生：送審期間商機停在待接單，最後一關核准時才給 SO 編號 */
    x.submittedAt = now.toISOString()
    d.amount = revenue.value
    d.updatedAt = now.toISOString()
    return attempt.value > 1 ? `已重新送審（第 ${attempt.value} 次），v${x.version} 鎖定` : `已送審，v${x.version} 鎖定；最後一關核准時產生 SO 編號，商機自動轉為 SO已成立`
  }

  /* ---------- 上單條件卡（基本資料頁簽）用的彙整 ---------- */
  const order = computed(() => (deal.value ? orders.find((o) => o.dealId === deal.value!.id) : undefined))
  const quoteVersion = computed(() => q.value?.version)
  const state = computed<QuoteSubmitState>(() => {
    const d = deal.value
    const x = q.value
    if (!d) return 'no-quote'
    if (d.stage === '未成交') return 'lost'
    if (x && isRetry.value) {
      if (x.submittedAt && approvalPending.value) return 'retry-pending'
      if (!x.submittedAt && quoteApproval.value?.diff && quoteApproval.value.status === '已退回') return 'retry-returned'
      return 'retry-ready'
    }
    if (d.stage === 'SO已成立' || quoteApproval.value?.status === '已核准') return 'approved'
    if (approvalPending.value) return 'pending'
    if (isReturned.value) return 'returned'
    if (!x) return 'no-quote'
    if (x.status === '報價回簽' && !x.submittedAt) return 'ready'
    return 'draft'
  })
  const na = (key: SubmitChecklistItem['key'], label: string, detail: string): SubmitChecklistItem => ({ key, label, status: 'na', detail })
  /* 上單條件只列四項（成本、另行採購理由、送審理由由 blockers 擋，不另列）：廠商報價單、客戶報價單、請款條件、階段到待接單 */
  const checklistItems = computed<SubmitChecklistItem[]>(() => {
    const x = q.value
    const d = deal.value
    if (!x || !d) return [na('vendorFiles', '廠商報價單', '尚未建立報價單'), na('signback', '客戶報價單', '尚未建立報價單'), na('milestones', '請款條件', '—'), na('stage', '階段到「待接單」', d ? `目前 ${d.stage}` : '—')]
    const items: SubmitChecklistItem[] = []
    const needFiles = x.lines.filter(needsFile)
    items.push(!needFiles.length ? na('vendorFiles', '廠商報價單', '沒有採購項次') : { key: 'vendorFiles', label: '廠商報價單', status: missingFiles.value.length ? 'incomplete' : 'complete', detail: missingFiles.value.length ? `缺 ${missingFiles.value.length} 項` : `${needFiles.length} 項已附` })
    items.push({ key: 'signback', label: '客戶報價單', status: x.signbackFile ? 'complete' : 'incomplete', detail: x.signbackFile ? '已回簽' : '尚未回簽' })
    if (isRetry.value) items.push(na('milestones', '請款條件', '合約變更沿用原 SO'))
    else {
      const probs = milestoneProblems(milestones.value, revenue.value)
      items.push({ key: 'milestones', label: '請款條件', status: probs.length ? 'incomplete' : 'complete', detail: probs.length ? probs[0]! : `${milestones.value.length} 期` })
    }
    items.push(isRetry.value ? na('stage', '階段到「待接單」', '合約變更不適用') : { key: 'stage', label: '階段到「待接單」', status: stageOk.value ? 'complete' : 'incomplete', detail: stageOk.value ? '待接單' : `目前 ${d.stage}` })
    return items
  })
  const canSubmit = computed(() => submitStage.value && !blockers.value.length)
  /** 請款條件：報價還沒送審就能設定（草稿也可以），合計要等於報價合計，差額由上單條件提醒 */
  const canEditMilestones = computed(() => internalEditable.value && !isRetry.value && !!q.value)
  const submitLabel = computed(() => `${isRetry.value ? '重審送審' : isReturned.value ? '補件並重新送審' : '上單送審'}並鎖定 v${q.value?.version ?? ''}`)

  return { order, quoteVersion, state, checklistItems, canSubmit, canEditMilestones, submitLabel, deal, dealQuotes, q, salesSide, canNewVersion, changeOrder, isChangeQuote, isLatest, draftEditable, internalEditable, submitStage, isRetry, retryOrder, baseQuote, quoteApproval, approvalPending, returnedApproval, isReturned, lineEditable, attempt, lastReturnNote, superseded, withTax, revenue, cost, margin, linesOf, itemRevenue, itemCost, itemCostKnown, itemMargin, stockPart, buyPart, lineUnitCost, missingCost, needsFile, missingFiles, stockFor, canUseStock, stockMode, setStockMode, milestones, routeOf, routeResolved, routePreview, needReason, flags, stageOk, reason, blockers, diff, submit }
}
