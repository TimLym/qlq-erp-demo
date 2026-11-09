// 假資料一致性檢查（第三組）：金額對得上、日期順序合理
// 由 audit-mock.mjs 呼叫：checkDates(m, issues)
export function checkDates(m, issues) {
  const { deals, quotes, orders, approvals, todos, purchaseOrders, shipments, quoteTotal, lineCost, notifications } = m
  const day = (s) => (s ? String(s).slice(0, 10) : '')
  const before = (a, b) => !a || !b || day(a) <= day(b)
  const NOW = '2026-11-03'

  /* ---------- 金額 ---------- */
  for (const d of deals) {
    const signed = quotes.filter((q) => q.dealId === d.id && q.status === '報價回簽' && !(q.note ?? '').startsWith('合約變更')).sort((a, b) => b.version - a.version)[0]
    if (signed && quoteTotal(signed) !== d.amount) issues.push(`商機 ${d.dealNo}（${d.customer}）預估金額 ${d.amount} ≠ 回簽報價單 v${signed.version} 合計 ${quoteTotal(signed)}`)
    const draft = quotes.filter((q) => q.dealId === d.id && q.status === '草稿' && !(q.note ?? '').startsWith('合約變更')).sort((a, b) => b.version - a.version)[0]
    if (!signed && draft && quoteTotal(draft) !== d.amount && draft.items.length) issues.push(`商機 ${d.dealNo}（${d.customer}）預估金額 ${d.amount} ≠ 草稿報價單合計 ${quoteTotal(draft)}`)
  }
  for (const o of orders) {
    const q = quotes.find((x) => x.id === o.quoteId)
    if (!q) continue
    if (quoteTotal(q) !== o.amount) issues.push(`訂單 ${o.soNo} 金額 ${o.amount} ≠ 報價單合計 ${quoteTotal(q)}`)
    const cost = q.lines.reduce((n, l) => n + lineCost(l), 0)
    if (cost !== o.cost) issues.push(`訂單 ${o.soNo} 業務成本 ${o.cost} ≠ 報價單成本 ${cost}`)
    const a = approvals.find((x) => x.type === '上單' && x.dealId === o.dealId && x.status === '已核准' && !x.diff)
    if (a && a.amount !== o.amount) issues.push(`訂單 ${o.soNo} 金額 ${o.amount} ≠ 上單簽核 ${a.amount}`)
  }
  for (const a of approvals) {
    if (a.type !== '上單' || !a.quoteId) continue
    const q = quotes.find((x) => x.id === a.quoteId)
    if (q && quoteTotal(q) !== a.amount) issues.push(`簽核單 ${a.id}（${a.title}）金額 ${a.amount} ≠ 報價單合計 ${quoteTotal(q)}`)
  }
  for (const po of purchaseOrders) {
    for (const l of po.lines) {
      const o = orders.find((x) => x.soNo === po.soNo)
      const q = o ? quotes.find((x) => x.id === o.quoteId) : undefined
      const ql = q?.lines.find((x) => x.intSku === l.intSku)
      if (ql && ql.unitCost !== null && ql.unitCost !== l.unitCost && (o?.actualCost === undefined || o.actualCost === o.cost)) issues.push(`PO ${po.poNo} 項次 ${l.intSku} 單價 ${l.unitCost} ≠ 報價單成本 ${ql.unitCost}，但訂單沒有標成本異動（actualCost）`)
    }
  }

  /* ---------- 日期順序 ---------- */
  for (const q of quotes) {
    const d = deals.find((x) => x.id === q.dealId)
    if (q.submittedAt && !before(q.date, q.submittedAt)) issues.push(`報價單 ${q.id}（${d?.customer}）送審日 ${day(q.submittedAt)} 早於報價日 ${q.date}`)
  }
  for (const a of approvals) {
    const tag = `簽核單 ${a.id}（${a.title}）`
    let prev = a.submittedAt
    for (const h of a.history ?? []) {
      if (!before(prev, h.at)) issues.push(`${tag} 歷程「${h.action}」${day(h.at)} 早於前一步 ${day(prev)}`)
      prev = h.at
    }
    if (a.quoteId) {
      const q = quotes.find((x) => x.id === a.quoteId)
      if (q?.submittedAt && day(q.submittedAt) !== day(a.submittedAt)) issues.push(`${tag} 送審日 ${day(a.submittedAt)} ≠ 報價單送審日 ${day(q.submittedAt)}`)
    }
    if (!before(a.submittedAt, NOW)) issues.push(`${tag} 送審日在未來`)
  }
  for (const o of orders) {
    const tag = `訂單 ${o.soNo}（${o.customer}）`
    const log = [...(o.log ?? [])].sort((x, y) => x.at.localeCompare(y.at))
    const soAt = log.find((e) => e.text.includes('SO 成立'))?.at
    const a = approvals.find((x) => x.type === '上單' && x.dealId === o.dealId && x.status === '已核准' && !x.diff)
    const lastOk = a?.history?.filter((h) => h.action === '核准').pop()?.at
    if (soAt && lastOk && day(soAt) !== day(lastOk)) issues.push(`${tag} SO 成立紀錄 ${day(soAt)} ≠ 上單最後一關核准 ${day(lastOk)}`)
    if (soAt && !o.soNo.includes(day(soAt).replace(/-/g, '').slice(0, 8).replace(/^(\d{4})(\d{4})$/, '$1-$2'))) issues.push(`${tag} SO 編號日期與成立日 ${day(soAt)} 不符`)
    const pos = purchaseOrders.filter((p) => p.soNo === o.soNo)
    for (const po of pos) {
      if (soAt && !before(soAt, po.createdAt)) issues.push(`${tag} PO ${po.poNo} 建立日 ${po.createdAt} 早於 SO 成立 ${day(soAt)}`)
      if (po.receivedAt && !before(po.createdAt, po.receivedAt)) issues.push(`PO ${po.poNo} 到貨日 ${po.receivedAt} 早於建立日 ${po.createdAt}`)
      if (po.expectedAt && !before(po.createdAt, po.expectedAt)) issues.push(`PO ${po.poNo} 預計交期早於建立日`)
      const okAt = log.find((e) => e.text.includes(`PO ${po.poNo} 核准`))?.at
      if (okAt && !before(po.createdAt, okAt)) issues.push(`${tag} PO ${po.poNo} 核准紀錄 ${day(okAt)} 早於 PO 建立 ${po.createdAt}`)
      const inAt = log.find((e) => e.text.includes(`PO ${po.poNo} 到貨`))?.at
      if (inAt && po.receivedAt && day(inAt) !== po.receivedAt) issues.push(`${tag} PO ${po.poNo} 到貨紀錄 ${day(inAt)} ≠ PO 到貨日 ${po.receivedAt}`)
      for (const l of po.lines) for (const al of l.allocations ?? []) if (po.receivedAt && al.at !== po.receivedAt) issues.push(`PO ${po.poNo} 分配日 ${al.at} ≠ 到貨日 ${po.receivedAt}`)
    }
    const ships = shipments.filter((s) => s.orderId === o.id)
    for (const s of ships) {
      const recv = pos.map((p) => p.receivedAt).filter(Boolean).sort().pop()
      if (recv && !before(recv, s.at)) issues.push(`出貨單 ${s.shipNo} 出貨日 ${s.at} 早於 PO 到貨 ${recv}`)
      if (s.signedAt && !before(s.at, s.signedAt)) issues.push(`出貨單 ${s.shipNo} 簽收日早於出貨日`)
      const shipLog = log.find((e) => e.text.includes(`出貨單 ${s.shipNo}`))?.at
      if (shipLog && day(shipLog) !== s.at) issues.push(`${tag} 出貨紀錄 ${day(shipLog)} ≠ 出貨單日期 ${s.at}`)
      const signLog = log.find((e) => e.text.includes('客戶簽收'))?.at
      if (s.signedAt && signLog && day(signLog) !== s.signedAt) issues.push(`${tag} 簽收紀錄 ${day(signLog)} ≠ 出貨單簽收日 ${s.signedAt}`)
      for (const l of o.licenses) if (l.kind === '授權' && l.start && l.start !== s.at && ships.length === 1) issues.push(`${tag} 授權 ${l.name} 起日 ${l.start} ≠ 出貨日 ${s.at}`)
      if (s.signedAt) for (const l of o.licenses) if (l.kind !== '授權' && l.start && l.start !== s.signedAt && ships.length === 1) issues.push(`${tag} ${l.kind} ${l.name} 起日 ${l.start} ≠ 驗收日 ${s.signedAt}`)
    }
    const accepted = ships.map((s) => s.signedAt).filter(Boolean).sort().pop()
    o.milestones.forEach((ms, i) => {
      const t = `${tag} 第 ${i + 1} 期「${ms.label}」`
      if (ms.requestedAt && soAt && !before(soAt, ms.requestedAt)) issues.push(`${t} 申請日 ${ms.requestedAt} 早於 SO 成立`)
      if (ms.invoicedAt && !before(ms.requestedAt, ms.invoicedAt)) issues.push(`${t} 開票日早於申請日`)
      if (ms.paidAt && !before(ms.invoicedAt, ms.paidAt)) issues.push(`${t} 收款日早於開票日`)
      if (/驗收/.test(ms.label) && ms.requestedAt && accepted && !before(accepted, ms.requestedAt)) issues.push(`${t} 驗收後請款，但申請日 ${ms.requestedAt} 早於驗收 ${accepted}`)
      if (/驗收/.test(ms.label) && ms.requestedAt && !accepted) issues.push(`${t} 驗收後請款，但還沒驗收就申請了`)
      const reqLog = log.find((e) => e.text.includes(`第 ${i + 1} 期`) && e.text.includes('申請請款'))?.at
      if (reqLog && ms.requestedAt && day(reqLog) !== ms.requestedAt) issues.push(`${t} 申請紀錄 ${day(reqLog)} ≠ 申請日 ${ms.requestedAt}`)
      const invLog = ms.invoiceNo ? log.find((e) => e.text.includes(ms.invoiceNo))?.at : undefined
      if (invLog && ms.invoicedAt && day(invLog) !== ms.invoicedAt) issues.push(`${t} 開票紀錄 ${day(invLog)} ≠ 開票日 ${ms.invoicedAt}`)
      const paidLog = log.find((e) => e.text.includes(`第 ${i + 1} 期`) && e.text.includes('收款'))?.at
      if (paidLog && ms.paidAt && day(paidLog) !== ms.paidAt) issues.push(`${t} 收款紀錄 ${day(paidLog)} ≠ 收款日 ${ms.paidAt}`)
    })
    let prev = ''
    for (const e of log) {
      if (!before(e.at, NOW)) issues.push(`${tag} 流程紀錄「${e.text}」在未來`)
      prev = e.at
    }
    /* 階段對紀錄的順序：成立 → 已下單 → 已入庫 → 出貨 → 驗收 */
    const seq = ['SO 成立', '已下單', '已入庫', '出貨', '驗收'].map((k) => log.find((e) => e.text.includes(k))?.at).filter(Boolean)
    for (let i = 1; i < seq.length; i++) if (!before(seq[i - 1], seq[i])) issues.push(`${tag} 流程紀錄的執行階段順序不對（${seq.map(day).join(' → ')}）`)
  }
  for (const d of deals) {
    for (const t of d.engRequests ?? []) {
      if (t.assignedAt && !before(t.requestedAt, t.assignedAt)) issues.push(`服務單 ${t.requestNo} 派工早於申請`)
      if (t.arrivedAt && !before(t.assignedAt, t.arrivedAt)) issues.push(`服務單 ${t.requestNo} 到場早於派工`)
      if (t.completedAt && !before(t.arrivedAt, t.completedAt)) issues.push(`服務單 ${t.requestNo} 完成早於到場`)
      if (!before(t.requestedAt, NOW)) issues.push(`服務單 ${t.requestNo} 申請日在未來`)
    }
    if (!before(d.updatedAt, NOW)) issues.push(`商機 ${d.dealNo} 最後更新在未來`)
  }
  for (const t of todos) if (!before(t.createdAt, NOW)) issues.push(`代辦 ${t.id} 建立日在未來`)
  for (const n of notifications) if (!before(n.at, NOW)) issues.push(`通知 ${n.id} 時間在未來`)
}
