<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Paperclip, Upload, Plus, Delete, View, Download, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import UploadDialog from './UploadDialog.vue'
import { routing } from '../mock/routing'
import { useQuoteSubmit } from '../composables/useQuoteSubmit'
import { quotes, orders, transferOf, vendors, milestonesFromTemplate, quoteTotal, quoteTaxTotal, lineCost, ownServices, stockHolds, TAX_RATE, type Quote, type QuoteItem, type QuoteLine, type LineNature, natureOf, hasExpiry } from '../mock/data'
import { useAppStore } from '../stores/app'
import { money, pct } from '../utils/format'

/*
 * 報價單版本工作區：一張版本就是一張工作單。
 * 上面是報價明細：對外項次（客戶看得到）配一到多個內部項次（成本、供應商）；
 * 中間是廠商報價單（選內部項次與供應商上傳）；下面是請款條件；右邊是回簽、毛利、路由與送審。
 * 狀態只有兩種：草稿（什麼都能改，含成本與庫存）與報價回簽（上傳客戶回簽後內容鎖定）。
 * 回簽版本在送審前只能補廠商報價單、請款條件與送審理由；上單送審後整版鎖定（submittedAt）。
 * 每個商機最多一版草稿加一版報價回簽（合約變更時從回簽版複製新草稿）。
 */
const props = defineProps<{ dealId: string; initialQuoteId?: string; /** 從上單條件卡點過來要點亮的區塊 */ highlight?: 'vendorFiles' | 'signback' | null }>()
const emit = defineEmits<{ (e: 'submitted'): void; (e: 'comment', text: string): void; (e: 'open-approval', id: string): void; (e: 'open-basic'): void }>()
const store = useAppStore()

const activeQuoteId = ref<string>(props.initialQuoteId ?? '')
watch(() => props.initialQuoteId, (id) => { if (id) activeQuoteId.value = id })
const core = useQuoteSubmit(toRef(props, 'dealId'), activeQuoteId)
const { deal, dealQuotes, q, canNewVersion, changeOrder, isChangeQuote, draftEditable, internalEditable, isRetry, baseQuote, isReturned, lineEditable, lastReturnNote, superseded, withTax, revenue, revenueTax, itemTax, cost, margin, linesOf, itemRevenue, itemCost, itemCostKnown, itemMargin, stockPart, buyPart, lineUnitCost, missingCost, needsFile, missingFiles, stockFor, canUseStock, stockMode, setStockMode, diff } = core

/** 已有草稿就不能再複製新版本 */
const hasDraft = computed(() => dealQuotes.value.some((x) => x.status === '草稿'))

/* 內部欄位可收合：內部數量、內部單價、內部成本、此項總毛利 */
const showInternal = ref(true)
/** 每欄固定寬度，表格總寬超過容器就出橫向卷軸；收合時左邊欄位不變寬 */
/* 每欄固定寬，收合內部欄位時其他欄位不動；總寬超過容器出橫向卷軸 */
const COLS = { no: 76, item: 200, desc: 160, qty: 80, price: 112, amount: 128, lineNo: 80, line: 220, lineQty: 80, cost: 112, lineCost: 128, profit: 112, rate: 84, file: 170 }
const foldCols: (keyof typeof COLS)[] = ['lineQty', 'cost', 'lineCost', 'profit']
const tableWidth = computed(() => (Object.keys(COLS) as (keyof typeof COLS)[]).reduce((sum, k) => sum + (!showInternal.value && foldCols.includes(k) ? 0 : COLS[k]), 0))
const w = (k: keyof typeof COLS) => ({ width: COLS[k] + 'px' })


/* ---------- 草稿：對外與內部項次編輯 ---------- */
const today = () => new Date().toISOString().slice(0, 10)
const vendorStatus = (name: string) => vendors.find((v) => v.name === name)?.status
const isOwn = (l: QuoteLine) => l.vendor === '自有工程'
/** 草稿勾自有工程：不用廠商報價單、不用庫存 */
function setOwn(l: QuoteLine, own: boolean) {
  l.vendor = own ? '自有工程' : ''
  l.vendorQuoteFile = undefined
  l.bargaining = undefined
  if (own) {
    l.stockQty = 0
    l.intSku = ''
    l.unitCost = null
  }
}
/* 自有服務項目：選了就帶 SKU、名稱與標準成本，成本不讓業務改 */
const activeServices = computed(() => ownServices.filter((x) => x.active))
const serviceOf = (l: QuoteLine) => ownServices.find((x) => x.code === l.intSku)
function pickService(l: QuoteLine, code: string) {
  const svc = ownServices.find((x) => x.code === code)
  if (!svc) return
  l.intSku = svc.code
  l.extName = svc.name
  l.unitCost = svc.cost
  l.nature = '單次服務'
}

/* ---------- 含稅發起：輸入含稅單價，未稅單價換算（合計以含稅加總） ---------- */
const taxIn = computed(() => q.value?.taxMode === '含稅')
async function setTaxMode(mode: '未稅' | '含稅') {
  const x = q.value
  if (!x || (x.taxMode ?? '未稅') === mode) return
  if (mode === '未稅' && x.items.some((i) => (i.unitPriceTax ?? 0) > 0)) {
    const before = quoteTotal(x)
    const after = x.items.reduce((n, i) => n + i.qty * Math.round(i.unitPrice), 0)
    if (before !== after) {
      const ok = await ElMessageBox.confirm(`未稅單價會四捨五入成整數，未稅合計 ${money(before)} 變成 ${money(after)}。`, '改回未稅發起', { confirmButtonText: '改回未稅', cancelButtonText: '取消', type: 'warning' }).then(() => true, () => false)
      if (!ok) return
    }
  }
  x.taxMode = mode === '含稅' ? '含稅' : undefined
  x.items.forEach((i) => {
    if (mode === '含稅') i.unitPriceTax = Math.round(i.unitPrice * (1 + TAX_RATE))
    else {
      i.unitPrice = Math.round(i.unitPrice)
      i.unitPriceTax = undefined
    }
    syncNet(i)
  })
}
function syncNet(i: QuoteItem) {
  if (taxIn.value) i.unitPrice = (i.unitPriceTax ?? 0) / (1 + TAX_RATE)
}

/* ---------- 預留貨申請 ---------- */
const holdOf = (l: QuoteLine) => stockHolds.find((h) => h.dealId === deal.value?.id && h.sku === l.intSku && (h.status === '待核准' || h.status === '保留中'))
const holdDlg = ref<{ open: boolean; line: QuoteLine | null; qty: number; days: number }>({ open: false, line: null, qty: 1, days: 15 })
function openHold(l: QuoteLine) {
  holdDlg.value = { open: true, line: l, qty: Math.min(l.qty, stockFor(l.intSku)), days: 15 }
}
function submitHold() {
  const { line, qty, days } = holdDlg.value
  if (!line || !deal.value || qty <= 0) return
  store.requestHold(deal.value, line.intSku, qty, days)
  holdDlg.value.open = false
  ElMessage.success(`已送出預留申請：${line.intSku} × ${qty}，${days} 天，待採購核准`)
}
const blankItem = (no: number): QuoteItem => ({ no, custSku: '', custName: '', desc: '', qty: 1, unitPrice: 0, unitPriceTax: q.value?.taxMode === '含稅' ? 0 : undefined })
const blankLine = (no: number, itemNo: number): QuoteLine => ({ no, itemNo, extName: '', vendorSku: '', intSku: '', qty: 1, vendor: '', unitCost: null })
function renumber(x: Quote) {
  const map = new Map(x.items.map((it, i) => [it.no, i + 1]))
  x.lines.forEach((l) => (l.itemNo = map.get(l.itemNo) ?? l.itemNo))
  x.items.forEach((it, i) => (it.no = i + 1))
  /* 內部項次照對外項次的順序排，同一對外項次內維持原本相對順序 */
  x.lines.sort((a, b) => a.itemNo - b.itemNo)
  x.lines.forEach((l, i) => (l.no = i + 1))
}
/*
 * 拖曳調整順序：抓號碼左邊的把手拖。對外項次整組（含底下內部項次）移動；內部項次只能在自己的對外項次範圍內移。
 * 拖經其他列時就即時重排資料，列由 TransitionGroup 做 FLIP 位移動畫「讓位」；放開只是結束拖曳。
 * 列的 key 不能用 l.no（重排會重新編號），用 WeakMap 給每個 line 物件一個固定 id。
 */
