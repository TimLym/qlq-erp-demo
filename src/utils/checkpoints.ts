import { purchaseOrders, shipments, quotes, natureOf, isGuarantee, type Order } from '../mock/data'

/*
 * SO 執行面的檢查點：下單、到貨、出貨、驗收、工程結案各自記，不卡關。
 * 後面已完成、前面還沒補的標 gap（琥珀色提醒，不擋操作）。列表與 SO 抽屜共用。
 */
export interface Checkpoint {
  key: 'order' | 'arrive' | 'ship' | 'accept' | 'eng'
  label: string
  done: boolean
  at: string
  wait: string
  gap: boolean
}

const mmdd = (d?: string) => (d ? d.slice(5).replace('-', '/') : '')

export function checkpointsOf(o: Order): Checkpoint[] {
  /* 保證單階段先開的預下單 PO 掛在「預下單 D-…」，也算這張單的 */
  const pos = purchaseOrders.filter((p) => p.soNo === o.soNo || (isGuarantee(o) && p.dealId === o.dealId && p.soNo === `預下單 ${o.dealNo}`))
  const ships = shipments.filter((sh) => sh.orderId === o.id)
  const signed = ships.filter((sh) => sh.status === '已簽收')
  /* 看實際資料，不看整體階段：先驗收未出貨時，出貨、下單要顯示未完成（琥珀色提醒），不能跟著驗收變成完成 */
  const goods = (quotes.find((x) => x.id === o.quoteId)?.lines ?? []).filter((l) => l.vendor !== '自有工程')
  const isLic = (sku: string) => goods.some((l) => l.intSku === sku && natureOf(l) === '授權')
  const needQty = goods.reduce((n, l) => n + l.qty, 0)
  /* 下單、到貨照料號數量比：要採購的量都有核准的 PO 才算下單完成，都收到才算到貨（授權原廠直寄，不必到貨） */
  const buyBySku = new Map<string, number>()
  goods.forEach((l) => buyBySku.set(l.intSku, (buyBySku.get(l.intSku) ?? 0) + l.qty - Math.min(l.stockQty ?? 0, l.qty)))
  const poQty = (sku: string, f: (p: (typeof pos)[number], q: number, rec: number) => number) =>
    pos.reduce((n, p) => n + p.lines.filter((l) => l.intSku === sku).reduce((m, l) => m + f(p, l.qty, l.received ?? (p.status === '已到貨' ? l.qty : 0)), 0), 0)
  const buySkus = [...buyBySku.entries()].filter(([, q]) => q > 0)
  const ordered = buySkus.every(([sku, q]) => poQty(sku, (p, n) => (p.status === '待核准' ? 0 : n)) >= q)
  const orderedSome = buySkus.some(([sku]) => poQty(sku, (p, n) => (p.status === '待核准' ? 0 : n)) > 0)
  const arrived = buySkus.filter(([sku]) => !isLic(sku)).every(([sku, q]) => poQty(sku, (_p, _n, rec) => rec) >= q)
  const arrivedSome = buySkus.some(([sku]) => !isLic(sku) && poQty(sku, (_p, _n, rec) => rec) > 0)
  const shippedQty = ships.flatMap((sh) => sh.lines).reduce((n, l) => n + l.qty, 0)
  /* 全部項次都出完才算完成；只有部分出貨標「進行中」；沒有實體項次（純服務）看階段 */
  const shipped = needQty > 0 ? shippedQty >= needQty : o.stageIndex >= 5
  const partial = ships.length > 0 && !shipped
  const accepted = o.stageIndex >= 6 || (shipped && ships.length > 0 && signed.length === ships.length)
  const list: Omit<Checkpoint, 'gap'>[] = [
    { key: 'order', label: '下單', done: ordered, at: mmdd(pos.map((p) => p.createdAt).sort()[0]), wait: !ordered && orderedSome ? '部分下單' : '' },
    { key: 'arrive', label: '到貨', done: arrived, at: mmdd(pos.map((p) => p.receivedAt ?? '').filter(Boolean).sort().pop()), wait: !arrived && arrivedSome ? '部分到貨' : '' },
    { key: 'ship', label: '出貨', done: shipped, at: mmdd(ships.map((sh) => sh.at).sort().pop()), wait: partial ? '部分出貨' : '' },
    { key: 'accept', label: '驗收', done: accepted, at: mmdd(signed.map((sh) => sh.signedAt ?? '').filter(Boolean).sort().pop()), wait: ships.length > 0 && signed.length < ships.length ? '待簽收' : '' },
    { key: 'eng', label: '工程結案', done: !!o.engClosedAt, at: mmdd(o.engClosedAt), wait: '' },
  ]
  const lastDone = list.map((c) => c.done).lastIndexOf(true)
  return list.map((c, i) => ({ ...c, gap: !c.done && i < lastDone }))
}

/** 還沒出貨的數量（實體與授權項次合計）：出貨不看整體階段，先驗收的單也能補出貨 */
export function remainingToShip(o: Order): number {
  const need = (quotes.find((x) => x.id === o.quoteId)?.lines ?? []).filter((l) => l.vendor !== '自有工程').reduce((n, l) => n + l.qty, 0)
  const shipped = shipments.filter((sh) => sh.orderId === o.id).flatMap((sh) => sh.lines).reduce((n, l) => n + l.qty, 0)
  return Math.max(0, need - shipped)
}
