import { purchaseOrders, shipments, stock, deals, isGuarantee, milestoneTaxes, orderTaxTotal, type Order, type OrderLine } from '../mock/data'

/*
 * 訂單執行進度（2026-11-17 規劃_訂單執行進度.md）
 * - 分母是訂單明細，百分比照未稅售價加權；不看 PO 張數。
 * - 對外項次的金額依內部項次成本（沒有成本時依數量）分給內部項次。
 * - 自有工程項次不算供應商採購，改算工程進度（部署服務單）。
 * - 路線：PO 項次選「公司倉」或「直送」；直送登記送達就算到客戶，公司倉要客戶簽收出貨單才算。
 */

export type Route = '公司倉' | '直送'

export interface SupplyLine {
  itemNo: number
  intSku: string
  name: string
  nature: string
  need: number
  /** 這個內部項次分到的未稅金額 */
  weight: number
  ordered: number
  received: number
  /** 經公司倉的部分：已入庫（含已出貨）數量，與經公司倉的需求數量 */
  stocked: number
  stockNeed: number
  delivered: number
  /** 已出貨、還沒簽收 */
  pendingSign: number
  /** 直送數量（PO 項次選直送的） */
  direct: number
  poNos: string[]
}

export interface SupplyProgress {
  lines: SupplyLine[]
  /** 0–1；沒有要交貨的項次時為 null */
  ordered: number | null
  received: number | null
  stocked: number | null
  delivered: number | null
  /** 經公司倉的數量：已入庫／需要 */
  stockedQty: number
  stockNeedQty: number
  pendingSign: number
}

/** 這張訂單相關的 PO：正式訂單掛 orderId 或 soNo；保證單另含預下單 PO */
export function posOf(o: Pick<Order, 'id' | 'soNo' | 'dealId' | 'dealNo' | 'phase'>) {
  return purchaseOrders.filter((p) => p.orderId === o.id || p.soNo === o.soNo || (isGuarantee(o) && p.dealId === o.dealId && p.soNo === `預下單 ${o.dealNo}`))
}

/** 內部項次分到的未稅金額 */
function weightedInternals(lines: OrderLine[]) {
  return lines.flatMap((it) => {
    const amount = it.qty * it.unitPrice
    const base = it.internal.map((l) => (l.unitCost ?? 0) * l.qty)
    const sum = base.reduce((n, x) => n + x, 0)
    const qtySum = it.internal.reduce((n, l) => n + l.qty, 0) || 1
    return it.internal.map((l, i) => ({ item: it, l, weight: sum > 0 ? (amount * base[i]!) / sum : (amount * l.qty) / qtySum }))
  })
}

const ratio = (num: number, den: number) => (den > 0 ? Math.min(1, num / den) : 0)