const uids = new WeakMap<object, number>()
let uidSeq = 0
const uidOf = (o: object) => {
  let v = uids.get(o)
  if (v === undefined) {
    v = ++uidSeq
    uids.set(o, v)
  }
  return v
}
/**
 * 攤平成一列一筆給 TransitionGroup：每個對外項次先一列「item 列」（高度 0，只放 rowspan 的對外欄位與項次層級欄位），
 * 再接它的內部項次列。對外欄位不掛在第一條內部項次上，內部項次換位時對外欄位才不會跟著動。
 */
const rows = computed(() =>
  (q.value?.items ?? []).flatMap((item) => {
    const ls = linesOf(item)
    return [{ kind: 'item' as const, item, l: ls[0]!, k: -1 }, ...ls.map((l, k) => ({ kind: 'line' as const, item, l, k }))]
  }),
)
/* 拖曳中用物件參考記來源（編號會在放開後才重排），避免拖到一半編號變了對不上 */
const drag = ref<{ kind: 'item'; item: QuoteItem } | { kind: 'line'; line: QuoteLine } | null>(null)
let ghost: HTMLElement | null = null
const HYST = 2
/*
 * 判斷用「靜止位置」不是「動畫中的位置」（dnd-kit、SortableJS 的做法）：
 * FLIP 讓位時列身上有 transform 在滑，getBoundingClientRect 會把位移算進去；把 translateY 扣掉就是它最後會停的位置。
 * 這樣拖得再快也不用鎖，判斷永遠一致、不會來回跳。
 */
function restMid(el: Element, tr: HTMLElement) {
  const r = el.getBoundingClientRect()
  const ty = new DOMMatrixReadOnly(getComputedStyle(tr).transform).m42
  return r.top - ty + r.height / 2
}
/** 對外項次整組的靜止中線：項次列裡 rowspan 的第一格（跨整組），位移看項次列 */
function blockMid(item: QuoteItem, from: HTMLElement) {
  const tr = from.closest('tbody')?.querySelector<HTMLElement>(`tr.item-row[data-item="${uidOf(item)}"]`)
  const td = tr?.querySelector('td.ext')
  return tr && td ? restMid(td, tr) : restMid(from, from)
}
function onDragStart(e: DragEvent, kind: 'item' | 'line', item: QuoteItem, l: QuoteLine) {
  drag.value = kind === 'item' ? { kind, item } : { kind, line: l }
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', kind === 'item' ? `item:${item.no}` : `line:${l.no}`)
  /* 不要跟著游標的拖曳影像：被拿起的那一列本身已經浮起來，用透明 1px 把瀏覽器預設的影像蓋掉 */
  ghost = document.createElement('div')
  ghost.className = 'quote-drag-ghost'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 0, 0)
}
/* dragover：游標越過目標列中線（加一點緩衝）才讓位；換位後來源就在游標底下，不會來回抖 */
function onDragOver(e: DragEvent, item: QuoteItem, l: QuoteLine) {
  const d = drag.value
  const x = q.value
  if (!d || !x) return
  const row = e.currentTarget as HTMLElement
  if (d.kind === 'item') {
    e.preventDefault()
    const src = d.item
    if (src === item) return
    const mid = blockMid(item, row)
    const si = x.items.indexOf(src)
    const di = x.items.indexOf(item)
    if ((si < di && e.clientY > mid + HYST) || (si > di && e.clientY < mid - HYST)) {
      x.items.splice(si, 1)
      x.items.splice(di, 0, src)
    }
  } else {
    const mid = restMid(row, row)
    const src = d.line
    if (src.itemNo !== l.itemNo) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
      return
    }
    e.preventDefault()
    if (src === l) return
    const si = x.lines.indexOf(src)
    const di = x.lines.indexOf(l)
    if ((si < di && e.clientY > mid + HYST) || (si > di && e.clientY < mid - HYST)) {
      x.lines.splice(si, 1)
      x.lines.splice(di, 0, src)
    }
  }
}
/* 拖到對外欄位上（項次列的 rowspan 格子）：用整組格子的範圍算中線，只給對外項次換位用 */
function onDragOverItem(e: DragEvent, item: QuoteItem) {
  const d = drag.value
  const x = q.value
  if (!d || !x) return
  if (d.kind !== 'item') {
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    return
  }
  e.preventDefault()
  const src = d.item
  if (src === item) return
  const mid = blockMid(item, e.currentTarget as HTMLElement)
  const si = x.items.indexOf(src)
  const di = x.items.indexOf(item)
  if ((si < di && e.clientY > mid + HYST) || (si > di && e.clientY < mid - HYST)) {
    x.items.splice(si, 1)
    x.items.splice(di, 0, src)
  }
}
function onDragEnd() {
  if (drag.value && q.value) renumber(q.value)
  drag.value = null
  ghost?.remove()
  ghost = null
}
/** 被拿起來的列：對外項次整組、或那一條內部項次；first/last 用來畫上下陰影 */
function liftClass(kind: 'item' | 'line', item: QuoteItem, l: QuoteLine) {
  const d = drag.value
  if (!d) return {}
  if (kind === 'item') return d.kind === 'item' && d.item === item ? { lifted: true, 'lifted-first': true, 'lifted-last': true } : {}
  const on = d.kind === 'item' ? d.item === item : d.line === l
  if (!on) return { 'no-drop': d.kind === 'line' && d.line.itemNo !== l.itemNo }
  const group = d.kind === 'item' ? linesOf(item) : [l]
  return { lifted: true, 'lifted-first': group[0] === l, 'lifted-last': group[group.length - 1] === l }
}
const isLastItem = (item: QuoteItem) => !!q.value && q.value.items[q.value.items.length - 1] === item
const isLastLine = (item: QuoteItem, l: QuoteLine) => linesOf(item)[linesOf(item).length - 1] === l
function syncDealAmount() {
  const d = deal.value
  const latest = dealQuotes.value[0]
  if (!d || !latest) return
  d.amount = quoteTotal(latest)
  d.quoteVersions = dealQuotes.value.length
  d.updatedAt = new Date().toISOString()
}
function newQuote(from?: Quote) {
  const d = deal.value
  if (!d) return
  const version = (dealQuotes.value[0]?.version ?? 0) + 1
  const nq: Quote = {
    id: `q-${Date.now()}`,
    dealId: d.id,
    version,
    date: today(),
    status: '草稿',
    note: from ? `自 v${from.version} 複製` : undefined,
    taxMode: from?.taxMode,
    items: from ? from.items.map((i) => ({ ...i })) : [blankItem(1)],
    lines: from ? from.lines.map((l) => ({ ...l, vendorQuoteFile: undefined })) : [blankLine(1, 1)],
  }
  /* 續約商機的第一版：每條續約授權一個項次，數量照原授權 */
  if (!from && d.renewalOfDealId && d.renewalItems?.length) {
    const lic = (orders.find((o) => o.dealId === d.renewalOfDealId)?.licenses ?? []).filter((l) => d.renewalItems!.includes(l.id))
    if (lic.length) {
      nq.items = lic.map((l, i) => ({ no: i + 1, custSku: `${l.sku}-RNW`, custName: `${l.name} 續約`, desc: `原授權 ${l.expires} 到期`, qty: l.qty, unitPrice: 0 }))
      nq.lines = lic.map((l, i) => ({ no: i + 1, itemNo: i + 1, extName: `${l.name} 續約`, vendorSku: `${l.sku}-RNW`, intSku: `${l.sku}-RNW`, qty: l.qty, vendor: '', unitCost: null, nature: l.kind === '服務合約' ? '服務合約' : l.kind === '維護合約' || l.kind === '保固' ? '維護合約' : '授權', months: l.months ?? 12 }))
    }
  }
  quotes.push(nq)
  activeQuoteId.value = nq.id
}
function addItem() {
  const x = q.value
  if (!x) return
  const no = x.items.length + 1
  x.items.push(blankItem(no))
  x.lines.push(blankLine(x.lines.length + 1, no))
}
const confirmDelete = (msg: string, title: string) => ElMessageBox.confirm(msg, title, { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }).then(() => true, () => false)
async function removeItem(item: QuoteItem) {
  const x = q.value
  if (!x || x.items.length === 1) return
  if (!(await confirmDelete(`刪除對外項次 ${item.no}「${item.custName || '未命名'}」？底下 ${linesOf(item).length} 個內部項次會一起刪除。`, '刪除對外項次'))) return
  x.items.splice(x.items.indexOf(item), 1)
  x.lines = x.lines.filter((l) => l.itemNo !== item.no)
  renumber(x)
}
function addLine(item: QuoteItem, after?: QuoteLine) {
  const x = q.value
  if (!x) return
  const idx = after ? x.lines.indexOf(after) : x.lines.map((l) => l.itemNo).lastIndexOf(item.no)
  x.lines.splice(idx + 1, 0, blankLine(0, item.no))
  renumber(x)
}
async function removeLine(l: QuoteLine) {
  const x = q.value
  if (!x || linesOf(x.items.find((i) => i.no === l.itemNo)!).length === 1) return
  if (!(await confirmDelete(`刪除內部項次「${l.intSku || l.extName || '未命名'}」？`, '刪除內部項次'))) return
  x.lines.splice(x.lines.indexOf(l), 1)
  renumber(x)
}
/** 必填：對外項次的產品、數量、單價；內部項次的 SKU、產品、數量，以及要採購的部分要有內部單價 */
const lineCostMissing = (l: QuoteLine) => buyPart(l) > 0 && l.unitCost === null
/* 授權、維護合約、服務合約要有期間（月），後面的到期項目靠它算 */
const monthsMissing = (l: QuoteLine) => natureOf(l) !== '硬體' && hasExpiry(natureOf(l)) && !(l.months && l.months > 0)
/*
 * 必填分兩段（1112 會議）：草稿隨時可存；上傳客戶回簽只檢查對客戶的項次（客戶簽的就是這些）；
 * 內部 SKU、成本、期間、廠商報價單等到上單送審時才檢查（useQuoteSubmit 的 blockers）。
 */
