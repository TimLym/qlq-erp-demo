// 假資料一致性檢查（第二組）：報價單項次 ↔ 到期項目 ↔ 出貨單 ↔ 簽收 ↔ 流程紀錄 ↔ PO ↔ 庫存 ↔ 附件 ↔ 代辦 ↔ 人員
// 由 audit-mock.mjs 呼叫：checkExtra(m, issues)
export function checkExtra(m, issues) {
  const { deals, quotes, orders, approvals, todos, purchaseOrders, dealMembers, users, vendors, shipments, stock, attachments, notifications, natureOf, addMonths, warrantyOf, expiryKinds, comments, ep } = m
  const userIds = new Set(users.map((u) => u.id))
  const userNames = new Set(users.map((u) => u.name))
  const kindKeys = new Set(expiryKinds.map((k) => k.key))
  const needsExpiry = (n) => n === '授權' || n === '維護合約' || n === '服務合約'
  const buyPart = (l) => l.qty - Math.min(l.stockQty ?? 0, l.qty)

  /* ---------- 報價單項次 ---------- */
  for (const q of quotes) {
    const d = deals.find((x) => x.id === q.dealId)
    const tag = `報價單 ${q.id}（${d?.customer ?? '?'} v${q.version} ${q.status}）`
    const itemNos = new Set(q.items.map((i) => i.no))
    for (const l of q.lines) {
      if (!itemNos.has(l.itemNo)) issues.push(`${tag} 內部項次 ${l.no} 掛在不存在的對外項次 ${l.itemNo}`)
      const n = natureOf(l)
      if (needsExpiry(n) && !(l.months > 0)) issues.push(`${tag} 內部項次 ${l.no}「${l.extName}」性質 ${n} 沒有期間（月）${q.status === '草稿' ? '（草稿，儲存時會被擋）' : ''}`)
      if (q.status !== '草稿') {
        if (buyPart(l) > 0 && l.unitCost === null) issues.push(`${tag} 內部項次 ${l.no}「${l.extName}」已回簽但成本未填`)
        if (buyPart(l) > 0 && l.vendor !== '自有工程' && !l.vendorQuoteFile) issues.push(`${tag} 內部項次 ${l.no}「${l.extName}」已回簽但沒有廠商報價單`)
        if (l.vendor && l.vendor !== '自有工程' && !vendors.some((v) => v.name === l.vendor)) issues.push(`${tag} 內部項次 ${l.no} 的供應商 ${l.vendor} 不在供應商主檔`)
      }
    }
    for (const i of q.items) if (!q.lines.some((l) => l.itemNo === i.no)) issues.push(`${tag} 對外項次 ${i.no}「${i.custName}」沒有內部項次`)
    if (q.submittedAt && q.status !== '報價回簽') issues.push(`${tag} 已送審但狀態不是報價回簽`)
  }

  /* ---------- 訂單：到期項目、出貨、簽收、直送、驗收、流程紀錄、請款 ---------- */
  for (const o of orders) {
    const sp = ep.supplyProgress(o)
    const eg = ep.engProgress(o)
    const tag = `訂單 ${o.soNo}（${o.customer}，${o.acceptedAt ? '已驗收' : `到客戶 ${ep.pctText(sp.delivered)}`}）`
    const q = quotes.find((x) => x.id === o.quoteId)
    if (!q) { issues.push(`${tag} 沒有報價版本`); continue }
    const lineOf = (sku) => q.lines.find((l) => l.intSku === sku)
    const ships = shipments.filter((s) => s.orderId === o.id)
    const pos = ep.posOf(o)
    const shippedQty = (sku) => ships.flatMap((s) => s.lines).filter((l) => l.sku === sku).reduce((n, l) => n + l.qty, 0)
    const directQty = (sku) => pos.flatMap((p) => p.lines).filter((l) => l.intSku === sku && l.route === '直送').reduce((n, l) => n + (l.delivered ?? 0), 0)
    const handedOver = (sku) => shippedQty(sku) + directQty(sku)
    /* 到期項目：保固、維護、服務合約從驗收日起算；授權由工程確認起算（可待起算） */
    for (const l of o.licenses) {
      if (!kindKeys.has(l.kind)) issues.push(`${tag} 到期項目 ${l.name} 類型 ${l.kind} 不在到期類型清單`)
      const line = lineOf(l.sku)
      if (!line) { issues.push(`${tag} 到期項目 ${l.name}（${l.sku}）對不到報價單項次`); continue }
      const n = natureOf(line)
      const expectKind = n === '硬體' ? '保固' : n
      if (l.kind !== expectKind) issues.push(`${tag} 到期項目 ${l.name} 類型 ${l.kind}，但報價單項次性質是 ${n}（應為 ${expectKind}）`)
      if (l.qty !== line.qty) issues.push(`${tag} 到期項目 ${l.name} 數量 ${l.qty} ≠ 報價單項次 ${line.qty}`)
      if (l.kind === '保固') {
        if (l.months !== warrantyOf(l.sku)) issues.push(`${tag} 保固 ${l.name} 月數 ${l.months} ≠ 料號保固 ${warrantyOf(l.sku)}`)
      } else if (line.months && l.months !== line.months) issues.push(`${tag} 到期項目 ${l.name} 月數 ${l.months} ≠ 報價單期間 ${line.months}`)
      if (l.start && l.months && addMonths(l.start, l.months) !== l.expires) issues.push(`${tag} 到期項目 ${l.name} 起日 ${l.start} + ${l.months} 月 ≠ 到期 ${l.expires}`)
      if (l.kind !== '授權' && o.acceptedAt && !l.start) issues.push(`${tag} 已驗收，${l.kind} ${l.name} 應有起日（驗收日）`)
      if (l.kind !== '授權' && !o.acceptedAt && l.start) issues.push(`${tag} 未驗收，${l.kind} ${l.name} 不該有起日`)
      if ((l.kind === '授權' || l.kind === '保固') && handedOver(l.sku) === 0) issues.push(`${tag} ${l.kind} ${l.name} 還沒交貨（出貨或直送）就有到期項目`)
    }
    for (const l of q.lines) {
      const n = natureOf(l)
      const has = o.licenses.some((x) => x.sku === l.intSku)
      if ((n === '維護合約' || n === '服務合約') && !has) issues.push(`${tag} 報價單項次「${l.extName}」是${n}，SO 成立時應產生到期項目`)
      if (n === '授權' && handedOver(l.intSku) > 0 && !has) issues.push(`${tag} 授權「${l.extName}」已交貨但沒有到期項目`)
      if (n === '硬體' && shippedQty(l.intSku) > 0 && !has) issues.push(`${tag} 硬體「${l.extName}」已出貨但沒有保固到期項目`)
    }
    /* 出貨單：只出經公司倉的量 */
    const viaWh = sp.lines.reduce((n, l) => n + l.stockNeed, 0)
    const shipped = ships.flatMap((s) => s.lines).reduce((n, l) => n + l.qty, 0)
    if (shipped > viaWh) issues.push(`${tag} 出貨單合計 ${shipped} 超過經公司倉的需要量 ${viaWh}`)
    for (const s of ships) {
      if (s.soNo !== o.soNo || s.customer !== o.customer) issues.push(`出貨單 ${s.shipNo} 的 SO／客戶與訂單 ${o.soNo} 不一致`)
      for (const l of s.lines) if (!lineOf(l.sku)) issues.push(`出貨單 ${s.shipNo} 品項 ${l.sku} 不在報價單`)
      if (s.status === '已簽收' && (!s.signedAt || !s.method || !s.signFile)) issues.push(`出貨單 ${s.shipNo} 已簽收但缺簽收日／方式／簽收檔`)
      if (s.signFile && !attachments.some((a) => a.type === '出貨簽收' && a.refNo === o.soNo && a.fileName === s.signFile && !a.voided)) issues.push(`出貨單 ${s.shipNo} 的簽收檔 ${s.signFile} 不在附件`)
    }
    /* 整案驗收：貨都到客戶、工程 100%；附驗收單 */
    if (o.acceptedAt) {
      if (sp.delivered !== null && sp.delivered < 1) issues.push(`${tag} 已驗收，但貨還沒全部到客戶（${ep.pctText(sp.delivered)}）`)
      if (eg && eg.pct < 1) issues.push(`${tag} 已驗收，但工程還沒完成（${ep.pctText(eg.pct)}）`)
      if (!o.acceptFile || !attachments.some((a) => a.type === '驗收單' && a.refNo === o.soNo && a.fileName === o.acceptFile && !a.voided)) issues.push(`${tag} 已驗收但驗收單 ${o.acceptFile ?? '（無）'} 不在附件`)
      if (o.phase === '保證單') issues.push(`${tag} 保證單不該驗收`)
    }
    /* 部署服務單：正式訂單的每個自有工程項次都要有一張對應的服務單 */
    if (o.phase !== '保證單') {
      const d = deals.find((x) => x.id === o.dealId)
      for (const l of (o.lines ?? []).flatMap((it) => it.internal).filter((x) => x.vendor === '自有工程')) {
        if (!(d?.engRequests ?? []).some((t) => t.lineNo === l.no && t.status !== '已取消')) issues.push(`${tag} 自有工程項次 ${l.no}「${l.name}」沒有對應的部署服務單`)
      }
    }
    /* 流程紀錄 */
    const log = o.log ?? []
    const has = (t) => log.some((e) => e.text.includes(t))
    if (!log.length) issues.push(`${tag} 沒有流程紀錄`)
    if (o.phase !== '保證單' && !has('SO 成立')) issues.push(`${tag} 流程紀錄沒有「SO 成立」`)
    for (const p of pos.filter((x) => x.status !== '待核准' && !x.preOrder)) if (!has(`PO ${p.poNo} 核准`)) issues.push(`${tag} 流程紀錄沒有「PO ${p.poNo} 核准」`)
    for (const s of ships) if (!has(`出貨單 ${s.shipNo}`)) issues.push(`${tag} 流程紀錄沒有出貨單 ${s.shipNo}`)
    if (o.acceptedAt && !has('整案驗收')) issues.push(`${tag} 流程紀錄沒有「整案驗收」`)
    for (const e of log) {
      if (!userNames.has(e.by) && !e.by.includes('簽收')) issues.push(`${tag} 流程紀錄「${e.text}」操作人 ${e.by} 不在使用者清單`)
      if (!['執行', '財務', '合約'].includes(e.track)) issues.push(`${tag} 流程紀錄「${e.text}」階段 ${e.track} 不對`)
      if (/進入「[^」]+」階段/.test(e.text)) issues.push(`${tag} 流程紀錄「${e.text}」還在用舊的執行階段說法`)
    }
    /* 請款 */
    const sum = o.milestones.reduce((n, ms) => n + ms.amount, 0)
    if (sum !== o.amount) issues.push(`${tag} 請款條件合計 ${sum} ≠ 訂單金額 ${o.amount}`)
    o.milestones.forEach((ms, i) => {
      const t = `${tag} 第 ${i + 1} 期「${ms.label}」`
      if (ms.status !== '待請款' && !ms.requestedAt) issues.push(`${t} ${ms.status} 但沒有申請日`)
      if ((ms.status === '已開票' || ms.status === '已收款') && !(ms.invoiceNo && ms.invoicedAt)) issues.push(`${t} ${ms.status} 但沒有發票號碼／開票日`)
      if (ms.status === '已收款' && !ms.paidAt) issues.push(`${t} 已收款但沒有收款日`)
      if (ms.status !== '待請款' && !has('申請請款')) issues.push(`${t} 已申請請款但流程紀錄沒有`)
      if (ms.invoiceNo && !has(ms.invoiceNo)) issues.push(`${t} 發票 ${ms.invoiceNo} 不在流程紀錄`)
      if (ms.status === '已收款' && !has('收款')) issues.push(`${t} 已收款但流程紀錄沒有`)
      if (ms.status === '已申請' && !todos.some((x) => x.kind === '付款' && x.refNo === o.soNo && x.title.includes(`第 ${i + 1} 期`))) issues.push(`${t} 等會計開票但沒有開立發票代辦`)
      if (ms.collectRequestedAt && ms.status !== '已開票' && ms.status !== '已收款') issues.push(`${t} 還沒開票就通知收款`)
    })
    /* PO */
    const needBuy = q.lines.some((l) => l.vendor !== '自有工程' && buyPart(l) > 0)
    if (o.phase !== '保證單' && !o.acceptedAt && needBuy && !pos.length && !todos.some((x) => x.kind === '下單' && x.refNo === o.soNo)) issues.push(`${tag} 需要採購但沒有 PO 也沒有「建立 PO」代辦`)
    if (pos.some((p) => p.status !== '待核准') && o.phase !== '保證單' && o.actualCost === undefined) issues.push(`${tag} 有核准的 PO 但沒有公司實際成本`)
    /* 簽收代辦 */
    const unsigned = ships.some((s) => s.status === '已出貨')
    const signTodo = todos.some((x) => x.kind === '簽收' && x.refNo === o.soNo)
    if (unsigned && !signTodo) issues.push(`${tag} 有待簽收的出貨單但沒有簽收代辦`)
    if (!unsigned && signTodo) issues.push(`${tag} 沒有待簽收的出貨單卻有簽收代辦`)
  }

  /* ---------- PO ---------- */
  for (const po of purchaseOrders) {
    const tag = `PO ${po.poNo}（${po.vendor}，${po.status}）`
    if (!vendors.some((v) => v.name === po.vendor)) issues.push(`${tag} 供應商不在主檔`)
    const amt = po.lines.reduce((n, l) => n + l.qty * l.unitCost, 0)
    if (po.lines.length && amt !== po.amount) issues.push(`${tag} 金額 ${po.amount} ≠ 項次合計 ${amt}`)
    if (po.status === '已到貨') {
      if (!po.receivedAt) issues.push(`${tag} 已到貨但沒有到貨日`)
      for (const l of po.lines) if ((l.received ?? 0) < l.qty) issues.push(`${tag} 已到貨但項次「${l.extName}」只到 ${l.received ?? 0}/${l.qty}`)
    }
    if (po.status === '待核准' && !approvals.some((a) => a.type === 'PO' && a.refNo === po.poNo && a.status === '待簽核')) issues.push(`${tag} 待核准但沒有送審中的 PO 簽核單`)
    if (po.status !== '待核准' && approvals.some((a) => a.type === 'PO' && a.refNo === po.poNo && a.status === '待簽核')) issues.push(`${tag} 已核准卻還有送審中的簽核單`)
    const o = orders.find((x) => x.soNo === po.soNo)
    const d = po.dealId ? deals.find((x) => x.id === po.dealId) : undefined
    const q = o ? quotes.find((x) => x.id === o.quoteId) : d ? quotes.filter((x) => x.dealId === d.id && x.status === '報價回簽').sort((a, b) => b.version - a.version)[0] : undefined
    if (q) for (const l of po.lines) {
      const ql = q.lines.find((x) => x.intSku === l.intSku)
      if (!ql) issues.push(`${tag} 項次 ${l.intSku} 不在報價單`)
      else if (l.qty > ql.qty) issues.push(`${tag} 項次 ${l.intSku} 數量 ${l.qty} 超過報價單 ${ql.qty}`)
    }
    for (const l of po.lines) for (const a of l.allocations ?? []) {
      if (a.target !== '公司庫存' && !orders.some((x) => x.soNo === a.target)) issues.push(`${tag} 分配目標 ${a.target} 不存在`)
    }
  }
  for (const st of stock) {
    if (st.poNo && !purchaseOrders.some((p) => p.poNo === st.poNo)) issues.push(`庫存批次 ${st.batch} 的 PO ${st.poNo} 不存在`)
  }

  /* ---------- 簽核單 ---------- */
  for (const a of approvals) {
    const tag = `簽核單 ${a.id}（${a.title}）`
    if (a.currentStep < 0 || a.currentStep > a.route.length) issues.push(`${tag} currentStep ${a.currentStep} 超出路由`)
    if (a.status === '已核准' && a.currentStep !== a.route.length) issues.push(`${tag} 已核准但 currentStep ${a.currentStep} ≠ ${a.route.length}`)
    const last = a.history?.[a.history.length - 1]
    if (!last) issues.push(`${tag} 沒有簽核歷程`)
    else {
      if (a.status === '已退回' && last.action !== '退回') issues.push(`${tag} 已退回但最後動作是 ${last.action}`)
      if (a.status === '已收回' && last.action !== '收回') issues.push(`${tag} 已收回但最後動作是 ${last.action}`)
      if (a.status === '已核准' && last.action !== '核准') issues.push(`${tag} 已核准但最後動作是 ${last.action}`)
      const approvedSteps = a.history.filter((h) => h.action === '核准').length
      if (a.status === '待簽核' && approvedSteps !== a.currentStep) issues.push(`${tag} 歷程核准 ${approvedSteps} 關，但 currentStep=${a.currentStep}`)
    }
    for (const h of a.history ?? []) if (!userNames.has(h.name)) issues.push(`${tag} 歷程人員 ${h.name} 不在使用者清單`)
    if (a.type === '上單' && a.status === '已核准' && a.dealId) {
      const o = orders.find((x) => x.dealId === a.dealId)
      if (o && a.quoteId && o.quoteId !== a.quoteId && !a.diff) issues.push(`${tag} 核准的報價版本 ${a.quoteId} ≠ 訂單生效版本 ${o.quoteId}`)
    }
    if (a.type === 'PO' && !purchaseOrders.some((p) => p.poNo === a.refNo)) issues.push(`${tag} 的 PO ${a.refNo} 不存在`)
    if (!userIds.has(a.submitterId)) issues.push(`${tag} 送件人 ${a.submitterId} 不存在`)
  }

  /* ---------- 服務單、成員、人員 ---------- */
  for (const d of deals) {
    if (!userIds.has(d.ownerId)) issues.push(`商機 ${d.dealNo} 負責人 ${d.ownerId} 不存在`)
    if (users.find((u) => u.id === d.ownerId)?.name !== d.owner) issues.push(`商機 ${d.dealNo} 負責人名字 ${d.owner} 與 ${d.ownerId} 不符`)
    for (const t of d.engRequests ?? []) {
      if (t.status === '已完成' && !(t.completedAt && t.arrivedAt && t.workSummary)) issues.push(`服務單 ${t.requestNo} 已完成但缺完成時間／到場時間／服務內容`)
      if (t.status === '已派工' && !(t.assignedAt && t.assignedById)) issues.push(`服務單 ${t.requestNo} 已派工但缺派工時間／派工人`)
      if (t.status === '已退回' && !t.rejectReason) issues.push(`服務單 ${t.requestNo} 已退回但沒有原因`)
      if (!userIds.has(t.requestedById)) issues.push(`服務單 ${t.requestNo} 申請人 ${t.requestedById} 不存在`)
      for (const id of t.assigneeIds) if (!userIds.has(id)) issues.push(`服務單 ${t.requestNo} 工程師 ${id} 不存在`)
    }
  }
  for (const mb of dealMembers) {
    if (!userIds.has(mb.userId)) issues.push(`成員 ${mb.userId} 不存在`)
    if (!deals.some((d) => d.id === mb.dealId)) issues.push(`成員 ${mb.userId} 的商機 ${mb.dealId} 不存在`)
  }
  for (const c of comments) if (!deals.some((d) => d.id === c.dealId)) issues.push(`留言 ${c.id} 的商機 ${c.dealId} 不存在`)
  for (const n of notifications) for (const id of n.forUserIds ?? []) if (!userIds.has(id)) issues.push(`通知 ${n.id} 的使用者 ${id} 不存在`)
  for (const t of todos) {
    for (const id of t.forUserIds ?? []) if (!userIds.has(id)) issues.push(`代辦 ${t.id} 的使用者 ${id} 不存在`)
    if (t.kind === '到期') issues.push(`代辦 ${t.id} 是到期代辦（已改為動態計算，不應有種子）`)
  }
  /* ---------- 附件 ---------- */
  for (const a of attachments) {
    const ref = a.refNo.replace(/ v\d+$/, '')
    const ok = deals.some((d) => d.dealNo === ref) || orders.some((o) => o.soNo === ref) || purchaseOrders.some((p) => p.poNo === ref) || vendors.some((v) => v.vendorNo === ref) || ref.startsWith('APP-')
    if (!ok) issues.push(`附件 ${a.id}（${a.fileName}）的單號 ${a.refNo} 對不到任何單`)
    if (a.type === '出貨簽收' && !a.voided && !shipments.some((s) => s.soNo === a.refNo && s.signFile === a.fileName)) issues.push(`附件 ${a.id}（${a.fileName}）是簽收檔，但沒有出貨單用它`)
    if (a.type === '驗收單' && !a.voided && !orders.some((o) => o.soNo === a.refNo && o.acceptFile === a.fileName)) issues.push(`附件 ${a.id}（${a.fileName}）是驗收單，但 ${a.refNo} 沒有用它驗收`)
    if (a.type === '廠商報價單') {
      const q = quotes.find((x) => deals.find((d) => d.id === x.dealId)?.dealNo === ref && `${ref} v${x.version}` === a.refNo)
      if (q && !q.lines.some((l) => l.vendorQuoteFile === a.fileName)) issues.push(`附件 ${a.id}（${a.fileName}）沒有任何內部項次對應`)
    }
    if (a.type === '客戶回簽') {
      const d = deals.find((x) => x.dealNo === ref)
      if (d && !quotes.some((q) => q.dealId === d.id && q.signbackFile === a.fileName)) issues.push(`附件 ${a.id}（${a.fileName}）沒有報價版本把它當回簽檔`)
    }
    if (!userNames.has(a.uploader)) issues.push(`附件 ${a.id} 上傳人 ${a.uploader} 不在使用者清單`)
  }
  for (const q of quotes) {
    const d = deals.find((x) => x.id === q.dealId)
    if (q.signbackFile && !attachments.some((a) => a.type === '客戶回簽' && a.fileName === q.signbackFile)) issues.push(`報價單 ${q.id}（${d?.customer}）回簽檔 ${q.signbackFile} 不在附件`)
    for (const l of q.lines) if (l.vendorQuoteFile && !attachments.some((a) => a.type === '廠商報價單' && a.fileName === l.vendorQuoteFile)) issues.push(`報價單 ${q.id}（${d?.customer}）廠商報價單 ${l.vendorQuoteFile} 不在附件`)
  }

  /* 批次 1：SO 訂單明細快照、工程結案 */
  for (const o of orders) {
    if (!o.lines || !o.lines.length) { issues.push(`訂單 ${o.soNo} 沒有訂單明細快照`); continue }
    const total = o.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0)
    if (total !== o.amount) issues.push(`訂單 ${o.soNo} 訂單明細合計 ${total} ≠ 訂單金額 ${o.amount}`)
    const allPaid = o.milestones.length > 0 && o.milestones.every((x) => x.status === '已收款')
    if (o.engClosedAt && m.ep.deployTickets(o).some((t) => !['已完成', '已取消'].includes(t.status))) issues.push(`訂單 ${o.soNo} 工程結案但還有部署服務單沒完成`)
    o.milestones.forEach((x, i) => { if (!x.planInvoiceAt || !x.planPayAt) issues.push(`訂單 ${o.soNo} 第 ${i + 1} 期沒有預計開票日或預計付款日`); else if (x.planPayAt < x.planInvoiceAt) issues.push(`訂單 ${o.soNo} 第 ${i + 1} 期預計付款日早於預計開票日`) })
    if (o.acceptedAt && allPaid && !o.engClosedAt) issues.push(`訂單 ${o.soNo} 已驗收且收齊但沒有工程結案日，列表會一直顯示未結案`)
  }
}