export function supplyProgress(o: Order): SupplyProgress {
  const all = weightedInternals(o.lines ?? [])
  const goods = all.filter((x) => x.l.vendor !== '自有工程')
  const pos = posOf(o).filter((p) => p.status !== '待核准')
  const ships = shipments.filter((s) => s.orderId === o.id)

  /* 依料號彙總可用量，再照項次順序分給同料號的內部項次；PO 項次記了來源內部項次（srcLineNo）的，先歸給那一個項次 */
  const pool = new Map<string, { ordered: number; inWh: number; shipped: number; signed: number; directPlan: number; directDone: number; pos: Set<string> }>()
  const get = (sku: string) => {
    if (!pool.has(sku)) pool.set(sku, { ordered: 0, inWh: 0, shipped: 0, signed: 0, directPlan: 0, directDone: 0, pos: new Set() })
    return pool.get(sku)!
  }
  pos.forEach((p) =>
    p.lines.forEach((l) => {
      const x = get(l.srcLineNo !== undefined ? `#${l.srcLineNo}` : l.intSku)
      get(l.intSku).pos.add(p.poNo)
      /* 到貨時分給別張訂單或公司庫存的量不算這張的 */
      const elsewhere = (l.allocations ?? []).filter((a) => a.target !== o.soNo).reduce((n, a) => n + a.qty, 0)
      const mine = l.qty - elsewhere
      if (mine <= 0) return
      if (l.route === '直送') {
        x.directPlan += mine
        x.directDone += Math.min(mine, l.delivered ?? 0)
        x.ordered += mine
      } else {
        /* 公司倉：已分配給這張的量會出現在庫存保留或出貨單，這裡只加還沒到的部分，避免重算 */
        const allocatedHere = (l.allocations ?? []).filter((a) => a.target === o.soNo).reduce((n, a) => n + a.qty, 0)
        x.ordered += Math.max(0, mine - allocatedHere)
      }
    }),
  )
  stock.filter((s) => s.reservedFor === o.soNo).forEach((s) => (get(s.sku).inWh += s.reserved))
  ships.forEach((s) =>
    s.lines.forEach((l) => {
      const x = get(l.sku)
      x.shipped += l.qty
      if (s.status === '已簽收') x.signed += l.qty
    }),
  )

  const left = new Map<string, { ordered: number; received: number; stocked: number; delivered: number; pending: number; direct: number }>()
  /* 內部項次號碼的池（#項次）只有 PO 的量；庫存保留與出貨單仍照料號 */
  pool.forEach((x, sku) => {
    const received = x.inWh + x.shipped + x.directDone
    left.set(sku, {
      ordered: x.ordered + x.inWh + x.shipped,
      received,
      stocked: x.inWh + x.shipped,
      delivered: x.signed + x.directDone,
      pending: x.shipped - x.signed,
      direct: x.directPlan,
    })
  })
  const take1 = (key: string, k: 'ordered' | 'received' | 'stocked' | 'delivered' | 'pending' | 'direct', want: number) => {
    const x = left.get(key)
    if (!x) return 0
    const t = Math.max(0, Math.min(x[k], want))
    x[k] -= t
    return t
  }
  /* 先拿記在這個項次的，再拿同料號共用的 */
  let curNo = -1
  const take = (sku: string, k: 'ordered' | 'received' | 'stocked' | 'delivered' | 'pending' | 'direct', want: number) => {
    const a = take1(`#${curNo}`, k, want)
    return a + take1(sku, k, want - a)
  }

  const lines: SupplyLine[] = goods.map(({ item, l, weight }) => {
    curNo = l.no
    const need = l.qty
    const direct = take(l.intSku, 'direct', need)
    const stockNeed = need - direct
    return {
      itemNo: item.no,
      intSku: l.intSku,
      name: l.name,
      nature: l.nature,
      need,
      weight,
      ordered: take(l.intSku, 'ordered', need),
      received: take(l.intSku, 'received', need),
      stocked: take(l.intSku, 'stocked', stockNeed),
      stockNeed,
      delivered: take(l.intSku, 'delivered', need),
      pendingSign: take(l.intSku, 'pending', need),
      direct,
      poNos: [...new Set([...(pool.get(l.intSku)?.pos ?? []), ...(pool.get(`#${l.no}`)?.pos ?? [])])],
    }
  })
  const W = lines.reduce((n, x) => n + x.weight, 0)
  const pct = (k: 'ordered' | 'received' | 'delivered') => (W > 0 ? lines.reduce((n, x) => n + x.weight * ratio(x[k], x.need), 0) / W : null)
  const stockW = lines.reduce((n, x) => n + (x.stockNeed > 0 ? x.weight * (x.stockNeed / x.need) : 0), 0)
  return {
    lines,
    ordered: pct('ordered'),
    received: pct('received'),
    delivered: pct('delivered'),
    stocked: stockW > 0 ? lines.reduce((n, x) => n + (x.stockNeed > 0 ? x.weight * (x.stockNeed / x.need) * ratio(x.stocked, x.stockNeed) : 0), 0) / stockW : null,
    stockedQty: lines.reduce((n, x) => n + x.stocked, 0),
    stockNeedQty: lines.reduce((n, x) => n + x.stockNeed, 0),
    pendingSign: lines.reduce((n, x) => n + x.pendingSign, 0),
  }
}

/** 這張訂單自有工程項次對應的部署服務單（有 lineNo 且對得到項次）；售前諮詢、POC、勘查等不算 */
export function deployTickets(o: Order) {
  const nos = new Set((o.lines ?? []).flatMap((it) => it.internal).filter((l) => l.vendor === '自有工程').map((l) => l.no))
  return (deals.find((d) => d.id === o.dealId)?.engRequests ?? []).filter((t) => t.lineNo !== undefined && nos.has(t.lineNo))
}