const extValid = (x: Quote) => x.items.length > 0 && x.items.every((i) => i.custName.trim() && i.qty > 0 && (x.taxMode === '含稅' ? (i.unitPriceTax ?? 0) > 0 : i.unitPrice > 0))
const EXT_REQUIRED_MSG = '對客戶的項次要有產品、數量、單價'
/* 按過儲存／回簽之後，沒填的必填欄位才標紅 */
const showErrors = ref(false)
const bad = (v: string | number | null | undefined) => showErrors.value && (v === null || v === undefined || (typeof v === 'string' ? !v.trim() : v <= 0))
function saveDraft() {
  const x = q.value
  const d = deal.value
  if (!x || !d) return
  showErrors.value = false
  x.date = today()
  if (!isChangeQuote(x)) {
    syncDealAmount()
    if (d.stage === '規劃預算') {
      d.stage = '報價階段'
      d.stageAt = new Date().toISOString()
      d.prob = 0.1
    }
  }
  ElMessage.success(`v${x.version} 草稿已儲存，合計 ${money(quoteTotal(x))}（含稅 ${money(quoteTaxTotal(x))}）`)
}
async function discardDraft() {
  const x = q.value
  if (!x || x.status !== '草稿') return
  if (!(await ElMessageBox.confirm(`捨棄 v${x.version} 草稿？已填的項次與成本都會消失。`, '捨棄草稿', { confirmButtonText: '捨棄', cancelButtonText: '取消', type: 'warning' }).then(() => true, () => false))) return
  const wasChange = isChangeQuote(x)
  if (wasChange && changeOrder.value) {
    changeOrder.value.changeQuoteId = undefined
    store.logOrder(changeOrder.value, '合約', `合約變更草稿 v${x.version} 捨棄`)
  }
  quotes.splice(quotes.indexOf(x), 1)
  activeQuoteId.value = dealQuotes.value[0]?.id ?? ''
  if (!wasChange) syncDealAmount()
  ElMessage.info(`v${x.version} 草稿已捨棄`)
}

/* ---------- 廠商報價單：選供應商與內部項次後上傳 ---------- */
const fileVendor = ref('')
const fileLines = ref<number[]>([])
const fileOpen = ref(false)
/** 供應商主檔全部（含非正式） */
const fileVendors = computed(() => vendors.map((v) => v.name))
/** 還沒檢附報價單的採購項次 */
const fileLineOptions = computed(() => (q.value?.lines ?? []).filter((l) => needsFile(l) && !l.vendorQuoteFile && !l.bargaining))
/* 廠商還在議價：送審時和上傳報價單二擇一 */
function markBargaining() {
  const x = q.value
  if (!x) return
  x.lines.filter((l) => fileLines.value.includes(l.no)).forEach((l) => {
    l.bargaining = true
    if (fileVendor.value) l.vendor = fileVendor.value
  })
  fileLines.value = []
}
const bargainList = computed(() => (q.value?.lines ?? []).filter((l) => needsFile(l) && !l.vendorQuoteFile && l.bargaining))
watch(q, () => { fileLines.value = [] })
function onVendorFile(fileName: string) {
  const x = q.value
  if (!x) return
  x.lines.filter((l) => fileLines.value.includes(l.no)).forEach((l) => {
    l.vendorQuoteFile = fileName
    l.vendor = fileVendor.value
    l.bargaining = undefined
  })
  fileLines.value = []
}
const lineLabel = (l: QuoteLine) => `${l.itemNo}.${linesOf(q.value!.items.find((i) => i.no === l.itemNo)!).indexOf(l) + 1} ${l.intSku || l.extName}`
/** 刪除一份廠商報價單：對應的內部項次回到「未附」，可以重傳；草稿與退回待補件才能刪 */
async function removeVendorFile(f: { file: string; vendor: string; lines: QuoteLine[] }) {
  const ok = await ElMessageBox.confirm(`刪除「${f.file}」？對應的 ${f.lines.length} 個內部項次會回到未附，可以重新上傳。`, '刪除廠商報價單', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }).then(() => true, () => false)
  if (!ok) return
  f.lines.forEach((l) => {
    l.vendorQuoteFile = undefined
    if (!isOwn(l)) l.vendor = ''
  })
  ElMessage.success(`已刪除 ${f.file}`)
}
/** 已上傳的廠商報價單：一個檔案對應哪些內部項次 */
/* 廠商報價單列表 hover／點擊：上方對應的內部項次點亮，點擊時捲到第一條 */
const hlFile = ref<{ file: string; vendor: string } | null>(null)
const lineHl = (l: QuoteLine) => !!hlFile.value && l.vendorQuoteFile === hlFile.value.file && l.vendor === hlFile.value.vendor
function focusFile(f: { file: string; vendor: string; lines: QuoteLine[] }) {
  hlFile.value = { file: f.file, vendor: f.vendor }
  const first = f.lines[0]
  if (!first) return
  document.querySelector(`.lines tr[data-line="${uidOf(first)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
const vendorFiles = computed(() => {
  const map = new Map<string, { file: string; vendor: string; lines: QuoteLine[] }>()
  ;(q.value?.lines ?? []).forEach((l) => {
    if (!l.vendorQuoteFile) return
    const k = `${l.vendor}|${l.vendorQuoteFile}`
    if (!map.has(k)) map.set(k, { file: l.vendorQuoteFile, vendor: l.vendor, lines: [] })
    map.get(k)!.lines.push(l)
  })
  return [...map.values()]
})

/* ---------- 客戶回簽 ---------- */
function uploadSignback() {
  const x = q.value
  const d = deal.value
  if (!x || !d) return
  if (x.status === '草稿' && !extValid(x)) {
    showErrors.value = true
    ElMessage.warning(EXT_REQUIRED_MSG)
    return
  }
  showErrors.value = false
  x.signbackFile = `${d.customer}-回簽-v${x.version}.pdf`
  if (x.status === '草稿') {
    x.status = '報價回簽'
    if (!x.milestones) x.milestones = milestonesFromTemplate('once', quoteTotal(x))
    if (!isChangeQuote(x)) {
      syncDealAmount()
      emit('comment', `客戶已回簽報價單 v${x.version}，合計 ${money(quoteTotal(x))}，內容鎖定`)
    }
  }
  store.addAttachment({ type: '客戶回簽', refNo: d.dealNo, party: d.customer, fileName: x.signbackFile, sizeKb: 860 })
  ElMessage.success(`回簽已上傳，v${x.version} 內容鎖定`)
}


/* ---------- 客戶版預覽 ---------- */
const previewOpen = ref(false)
/** 預覽單價欄以未稅或含稅呈現（預設跟報價單的發起方式） */
const previewTax = ref<'未稅' | '含稅'>('未稅')
watch(previewOpen, (v) => { if (v) previewTax.value = q.value?.taxMode === '含稅' ? '含稅' : '未稅' })
const previewPrice = (i: QuoteItem) => (previewTax.value === '含稅' ? (q.value?.taxMode === '含稅' ? (i.unitPriceTax ?? 0) : i.unitPrice * (1 + TAX_RATE)) : i.unitPrice)
const previewAmount = (i: QuoteItem) => (previewTax.value === '含稅' ? itemTax(i) : i.qty * i.unitPrice)
/** true＝看客戶回簽（同一張報價單加上客戶簽章），false＝客戶版報價單 */
const signbackPreview = ref(false)
function openPreview(signed: boolean) {
  signbackPreview.value = signed
  previewOpen.value = true
}
function validUntil(x: Quote) {
  const d = new Date(x.date + 'T00:00:00')
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}
const verifyLink = computed(() => (q.value ? `${location.origin}${location.pathname}#/ext/verify/${q.value.id}` : ''))
const statusTag = (s: Quote['status']) => (s === '草稿' ? 'amber' : 'olive')
</script>

<template>
  <div v-if="deal" class="wb">
    <div v-if="!dealQuotes.length" class="empty-state">
      <p class="muted">尚未建立報價單。</p>
      <el-button v-if="canNewVersion" type="primary" :icon="Plus" @click="newQuote()">新增報價單</el-button>
    </div>

    <template v-else-if="q">
      <!-- 版本列 + 動作 -->
      <div class="versions-row">
        <div class="versions">
          <button v-for="v in dealQuotes" :key="v.id" type="button" class="version" :class="{ on: q.id === v.id }" @click="activeQuoteId = v.id">
            <b>v{{ v.version }}</b>
            <span class="muted num">{{ v.date }}</span>
            <span class="tag" :class="statusTag(v.status)">{{ v.status }}</span>
            <span v-if="superseded(v)" class="muted small">已有新版草稿</span>
          </button>
        </div>
        <div class="actions">
          <el-button size="small" :icon="View" @click="openPreview(false)">預覽</el-button>
          <el-button size="small" :icon="Download" @click="ElMessage.success('已下載')">下載</el-button>
          <template v-if="draftEditable">
            <el-button size="small" text @click="discardDraft">捨棄草稿</el-button>
            <el-button size="small" @click="saveDraft">儲存草稿</el-button>
          </template>
          <el-button v-else-if="canNewVersion && q.status === '報價回簽' && !hasDraft && !isChangeQuote(q)" size="small" @click="newQuote(q)">複製為新版本</el-button>
        </div>
      </div>
      <div v-if="isChangeQuote(q)" class="change-banner"><b>合約變更</b><span>{{ changeOrder?.soNo }} · v{{ q.version }}{{ q.note ? ` · ${q.note.replace(/^合約變更[：:]\s*/, '')}` : '' }}</span></div>
      <div v-else-if="isReturned" class="change-banner returned"><b>上單送審已退回</b><span>{{ deal?.dealNo }} · {{ lastReturnNote || '請補內部資料後重新送審' }}</span></div>

      <!-- 報價明細：整寬 -->
      <section class="block">
        <!-- 標題右邊接客戶回簽：標籤＋按鈕（簽核進度、請款、毛利、上單條件都在基本資料頁簽） -->
        <div class="block-head head-left">
          <h4>報價明細</h4>
          <el-radio-group v-if="draftEditable" :model-value="q.taxMode ?? '未稅'" size="small" class="tax-mode" @change="(v: string | number | boolean | undefined) => setTaxMode(v as '未稅' | '含稅')">
            <el-radio-button value="未稅">未稅發起</el-radio-button>
            <el-radio-button value="含稅">含稅發起</el-radio-button>
          </el-radio-group>
          <span v-else-if="taxIn" class="tag slate">含稅發起</span>
          <!-- 一顆按鈕：還沒回簽是「客戶回簽」上傳；回簽後按鈕文字換成檔名 -->
          <div class="signback" :class="{ flash: highlight === 'signback' }">
            <el-button v-if="q.signbackFile" :icon="Paperclip" class="signback-btn done" title="預覽客戶回簽" @click="openPreview(true)">{{ q.signbackFile }}</el-button>
            <el-button v-else-if="internalEditable" :icon="Upload" class="signback-btn" @click="uploadSignback">客戶回簽</el-button>
            <span v-else class="muted small">尚未回簽</span>
          </div>
        </div>
        <div class="table-wrap">
          <table class="plain-table lines" :class="{ editing: lineEditable, folded: !showInternal }" :style="{ width: tableWidth + 'px' }">
            <colgroup>
              <col :style="w('no')" />
              <col :style="w('item')" />
              <col :style="w('desc')" />
              <col :style="w('qty')" />
              <col :style="w('price')" />
              <col :style="w('amount')" />
              <col :style="w('lineNo')" />
              <col :style="w('line')" />
              <template v-if="showInternal">
                <col :style="w('lineQty')" />
                <col :style="w('cost')" />
                <col :style="w('lineCost')" />
                <col :style="w('profit')" />
              </template>
              <col :style="w('rate')" />
              <col :style="w('file')" />
            </colgroup>
            <thead>
              <tr class="group-row">
                <th colspan="6" class="group">對客戶</th>
                <th :colspan="showInternal ? 6 : 2" class="group int lead">內部</th>
                <th colspan="2" class="group">毛利與附件</th>
              </tr>
              <tr>
                <th>項次</th>
                <th>對客戶 SKU<br />對客戶產品<span v-if="draftEditable" class="req">*</span></th>
                <th>產品描述</th>
                <th>數量<span v-if="draftEditable" class="req">*</span></th>
                <th>單價<span v-if="draftEditable" class="req">*</span><br /><span class="muted">{{ taxIn ? '含稅' : '未稅' }}</span></th>
                <th class="ext-end">對客戶報價<br /><span class="muted">未稅 / 含稅</span></th>
                <th class="int lead">內部<br />項次</th>
                <th class="int int-end">
                  <span class="th-inner">
                    <span>內部 SKU<span v-if="draftEditable" class="req">*</span></span>
                    <button type="button" class="fold" :title="showInternal ? '收合內部欄位' : '展開內部欄位'" @click="showInternal = !showInternal"><el-icon><component :is="showInternal ? DArrowLeft : DArrowRight" /></el-icon></button>
                  </span>
                </th>
                <template v-if="showInternal">
                  <th class="int">內部<br />數量<span v-if="draftEditable" class="req">*</span></th>
                  <th class="int">內部單價<span v-if="lineEditable" class="req">*</span><br /><span class="muted">未稅</span></th>
                  <th class="int">內部成本<br /><span class="muted">未稅 / 含稅</span></th>
                  <th class="int">此項總毛利<br /><span class="muted">未稅</span></th>
                </template>
                <th>此項<br />毛利率</th>
                <th>檢附<br />報價單</th>
              </tr>
            </thead>
            <TransitionGroup tag="tbody" name="row">
                <tr v-for="{ kind, item, l, k } in rows" :key="kind === 'item' ? `i${uidOf(item)}` : uidOf(l)" :class="[{ first: k <= 0, last: kind === 'line' && k === linesOf(item).length - 1, 'item-row': kind === 'item', 'hl-line': kind === 'line' && lineHl(l) }, liftClass(kind, item, l)]" :data-item="kind === 'item' ? uidOf(item) : undefined" :data-line="kind === 'line' ? uidOf(l) : undefined" @dragover="kind === 'line' ? onDragOver($event, item, l) : onDragOverItem($event, item)" @drop.prevent>
                  <template v-if="kind === 'item'">
                    <td class="n ext" :rowspan="linesOf(item).length + 1">
                      <div class="no-cell">
                        <span class="no-line">
                          <span v-if="draftEditable" class="grip" draggable="true" title="拖曳調整順序（連同內部項次）" @dragstart="onDragStart($event, 'item', item, l)" @dragend="onDragEnd"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M1 2.5h10M1 6h10M1 9.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg></span>
                          <span>{{ item.no }}</span>
                        </span>
                        <div v-if="draftEditable" class="row-acts">
                          <el-button size="small" text :icon="Delete" class="row-delete" title="刪除對外項次" :disabled="q.items.length === 1" @click="removeItem(item)" />
                          <el-button v-if="isLastItem(item)" size="small" text :icon="Plus" class="row-add" title="新增對外項次" @click="addItem" />
                        </div>
                      </div>
                    </td>
                    <td class="ext" :rowspan="linesOf(item).length + 1">
                      <template v-if="draftEditable">
                        <el-input v-model="item.custSku" size="small" placeholder="對客戶 SKU" />
                        <el-input v-model="item.custName" size="small" placeholder="對客戶產品" :class="{ invalid: bad(item.custName) }" />
                      </template>
                      <template v-else>
                        <div class="muted small sku">{{ item.custSku || '—' }}</div>
                        <div class="name">{{ item.custName }}</div>
                      </template>
                    </td>
                    <td class="ext" :rowspan="linesOf(item).length + 1">
                      <el-input v-if="draftEditable" v-model="item.desc" size="small" placeholder="產品描述" />
                      <span v-else class="muted">{{ item.desc || '—' }}</span>
                    </td>
                    <td class="n ext" :rowspan="linesOf(item).length + 1">
                      <el-input-number v-if="draftEditable" v-model="item.qty" :min="1" :precision="0" :controls="false" size="small" class="cell-num" :class="{ invalid: bad(item.qty) }" @change="syncNet(item)" />
                      <template v-else>{{ item.qty }}</template>
                    </td>
                    <td class="n ext" :rowspan="linesOf(item).length + 1">
                      <template v-if="taxIn">
                        <el-input-number v-if="draftEditable" v-model="item.unitPriceTax" :min="0" :step="1000" :precision="0" :controls="false" size="small" class="cell-num" :class="{ invalid: bad(item.unitPriceTax) }" @change="syncNet(item)" />
                        <template v-else>{{ money(item.unitPriceTax ?? 0) }}</template>
                        <div class="muted small">未稅 {{ money(item.unitPrice) }}</div>
                      </template>
                      <template v-else>
                        <el-input-number v-if="draftEditable" v-model="item.unitPrice" :min="0" :step="1000" :precision="0" :controls="false" size="small" class="cell-num" :class="{ invalid: bad(item.unitPrice) }" />
                        <template v-else>{{ money(item.unitPrice) }}</template>
                      </template>
                    </td>
                    <td class="n ext ext-end" :rowspan="linesOf(item).length + 1">
                      <div><b>{{ money(itemRevenue(item)) }}</b></div>
                      <div class="muted small">{{ money(itemTax(item)) }}</div>
                    </td>
                    <!-- 內部項次欄位的佔位格（高度 0），讓後面的項次層級欄位落在正確的欄 -->
                    <td v-for="i in showInternal ? 5 : 2" :key="i" class="filler int"></td>
                    <td v-if="showInternal" class="n int item-cell" :rowspan="linesOf(item).length + 1">{{ itemCostKnown(item) ? money(itemRevenue(item) - itemCost(item)) : '—' }}</td>
                    <td class="n ext item-cell" :rowspan="linesOf(item).length + 1"><span v-if="itemCostKnown(item)" class="pill" :class="itemMargin(item) < 0 ? 'neg' : itemMargin(item) < routing.lowMarginThreshold ? 'low' : 'ok'">{{ pct(itemMargin(item), 1) }}</span><span v-else class="muted">—</span></td>
                  </template>
                  <template v-else>
                  <td class="n int lead">
                    <div class="no-cell">
                      <span class="no-line">
                        <span v-if="draftEditable" class="grip" draggable="true" title="拖曳調整順序（只在這個對外項次內）" @dragstart="onDragStart($event, 'line', item, l)" @dragend="onDragEnd"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M1 2.5h10M1 6h10M1 9.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg></span>
                        <span>{{ item.no }}.{{ k + 1 }}</span>
                      </span>
                      <div v-if="draftEditable" class="row-acts">
                        <el-button size="small" text :icon="Delete" class="row-delete" title="刪除內部項次" :disabled="linesOf(item).length === 1" @click="removeLine(l)" />
                        <el-button v-if="isLastLine(item, l)" size="small" text :icon="Plus" class="row-add" title="新增內部項次" @click="addLine(item, l)" />
                      </div>
                    </div>
                  </td>
                  <td class="int int-end">
                    <template v-if="draftEditable">
                      <el-select v-if="isOwn(l)" :model-value="l.intSku || undefined" size="small" filterable placeholder="選自有服務項目" :class="{ invalid: bad(l.intSku) }" @change="(v: string) => pickService(l, v)">
                        <el-option v-for="svc in activeServices" :key="svc.code" :value="svc.code" :label="`${svc.name}（${svc.code}）`" />
                      </el-select>
                      <el-input v-else v-model="l.intSku" size="small" placeholder="內部 SKU" :class="{ invalid: bad(l.intSku) }" />
                      <div v-if="isOwn(l) && serviceOf(l)" class="muted small sku">{{ serviceOf(l)!.name }}</div>
                      <div class="nature-row">
                        <el-select :model-value="natureOf(l)" size="small" class="nature" style="width: 108px" @change="(v: LineNature) => (l.nature = v)">
                          <el-option value="硬體" label="硬體" /><el-option value="授權" label="授權" /><el-option value="維護合約" label="維護合約" /><el-option value="服務合約" label="服務合約" /><el-option value="單次服務" label="單次服務" />
                        </el-select>
                        <el-input-number v-if="natureOf(l) !== '硬體' && hasExpiry(natureOf(l))" v-model="l.months" :min="1" :precision="0" :controls="false" size="small" class="months" placeholder="月" style="width: 64px" :class="{ invalid: showErrors && monthsMissing(l) }" />
                        <span v-if="natureOf(l) !== '硬體' && hasExpiry(natureOf(l))" class="muted small">個月<span class="req">*</span></span>
                      </div>
                    </template>
                    <template v-else>
                      <div class="name">{{ l.intSku }}</div>
                      <div v-if="isOwn(l)" class="muted small sku">{{ serviceOf(l)?.name ?? l.extName }}</div>
                      <div class="muted small sku">{{ natureOf(l) }}{{ l.months ? ` · ${l.months} 個月` : '' }}</div>
                      <div v-if="stockPart(l) > 0 && !lineEditable" class="muted small">使用庫存</div>
                    </template>
                    <template v-if="lineEditable">
                      <div class="opts">
                        <el-checkbox :model-value="isOwn(l)" size="small" @change="(v: string | number | boolean) => setOwn(l, !!v)">自有工程</el-checkbox>
                        <el-checkbox v-if="!isOwn(l) && canUseStock(l)" :model-value="stockMode(l) === 'buy'" size="small" @change="(v: string | number | boolean) => setStockMode(l, v ? 'buy' : 'stock')">另行採購</el-checkbox>
                      </div>
                      <el-input v-if="!isOwn(l) && canUseStock(l) && stockMode(l) === 'buy'" v-model="l.insistReason" size="small" placeholder="*另行採購原因" class="reason" />
                    </template>
                    <div v-if="!isOwn(l) && l.intSku && (stockFor(l.intSku) > 0 || holdOf(l))" class="stock-callout" :class="{ pulse: lineEditable && !holdOf(l) }">
                      <span>庫存可用 <b>{{ stockFor(l.intSku) }}</b></span>
                      <span v-if="holdOf(l)" class="tag" :class="holdOf(l)!.status === '保留中' ? 'olive' : 'amber'">{{ holdOf(l)!.status === '保留中' ? `保留 ${holdOf(l)!.qty} 到 ${holdOf(l)!.expiresAt}` : `預留待核准 ${holdOf(l)!.qty}` }}</span>
                      <el-button v-else-if="internalEditable && deal.ownerId === store.currentUserId" size="small" text type="primary" @click="openHold(l)">申請保留</el-button>
                    </div>
                  </td>
                  <template v-if="showInternal">
                    <td class="n int">
                      <el-input-number v-if="draftEditable" v-model="l.qty" :min="1" :precision="0" :controls="false" size="small" class="cell-num" :class="{ invalid: bad(l.qty) }" />
                      <template v-else>{{ l.qty }}</template>
                    </td>
                    <td class="n int">
                      <template v-if="stockPart(l) === l.qty">{{ money(transferOf(l.intSku) ?? 0) }}</template>
                      <template v-else-if="isOwn(l)">{{ l.unitCost === null ? '—' : money(l.unitCost) }}<div class="muted small">標準成本</div></template>
                      <el-input-number v-else-if="lineEditable" v-model="l.unitCost" :min="0" :step="1000" :precision="0" :controls="false" size="small" class="cell-num" placeholder="*" :class="{ invalid: showErrors && lineCostMissing(l) }" />
                      <template v-else>{{ l.unitCost === null ? '—' : money(l.unitCost) }}</template>
                    </td>
                    <td class="n int">
                      <template v-if="lineUnitCost(l) !== null">
                        <div>{{ money(lineCost(l)) }}</div>
                        <div class="muted small">{{ money(withTax(lineCost(l))) }}</div>
                      </template>
                      <span v-else class="muted">—</span>
                    </td>
                  </template>
                  <td class="nowrap">
                    <span v-if="!needsFile(l)" class="muted">不需要</span>
                    <span v-else-if="l.vendorQuoteFile" class="file" :title="l.vendorQuoteFile"><el-icon><Paperclip /></el-icon><span class="t">{{ l.vendorQuoteFile }}</span></span>
                    <span v-else-if="l.bargaining" class="tag amber">議價中</span>
                    <span v-else class="tag red">未附</span>
                  </td>
                  </template>
                </tr>
            </TransitionGroup>
            <tfoot>
              <tr>
                <td colspan="5" class="foot-label">合計</td>
                <td class="n"><div><b>{{ money(revenue) }}</b></div><div class="muted small">{{ money(revenueTax) }}</div></td>
                <td class="int lead muted">成本</td>
                <td class="int int-end n">
                  <template v-if="!showInternal"><div><b>{{ money(cost) }}</b></div><div class="muted small">{{ money(withTax(cost)) }}</div></template>
                </td>
                <template v-if="showInternal">
                  <td colspan="2" class="int"></td>
                  <td class="n int"><div>{{ money(cost) }}</div><div class="muted small">{{ money(withTax(cost)) }}</div></td>
                  <td class="n int"><b>{{ missingCost ? '—' : money(revenue - cost) }}</b></td>
                </template>
                <td class="n">
                  <span v-if="!missingCost" class="pill" :class="margin < 0 ? 'neg' : margin < routing.lowMarginThreshold ? 'low' : 'ok'">{{ pct(margin, 1) }}</span><span v-else class="muted">—</span>
                  <div v-if="!showInternal && !missingCost" class="muted small profit">毛利 {{ money(revenue - cost) }}</div>
                </td>
                <td class="muted small">{{ missingCost ? `${missingCost} 項成本未填` : '' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div class="layout">
        <div class="main">
          <!-- 廠商報價單 -->
          <section class="block" :class="{ flash: highlight === 'vendorFiles' }">
            <div class="block-head"><h4>廠商報價單<span v-if="missingFiles.length" class="tag amber">缺 {{ missingFiles.length }} 項</span></h4></div>
            <div v-if="internalEditable" class="file-form">
              <el-select v-model="fileVendor" filterable size="small" style="width: 200px" placeholder="供應商">
                <el-option v-for="v in fileVendors" :key="v" :value="v" :label="vendorStatus(v) === '非正式' ? `${v}（非正式）` : v" />
              </el-select>
              <el-select v-model="fileLines" multiple collapse-tags collapse-tags-tooltip size="small" style="width: 320px" :placeholder="fileLineOptions.length ? '對應的內部項次' : '內部項次都已檢附'" :disabled="!fileLineOptions.length">
                <el-option v-for="l in fileLineOptions" :key="l.no" :value="l.no" :label="lineLabel(l)" />
              </el-select>
              <el-button size="small" type="primary" :icon="Upload" :disabled="!fileVendor || !fileLines.length" @click="fileOpen = true">上傳報價單</el-button>
              <el-button size="small" :disabled="!fileLines.length" @click="markBargaining">議價中</el-button>
            </div>
            <table v-if="vendorFiles.length" class="plain-table">
              <thead><tr><th>檔案</th><th>供應商</th><th>對應內部項次</th><th v-if="internalEditable"></th></tr></thead>
              <tbody>
                <tr v-for="f in vendorFiles" :key="f.vendor + f.file" class="file-row" :class="{ on: hlFile?.file === f.file && hlFile?.vendor === f.vendor }" @mouseenter="hlFile = { file: f.file, vendor: f.vendor }" @mouseleave="hlFile = null" @click="focusFile(f)">
                  <td><span class="file"><el-icon><Paperclip /></el-icon>{{ f.file }}</span></td>
                  <td>{{ f.vendor }}</td>
                  <td>{{ f.lines.map(lineLabel).join('、') }}</td>
                  <td v-if="internalEditable" class="acts"><el-button size="small" text :icon="Delete" class="row-delete" title="刪除後可重新上傳" @click="removeVendorFile(f)" /></td>
                </tr>
              </tbody>
            </table>
            <p v-else-if="!bargainList.length" class="muted small">還沒有廠商報價單。</p>
            <div v-if="bargainList.length" class="bargain-list">
              <span class="tag amber">議價中</span>
              <span v-for="l in bargainList" :key="l.no" class="bargain-item">{{ lineLabel(l) }}<span v-if="l.vendor" class="muted small">（{{ l.vendor }}）</span><el-button v-if="internalEditable" size="small" text :icon="Delete" class="row-delete" @click="l.bargaining = undefined" /></span>
            </div>
          </section>

          <!-- 合約變更差異（請款條件、毛利率、上單條件已搬到基本資料頁簽） -->
          <section v-if="isRetry && baseQuote" class="block">
            <div class="block-head"><h4>與核准版本 v{{ baseQuote.version }} 的差異</h4></div>
            <table class="plain-table">
              <thead><tr><th>欄位</th><th>核准版</th><th>本版</th></tr></thead>
              <tbody>
                <tr v-for="d in diff" :key="d.field"><td>{{ d.field }}</td><td class="muted strike">{{ d.before }}</td><td class="hl">{{ d.after }}</td></tr>
                <tr v-if="!diff.length"><td colspan="3" class="muted">目前與核准版本沒有差異</td></tr>
              </tbody>
            </table>
          </section>
        </div>

      </div>
    </template>

    <UploadDialog v-if="q" v-model="fileOpen" :ref-no="`${deal.dealNo} v${q.version}`" :party="fileVendor || deal.customer" :types="['廠商報價單']" default-type="廠商報價單" title="上傳廠商報價單" @uploaded="onVendorFile" />

    <el-dialog v-if="q" v-model="previewOpen" :title="signbackPreview ? `客戶回簽 · ${q.signbackFile}` : '客戶版報價單'" width="760px" class="preview-dialog">
      <div class="paper" :class="{ signed: signbackPreview }">
        <!-- 回簽預覽：示範用，同一張報價單加上客戶簽章（真實系統是客戶回傳的掃描檔） -->
        <div v-if="signbackPreview" class="stamp" aria-hidden="true">回簽確認</div>
        <header class="paper-head">
          <div>
            <div class="paper-brand">銓立光科技股份有限公司</div>
            <div class="muted small">台北市內湖區示範路 100 號 · 02-0000-0000 · sales@qlq.example</div>
          </div>
          <div class="paper-title">
            <h3>報價單</h3>
            <div class="num">{{ deal.dealNo }}-Q{{ q.version }}</div>
          </div>
        </header>
        <dl class="paper-meta">
          <dt>客戶</dt><dd>{{ deal.customer }} {{ deal.customerDept }}</dd>
          <dt>報價日期</dt><dd class="num">{{ q.date }}</dd>
          <dt>有效期限</dt><dd class="num">{{ validUntil(q) }}</dd>
          <dt>業務窗口</dt><dd>{{ deal.owner }}</dd>
        </dl>
        <table class="paper-table">
          <thead><tr><th>#</th><th>SKU</th><th>品名</th><th class="num">數量</th><th class="num">{{ previewTax }}單價</th><th class="num">{{ previewTax }}小計</th></tr></thead>
          <tbody>
            <tr v-for="i in q.items" :key="i.no">
              <td class="num">{{ i.no }}</td>
              <td class="num">{{ i.custSku || '—' }}</td>
              <td>{{ i.custName || '（未填品名）' }}<div v-if="i.desc" class="muted small">{{ i.desc }}</div></td>
              <td class="num">{{ i.qty }}</td>
              <td class="num">{{ money(previewPrice(i)) }}</td>
              <td class="num">{{ money(previewAmount(i)) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td colspan="5" class="label">未稅合計</td><td class="num">{{ money(revenue) }}</td></tr>
            <tr><td colspan="5" class="label">營業稅 5%</td><td class="num">{{ money(revenueTax - revenue) }}</td></tr>
            <tr class="grand"><td colspan="5" class="label">含稅總計</td><td class="num">{{ money(revenueTax) }}</td></tr>
          </tfoot>
        </table>
        <footer class="paper-foot">
          <ul class="terms">
            <li>付款條件：驗收後 30 天內電匯（示範文字）。</li>
            <li>交期：收到訂單後 4 至 6 週，以原廠出貨為準。</li>
            <li>本報價含原廠標準保固，不含現場以外的加值服務。</li>
          </ul>
          <div class="qr">
            <div class="qr-box" aria-hidden="true"></div>
            <a v-if="q.status !== '草稿'" :href="verifyLink" target="_blank" class="muted small verify">開啟驗證頁</a>
          </div>
        </footer>
        <div v-if="signbackPreview" class="sign-row">
          <div class="sign-box"><span class="k">客戶簽章</span><span class="ink">{{ deal.customer }}</span><span class="muted small">{{ deal.customerDept }}</span></div>
          <div class="sign-box"><span class="k">回簽日期</span><span class="num">{{ q.date }}</span></div>
        </div>
      </div>
      <template #footer>
        <el-radio-group v-model="previewTax" size="small" class="preview-tax">
          <el-radio-button value="未稅">未稅呈現</el-radio-button>
          <el-radio-button value="含稅">含稅呈現</el-radio-button>
        </el-radio-group>
        <el-button @click="previewOpen = false">關閉</el-button>
        <el-button type="primary" @click="ElMessage.success('已下載')">下載</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="holdDlg.open" width="420px" title="申請保留庫存" append-to-body>
      <el-form v-if="holdDlg.line" label-position="top">
        <el-form-item label="料號"><span class="id">{{ holdDlg.line.intSku }}</span><span class="muted small">　可用 {{ stockFor(holdDlg.line.intSku) }}</span></el-form-item>
        <el-form-item label="數量" required>
          <el-input-number v-model="holdDlg.qty" :min="1" :max="stockFor(holdDlg.line.intSku)" :precision="0" />
        </el-form-item>
        <el-form-item label="保留天數" required>
          <el-radio-group v-model="holdDlg.days">
            <el-radio-button :value="15">15 天</el-radio-button>
            <el-radio-button :value="30">30 天</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="holdDlg.open = false">取消</el-button>
        <el-button type="primary" @click="submitHold">送出申請</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.tax-mode {
  margin-left: 4px;
}

.preview-tax {
  margin-right: auto;
  float: left;
}

/* 有庫存：色塊加呼吸光，一眼看到（1112 會議 #7） */
.stock-callout {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--teal-soft);
  border: 1px solid var(--teal);
  color: var(--ink);
  font-size: 12px;
}

.stock-callout b {
  font-size: 14px;
  color: var(--teal);
}

.stock-callout.pulse {
  animation: stock-pulse 1.8s ease-in-out infinite;
}

@keyframes stock-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--teal) 45%, transparent); }
  50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--teal) 0%, transparent); }
}