/** 這張訂單某料號還要進公司倉的量（扣掉已保留、已出貨；直送的不算）：PO 到貨分配、PO 分配頁用 */
export function warehouseShortOf(o: Order, sku: string): number {
  return supplyProgress(o)
    .lines.filter((l) => l.intSku === sku)
    .reduce((n, l) => n + Math.max(0, l.stockNeed - l.stocked), 0)
}

/** 工程進度：對應自有工程項次的部署服務單，照項次金額加權；沒有自有工程時為 null */
export function engProgress(o: Order): { pct: number; tickets: { requestNo: string; title: string; status: string; lineNo: number }[] } | null {
  const own = weightedInternals(o.lines ?? []).filter((x) => x.l.vendor === '自有工程')
  if (!own.length) return null
  const ts = (deals.find((d) => d.id === o.dealId)?.engRequests ?? []).filter((t) => t.lineNo !== undefined && t.status !== '已取消')
  const W = own.reduce((n, x) => n + x.weight, 0)
  const done = own.reduce((n, x) => {
    const mine = ts.filter((t) => t.lineNo === x.l.no)
    const d = mine.length ? mine.filter((t) => t.status === '已完成').length / mine.length : 0
    return n + x.weight * d
  }, 0)
  return { pct: W > 0 ? done / W : 0, tickets: ts.map((t) => ({ requestNo: t.requestNo, title: t.title, status: t.status, lineNo: t.lineNo! })) }
}

/** 驗收條件：貨都到客戶（沒有要交貨的不看）＋工程 100%（沒有工程的不看）；保證單、作廢、合約變更中、已驗收不能按 */
export function canAccept(o: Order): { ok: boolean; reason: string } {
  if (o.acceptedAt) return { ok: false, reason: '已驗收' }
  if (isGuarantee(o)) return { ok: false, reason: '保證單不驗收' }
  if (o.changeQuoteId) return { ok: false, reason: '合約變更期間暫停驗收' }
  const s = supplyProgress(o)
  const e = engProgress(o)
  const gaps: string[] = []
  if (s.delivered !== null && s.delivered < 1) gaps.push(`採購 ${pctText(s.delivered)}`)
  if (e && e.pct < 1) gaps.push(`工程 ${pctText(e.pct)}`)
  return gaps.length ? { ok: false, reason: `${gaps.join('、')}，還不能驗收` } : { ok: true, reason: '' }
}

export const pctText = (v: number | null) => (v === null ? '—' : `${Math.floor(v * 100)}%`)

/** 開票、收款進度（含稅）：金額、％、筆數 */
export function billingProgress(o: Pick<Order, 'amount' | 'taxTotal' | 'milestones'>) {
  const mt = milestoneTaxes(o)
  const total = orderTaxTotal(o)
  const ms = o.milestones
  const isInv = (s: string) => s === '已開票' || s === '已收款'
  const invoiced = ms.reduce((n, m, i) => n + (isInv(m.status) ? mt[i]! : 0), 0)
  const paid = ms.reduce((n, m, i) => n + (m.status === '已收款' ? mt[i]! : 0), 0)
  const invCount = ms.filter((m) => isInv(m.status)).length
  const paidCount = ms.filter((m) => m.status === '已收款').length
  return {
    total,
    count: ms.length,
    invoiced,
    uninvoiced: total - invoiced,
    invoicedPct: total > 0 ? invoiced / total : 0,
    invCount,
    uninvCount: ms.length - invCount,
    paid,
    unpaid: total - paid,
    paidPct: total > 0 ? paid / total : 0,
    paidCount,
    unpaidCount: ms.length - paidCount,
    /** 待開票：還沒開票的期數；待收款：已開票未收款的期數 */
    toInvoice: ms.length - invCount,
    toCollect: invCount - paidCount,
  }
}

/** 經公司倉、還沒建出貨單的數量（直送的不用出貨單） */
export function remainingToShip(o: Order): number {
  const s = supplyProgress(o)
  const shipped = shipments.filter((x) => x.orderId === o.id).flatMap((x) => x.lines).reduce((n, l) => n + l.qty, 0)
  return Math.max(0, s.lines.reduce((n, l) => n + l.stockNeed, 0) - shipped)
}