@media (prefers-reduced-motion: reduce) {
  .stock-callout.pulse {
    animation: none;
  }
}

.bargain-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 8px;
  font-size: 13px;
}

.bargain-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.wb {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.versions-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.versions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.version {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  cursor: pointer;
  font: inherit;
  color: var(--ink);
}

.version.on {
  border-color: var(--teal);
  background: var(--teal-soft);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.note {
  margin: -4px 0 0;
  font-size: 13px;
}

.change-banner {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--amber-soft);
  border: 1px solid var(--amber);
  font-size: 13px;
}

.change-banner.returned {
  background: var(--red-soft);
  border-color: var(--red);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* 報價明細標題列：標題靠左，客戶回簽緊接在標題右邊（不是推到最右） */
.block-head.head-left {
  justify-content: flex-start;
  gap: 18px;
}

.signback {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 6px;
  border-radius: 6px;
}

.signback-btn {
  background: #fff;
}

/* 回簽後：按鈕顯示檔名，點了預覽回簽 */
.signback-btn.done {
  color: var(--teal-ink);
  border-color: var(--teal);
}

.signback-btn.done:hover {
  background: var(--teal-soft);
}

.block {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.block-head h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.sub {
  font-weight: 400;
  font-size: 12px;
}

/* 只橫向捲；垂直不捲，FLIP 讓位時列暫時超出範圍也不會閃出捲軸。底下留一點空間給被拿起那列的陰影 */
.table-wrap {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 0 -14px -12px;
  padding: 0 14px 12px;
}

.lines {
  table-layout: fixed;
  /* 框線每格自己畫（不共用），列做 transform 動畫時框線才會跟著走、不會閃 */
  border-collapse: separate;
  border-spacing: 0;
  --internal-bg: color-mix(in srgb, var(--teal-soft) 34%, var(--surface));
  --internal-head-bg: color-mix(in srgb, var(--teal-soft) 58%, var(--surface));
  --internal-edge: color-mix(in srgb, var(--teal) 55%, var(--line));
}

.lines th,
.lines td {
  padding: 8px 10px;
  vertical-align: top;
  text-align: left;
  font-size: 13px;
}

.lines.editing th,
.lines.editing td {
  padding: 7px 8px;
}

.lines th {
  position: relative;
  z-index: 3;
  line-height: 1.3;
  white-space: nowrap;
}

/* 第一列表頭：連續色帶的欄群；第二列才是欄名 */
.lines .group-row th {
  height: 28px;
  padding: 5px 10px;
  background: var(--surface-2);
  border: 0;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.06em;
}

.lines .group-row th.int {
  background: var(--teal-soft);
  color: var(--teal-ink);
}

.lines thead > tr:last-child th {
  padding-top: 7px;
  padding-bottom: 7px;
  color: var(--ink);
  font-weight: 600;
  vertical-align: bottom;
  border-bottom: 1px solid var(--line-strong);
}

.lines th .muted {
  display: inline-block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 400;
}

/* 內部區塊：極淡 teal 底 + 左邊 2px 分界，而不是整片灰底 */
.lines td.int {
  background: var(--internal-bg);
}

.lines th.int {
  background: var(--internal-head-bg);
}

.lines td.ext {
  padding-top: 12px;
}

.lines.editing td.ext {
  padding-top: 7px;
}

.lines.folded .int-end {
  border-right: 2px solid var(--internal-edge);
}

.lines tbody tr:hover {
  background: transparent;
}

/* 分隔線都是每格的 border-bottom（來自 .plain-table）：同一對外項次內的內部項次之間用淡色，組與組之間正常色 */
.lines tbody tr:not(.item-row):not(.last) td {
  border-bottom-color: color-mix(in srgb, var(--line) 65%, transparent);
}

/* item 列本身高度 0：佔位格不留邊距與框線，對外欄位靠 rowspan 跨到底下的內部項次列 */
.lines tbody tr.item-row {
  height: 0;
}

.lines td.filler {
  height: 0;
  padding: 0;
  border: 0;
}

.lines .n {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.lines .sku {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

.lines .name {
  overflow-wrap: anywhere;
}

.pill {
  display: inline-block;
  min-width: 52px;
  padding: 1px 7px;
  border: 1px solid currentColor;
  border-radius: 999px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.pill.ok {
  color: var(--olive);
  background: color-mix(in srgb, var(--olive-soft) 72%, var(--surface));
}

.pill.low {
  color: var(--amber);
  background: color-mix(in srgb, var(--amber-soft) 72%, var(--surface));
}

.pill.neg {
  color: var(--red);
  background: color-mix(in srgb, var(--red-soft) 72%, var(--surface));
}

.profit {
  margin-top: 4px;
}

.lines td.lead,
.lines th.lead {
  border-left: 2px solid var(--internal-edge);
}

/* 合計列：總結帶 */
.lines tfoot td {
  padding-top: 12px;
  padding-bottom: 12px;
  background: var(--surface-2);
  border-top: 1px solid var(--line-strong);
  border-bottom: 0;
}

.lines tfoot td.int {
  background: var(--teal-soft);
}

.lines tfoot .n {
  color: var(--ink);
  font-weight: 600;
}

.lines tfoot .n .small {
  margin-top: 2px;
  font-weight: 400;
}

.th-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.fold {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  flex: none;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}

.fold:hover {
  color: var(--surface);
  border-color: var(--teal);
  background: var(--teal);
}

.lines.folded .fold {
  color: var(--teal-ink);
  border-color: var(--teal);
  background: var(--teal-soft);
}

.no-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.no-cell > .no-line > span:last-child {
  color: var(--ink);
  font-weight: 600;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}

.row-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 4px;
}

.no-cell :deep(.el-button) {
  width: auto;
  height: 18px;
  padding: 0;
  margin: 0;
  justify-content: flex-start;
  color: var(--muted);
  opacity: 0.72;
}

.row-acts {
  gap: 6px;
  min-height: 18px;
}

.no-cell :deep(.row-delete:hover) {
  color: var(--red);
  opacity: 1;
}

.no-cell :deep(.row-add:hover) {
  color: var(--teal);
  opacity: 1;
}

/* 拖曳把手：號碼左邊的三條橫槓 */
.no-line {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.no-cell .grip {
  display: inline-grid;
  place-items: center;
  width: 14px;
  height: 20px;
  color: var(--line-strong);
  cursor: grab;
  border-radius: 3px;
}

.no-cell .grip:hover {
  color: var(--teal-ink);
  background: var(--teal-soft);
}

.no-cell .grip:active {
  cursor: grabbing;
}

/* 其他列讓位的 FLIP 位移動畫（TransitionGroup） */
.lines tbody .row-move {
  transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1);
}

/* 被拿起來的列：提亮＋整組只在首列畫上陰影、末列畫下陰影，中間不畫以免有橫向接縫 */
/* 廠商報價單對應的內部項次 */
.lines tbody tr.hl-line > td.int {
  background: color-mix(in srgb, var(--amber, #d49a1a) 16%, var(--surface));
}

.file-row {
  cursor: pointer;
}

.file-row.on td {
  background: color-mix(in srgb, var(--amber, #d49a1a) 10%, var(--surface));
}

.lines tbody tr.lifted > td {
  position: relative;
  z-index: 2;
  background: color-mix(in srgb, var(--teal-soft) 55%, var(--surface));
  transition: background 0.15s ease;
  /* 陰影只留上下、左右裁掉：每格各自畫陰影時才不會在格與格之間出現直向接縫 */
  clip-path: inset(-28px 0);
}

.lines tbody tr.lifted-first > td {
  box-shadow: 0 -6px 14px -6px rgba(15, 42, 46, 0.28);
}

.lines tbody tr.lifted-last > td {
  box-shadow: 0 10px 18px -6px rgba(15, 42, 46, 0.32);
}

.lines tbody tr.lifted-first.lifted-last > td {
  box-shadow: 0 -6px 14px -6px rgba(15, 42, 46, 0.28), 0 10px 18px -6px rgba(15, 42, 46, 0.32);
}

/* 內部項次拖到別的對外項次：不能放 */
.lines tbody tr.no-drop {
  cursor: not-allowed;
}

/* 透明的拖曳影像（append 在 body，所以要 global）：游標旁不顯示任何剪影 */
:global(.quote-drag-ghost) {
  position: fixed;
  top: -1000px;
  left: -1000px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* 草稿：輸入框填滿儲存格，欄與欄之間的間距就是一致的 */
.lines.editing :deep(.el-input),
.lines.editing :deep(.el-input-number),
.lines.editing :deep(.el-input-number .el-input) {
  display: block;
  width: 100%;
  min-width: 0;
}

.lines.editing :deep(.el-input + .el-input) {
  margin-top: 3px;
}

/* 草稿輸入框：28px、靜止時弱邊框，hover／focus 才提升 */
.lines.editing :deep(.el-input__wrapper) {
  min-height: 28px;
  padding: 0 8px;
  background: var(--surface);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--line) 82%, transparent) inset;
}

.lines.editing :deep(.el-input__inner) {
  height: 28px;
  line-height: 28px;
  text-align: left;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.lines.editing :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--line-strong) inset;
}

.lines.editing :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--teal) inset;
}

/* 必填星號（表頭）與按過儲存後沒填的必填欄位 */
.lines th .req {
  color: var(--el-color-danger);
  margin-left: 2px;
}

.lines.editing :deep(.invalid .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
  background: color-mix(in srgb, var(--el-color-danger) 6%, var(--surface));
}

.nature-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
}

.lines.editing :deep(.nature-row .el-select) {
  flex: none;
}

.lines.editing :deep(.nature-row .el-select__wrapper) {
  min-height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

.lines.editing :deep(.nature-row .months) {
  flex: none;
}

.opts {
  display: flex;
  align-items: center;
  gap: 4px 10px;
  flex-wrap: wrap;
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
  line-height: 18px;
}

.opts :deep(.el-checkbox) {
  height: 18px;
  margin-right: 0;
  font-size: 11px;
}

.opts :deep(.el-checkbox__input) {
  transform: scale(0.86);
  transform-origin: left center;
}

.opts :deep(.el-checkbox__label) {
  padding-left: 4px;
  font-size: 11px;
}

.opts .hint {
  margin-left: 4px;
}

.reason {
  margin-top: 3px;
}

.nowrap {
  white-space: nowrap;
}

.file {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  color: var(--teal);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.file .t {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.foot-label {
  text-align: left;
  color: var(--muted);
  font-weight: 600;
}


.table-actions {
  margin-top: 10px;
}

.plain-table td.acts {
  width: 40px;
  text-align: right;
}

.file-form {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.small {
  font-size: 12px;
}

.strike {
  text-decoration: line-through;
}

.hl {
  background: var(--amber-soft);
  font-weight: 600;
}

.paper {
  border: 1px solid var(--line);
  background: #fff;
  color: #16211b;
  padding: 28px 32px;
  font-size: 13px;
}

.paper-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 2px solid #16211b;
}

.paper-brand {
  font-size: 16px;
  font-weight: 700;
}

.paper-title {
  text-align: right;
}

.paper-title h3 {
  font-size: 22px;
  letter-spacing: 0.3em;
  margin: 0;
}

.paper-meta {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  gap: 6px 12px;
  margin: 14px 0;
}

.paper-meta dt {
  color: #5d6b66;
}

.paper-meta dd {
  margin: 0;
}

.paper-table {
  width: 100%;
  border-collapse: collapse;
}

.paper-table th,
.paper-table td {
  padding: 7px 8px;
  border-bottom: 1px solid #d9e0de;
  text-align: left;
}

.paper-table th {
  font-weight: 500;
  color: #5d6b66;
  border-bottom: 1px solid #16211b;
}

.paper-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.paper-table tfoot td {
  border-bottom: none;
}

.paper-table .label {
  text-align: right;
  color: #5d6b66;
}

.paper-table .grand td {
  font-weight: 700;
  border-top: 1px solid #16211b;
}

/* 回簽預覽：斜戳章＋簽章列 */
.paper.signed {
  position: relative;
  overflow: hidden;
}

.stamp {
  position: absolute;
  right: 48px;
  bottom: 40px;
  padding: 6px 14px;
  border: 3px solid var(--red);
  border-radius: 6px;
  color: var(--red);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  transform: rotate(-12deg);
  opacity: 0.8;
}

.sign-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px dashed var(--line-strong);
}

.sign-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sign-box .k {
  font-size: 12px;
  color: var(--muted);
}

.sign-box .ink {
  font-family: 'Noto Serif TC', 'PMingLiU', serif;
  font-size: 22px;
  color: #1f3a93;
  font-style: italic;
}

.paper-foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-top: 18px;
}

.terms {
  margin: 0;
  padding-left: 18px;
  color: #5d6b66;
  font-size: 12px;
  display: grid;
  gap: 4px;
}

.qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: none;
}

.qr-box {
  width: 72px;
  height: 72px;
  border: 1px dashed #9aa39c;
  background: repeating-linear-gradient(45deg, #e9eeec 0 4px, transparent 4px 8px);
}

.verify {
  text-decoration: underline;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
