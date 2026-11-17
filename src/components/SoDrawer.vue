<script setup lang="ts">
import NextHistory from './NextHistory.vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Upload, Paperclip } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderActualCost, orders, quotes, deals, customers, shipments, purchaseOrders, isOrderClosed, isGuarantee, milestoneProblems, billingOf, billingTaxOf, milestoneTaxes, orderTaxTotal, withTax, TAX_RATE, type Order, type Quote, type Milestone, type Shipment, type License, expiryKinds } from '../mock/data'
import { useAppStore } from '../stores/app'
import { money, pct, dateTime } from '../utils/format'
import DealDrawer from './DealDrawer.vue'
import ShipmentCreateDialog from './ShipmentCreateDialog.vue'
import ShipmentDrawer from './ShipmentDrawer.vue'
import MilestoneEditor from './MilestoneEditor.vue'
import ShipmentDetailDrawer from './ShipmentDetailDrawer.vue'
import SignReceiptPreview from './SignReceiptPreview.vue'
import CaseComments from './CaseComments.vue'
import EngSupportCard from './EngSupportCard.vue'
import MembersDialog from './MembersDialog.vue'
import UploadDialog from './UploadDialog.vue'
import BillingRequestDialog from './BillingRequestDialog.vue'
import { checkpointsOf, remainingToShip } from '../utils/checkpoints'

/*
 * 單張 SO 的抽屜，三層資訊：header 說「哪一張、誰的、多少錢」；概覽只放執行階段、財務階段與一條行動列；
 * 明細與操作各回自己的頁簽（請款與財務、交付與授權、紀錄與附件），同一種資訊只出現在一個地方。
 * 由下往上滑入、只蓋主內容區，全站抽屜統一（Pipeline、CRM、SO）。
 */
const props = defineProps<{ orderId: string | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useAppStore()
const router = useRouter()

const open = computed({
  get: () => !!props.orderId,
  set: (v) => {
    if (!v) emit('close')
  },
})
const o = computed(() => orders.find((x) => x.id === props.orderId))
/*
 * SO 是案件成立後的資料主體：訂單明細（成立時快照）、請款、交付、工程、留言、附件都在這裡，
 * 各角色打開同一張 SO，只看到和自己工作有關的頁簽與欄位，不用回 Pipeline。
 */
type Tab = 'lines' | 'finance' | 'delivery' | 'eng' | 'comments' | 'records'
const tab = ref<Tab>('lines')
/* 頁面權限：銷售訂單只有「檢視」時，商務、財務動作都不開；工程動作（起算、結案）仍依派工關係 */
const canOperatePage = computed(() => store.can('/sales/orders', 'edit'))
const canShipPage = computed(() => store.can('/inventory/shipments', 'edit'))
const isFinance = computed(() => canOperatePage.value && ['會計', '財務主管', '執行長'].includes(store.role))
const seeMoney = computed(() => !!o.value && store.canSeeOrderMoney(o.value))
const showTab = computed<Record<Tab, boolean>>(() => {
  const r = store.role
  return {
    lines: true,
    /* 保證單不請款（草案假設） */
    finance: !isG.value && ['業務', '業務主管', '執行長', '財務主管', '會計'].includes(r),
    delivery: ['業務', '業務主管', '執行長', '採購', '工程主管', '工程師'].includes(r),
    eng: ['業務', '業務主管', '執行長', '工程主管', '工程師'].includes(r),
    comments: true,
    records: true,
  }
})
/* 會計、財務主管不看商機來源 */
const showDealLink = computed(() => !['會計', '財務主管'].includes(store.role))
/* 跨頁連結：角色沒有目標頁的檢視權限就不給點 */
const canLicensesPage = computed(() => store.can('/inventory/licenses'))
const canPoPage = computed(() => store.can('/purchase/po'))
const canDealPage = computed(() => store.can('/sales/pipeline'))
watch(() => props.orderId, () => {
  tab.value = 'lines'
})

const deal = computed(() => (o.value ? deals.find((d) => d.id === o.value!.dealId) : undefined))
/*
 * 摘要列：執行面是不卡關的檢查點（下單、到貨、出貨、驗收、工程結案各自記），
 * 後面完成了前面沒補就標琥珀色提醒；財務面是未開票／已開票未收／已收款三個金額（含稅，另列未稅）。
 */
const today = new Date().toISOString().slice(0, 10)
const checkpoints = computed(() => (o.value ? checkpointsOf(o.value) : []))
const bill = computed(() => (o.value ? billingOf(o.value) : { total: 0, invoiced: 0, paid: 0, uninvoiced: 0, invoicedUnpaid: 0 }))
/* 含稅：各期分攤後加總等於含稅總計，不逐區塊重算 */
const billTax = computed(() => (o.value ? billingTaxOf(o.value) : { total: 0, invoiced: 0, paid: 0, uninvoiced: 0, invoicedUnpaid: 0 }))
const msTax = computed(() => (o.value ? milestoneTaxes(o.value) : []))
const billing = ref<{ order: Order; index?: number } | null>(null)
const canRequest = computed(() => !!o.value && canOps.value && !isG.value && !voided.value && o.value.milestones.some((m) => m.status === '待請款'))

/* 保證單：不計業績、可派工；不請款、不出貨、不合約變更；議價完上單核准轉正式 SO */
const isG = computed(() => !!o.value && isGuarantee(o.value))
const voided = computed(() => !!o.value?.voidedAt)
const voidOpen = ref(false)
const voidForm = ref<{ reason: '客戶未下單' | '改由其他案件承接'; dealId: string; note: string }>({ reason: '客戶未下單', dealId: '', note: '' })
const successorOptions = computed(() => (o.value ? deals.filter((d) => d.customer === o.value!.customer && d.id !== o.value!.dealId && d.stage !== '未成交') : []))
function startVoid() {
  voidForm.value = { reason: '客戶未下單', dealId: '', note: '' }
  voidOpen.value = true
}
function submitVoid() {
  const x = o.value
  if (!x) return
  if (voidForm.value.reason === '改由其他案件承接' && !voidForm.value.dealId) {
    ElMessage.warning('請選承接的商機')
    return
  }
  store.voidGuarantee(x, voidForm.value.reason, voidForm.value.note, voidForm.value.reason === '改由其他案件承接' ? voidForm.value.dealId : undefined)
  voidOpen.value = false
  ElMessage.success(`保證單 ${x.soNo} 已作廢，商機轉為未成交`)
}
/* 角色：負責業務、業務主管、執行長可做交付與請款的動作；會計、財務主管、執行長做開票與收款 */
const canOps = computed(() => !!o.value && canOperatePage.value && (['業務主管', '執行長'].includes(store.role) || (store.role === '業務' && o.value.owner === store.currentUser.name)))
void TAX_RATE
const lineRows = computed(() => o.value?.lines ?? [])
const linesTotal = computed(() => lineRows.value.reduce((n, l) => n + l.qty * l.unitPrice, 0))
/* 實際成本：PO 實際成本、出貨批次成本、自有工程標準成本；還沒下單或出貨的部分用預估補上 */
const actualInfo = computed(() => (o.value ? orderActualCost(o.value) : { cost: 0, settled: false }))
const actualCost = computed(() => actualInfo.value.cost)

/* 下一步：只存一份，商機與 SO 都能改 */
const nextEditing = ref(false)
const nextDraft = ref('')
function editNext() {
  nextDraft.value = deal.value?.nextAction ?? ''
  nextEditing.value = true
}
function saveNext() {
  if (deal.value && store.setNextAction(deal.value, nextDraft.value)) ElMessage.success('下一步已更新')
  nextEditing.value = false
}

/* 工程服務：服務單在 SO 繼續開；工程提出結案，SO 才能整案結案 */
const openTickets = computed(() => (deal.value?.engRequests ?? []).filter((t) => ['待派工', '待接受', '已派工', '已退回'].includes(t.status)))
const canEngClose = computed(() => !!o.value && !o.value.engClosedAt && (['工程主管', '執行長'].includes(store.role) || (store.role === '工程師' && (deal.value?.engRequests ?? []).some((t) => t.assigneeIds.includes(store.currentUserId))) || (canOps.value && !(deal.value?.engRequests ?? []).length)))
async function engClose() {
  const x = o.value
  if (!x) return
  const ok = await ElMessageBox.confirm(`${x.soNo} 工程結案？`, '工程結案', { confirmButtonText: '結案', cancelButtonText: '取消' }).then(() => true, () => false)
  if (!ok) return
  if (!store.closeEngineering(x)) {
    ElMessage.warning('還有服務單沒完成，不能工程結案')
    return
  }
  ElMessage.success(isOrderClosed(x) ? '工程已結案，訂單結案' : '工程已結案')
}

/* 協作成員：沿用商機的成員（同一個案件） */
const membersOpen = ref(false)
const canManageMembers = computed(() => !!deal.value && canOperatePage.value && store.canManageMembers(deal.value))

/* 附件：這個案件的全部附件（商機、SO、PO、出貨單），上傳掛在 SO */
const uploading = ref(false)
const caseFiles = computed(() => {
  const x = o.value
  if (!x) return []
  const refs = new Set([...purchaseOrders.filter((po) => po.soNo === x.soNo).map((po) => po.poNo), ...shipments.filter((sh) => sh.orderId === x.id).map((sh) => sh.shipNo)])
  return store.attachments.filter((a) => !a.voided && (a.refNo.startsWith(x.dealNo) || a.refNo.startsWith(x.soNo) || (!!x.guaranteeNo && a.refNo.startsWith(x.guaranteeNo)) || refs.has(a.refNo))).sort((a, b) => b.at.localeCompare(a.at))
})
const quoteLabel = computed(() => {
  const q = o.value ? quotes.find((x) => x.id === o.value!.quoteId) : undefined
  return q ? `報價 v${q.version}${q.signbackFile ? `　·　客戶回簽 ${q.signbackFile}` : ''}` : ''
})
const caseCommentCount = computed(() => (deal.value ? store.comments.filter((c) => c.dealId === deal.value!.id).length : 0))
const kb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(1)} MB` : `${n} KB`)
const isRenewal = computed(() => !!deal.value?.renewalOfDealId)
const closed = computed(() => !!o.value && isOrderClosed(o.value))
const widthOf = (amt: number) => `${o.value && o.value.amount ? Math.min(100, Math.round((amt / o.value.amount) * 100)) : 0}%`
/* 行動列裡的精簡雙進度：抽屜可能從通知直接打開，使用者未必看過列表 */
/* 結案時名稱保留最後走到的階段（驗收／已收款），右側另標「✓ 結案」，使用者仍看得到結案前走到哪 */
const nextIdx = computed(() => (o.value ? o.value.milestones.findIndex((m) => m.status !== '已收款') : -1))
const rows = computed(() => (o.value ? o.value.milestones.map((m, i) => ({ m, i })) : []))
const orderShipments = computed(() => (o.value ? shipments.filter((s) => s.orderId === o.value!.id).sort((a, b) => b.at.localeCompare(a.at)) : []))
/* 流程紀錄：新的在前；內容裡的單號可點：PO→採購單列表展開、出貨單→出貨單頁展開、批次→庫存查詢點亮、發票→預覽 */
const logRows = computed(() => [...(o.value?.log ?? [])].sort((a, b) => b.at.localeCompare(a.at)))
const trackTag: Record<string, string> = { 執行: 'teal', 財務: 'olive', 合約: 'amber' }
type Seg = { text: string; to?: string; invoice?: string; ship?: string }
const TOKEN = /(\b\d{4}-\d{2}-\d{2}-\d{3}\b|\bS-\d{4}-\d{4}-\d{3}\b|\bB-\d{4}-\d{4}-\d{2}(?:-\d{3})?\b|\bAB-\d{8}\b)/g
function linkify(text: string): Seg[] {
  const out: Seg[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    const t = m[0]
    if (m.index! > last) out.push({ text: text.slice(last, m.index) })
    if (t.startsWith('S-')) out.push({ text: t, ship: t })
    else if (t.startsWith('B-')) out.push({ text: t, to: `/inventory?batch=${t}` })
    else if (t.startsWith('AB-')) out.push({ text: t, invoice: t })
    else out.push({ text: t, to: `/purchase/po?po=${t}` })
    last = m.index! + t.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}
/* 到期項目：全部來自報價單項次（授權／硬體在出貨時、維護合約／服務合約在 SO 成立時產生），不手動新增；點一筆跳到到期項目頁改到期日 */
/* 這張 SO 的採購單：已掛 SO 的，加上保證單階段先開的預下單 PO（上單核准後才改掛 SO） */
const soPos = computed(() => (o.value ? purchaseOrders.filter((p) => p.soNo === o.value!.soNo || p.orderId === o.value!.id || (isGuarantee(o.value!) && p.dealId === o.value!.dealId && p.soNo === `預下單 ${o.value!.dealNo}`)) : []))
const kindLabel = (key: string) => expiryKinds.find((k) => k.key === key)?.label ?? key
/* 授權起算日：工程上授權後確認（1112 會議 #3） */
const canStartLicense = computed(() => ['工程主管', '工程師'].includes(store.role))
const startDlg = ref<{ open: boolean; lic: License | null; date: string }>({ open: false, lic: null, date: '' })
function openStart(l: License) {
  startDlg.value = { open: true, lic: l, date: new Date().toISOString().slice(0, 10) }
}
function confirmStart() {
  const { lic, date } = startDlg.value
  if (!o.value || !lic || !date) return
  store.setLicenseStart(o.value, lic, date)
  startDlg.value.open = false
  ElMessage.success(`${lic.name} 起算 ${date}，到期 ${lic.expires}`)
}
function jumpLicense(l: License) {
  if (!canLicensesPage.value) return
  router.push({ path: '/inventory/licenses', query: { lic: l.id } })
  emit('close')
}
function openDeal(id: string) {
  if (!canDealPage.value) return
  router.push({ path: '/sales/pipeline', query: { deal: id } })
  emit('close')
}
/* 出貨單：開明細抽屜，不跳頁 */
const shipDetail = ref<Shipment | null>(null)
function openShipment(no: string) {
  shipDetail.value = shipments.find((x) => x.shipNo === no) ?? null
}
function go(to: string) {
  router.push(to)
  emit('close')
}
/* 發票預覽（示範用） */
const invoiceNo = ref<string | null>(null)
const invoiceMs = computed(() => o.value?.milestones.find((m) => m.invoiceNo === invoiceNo.value))
const invoiceTax = computed(() => (o.value && invoiceMs.value ? (msTax.value[o.value.milestones.indexOf(invoiceMs.value)] ?? withTax(invoiceMs.value.amount)) : 0))
function previewInvoice(no: string) {
  invoiceNo.value = no
}
const mmdd = (d?: string) => (d ? d.slice(5).replace('-', '/') : '—')

const msTag: Record<string, string> = { 待請款: 'slate', 已申請: 'amber', 已開票: 'teal', 已收款: 'olive' }

/* 合約變更：已核准版本要改，單一入口在這裡（接單到已入庫之間） */
const changeDeal = ref<string | null>(null)
const changeQuoteId = ref<string | undefined>()
/* 合約變更：合約結束日前都可以（1112 會議：收款後也可能要變更）；沒有變更中的版本、未結案；負責業務、業務主管、執行長可做 */
const contractEnded = computed(() => !!o.value?.contractEndAt && o.value.contractEndAt < today)
const canChange = computed(() => !!o.value && canOperatePage.value && !o.value.changeQuoteId && !closed.value && !contractEnded.value)
const changeHint = computed(() => (!o.value ? '' : contractEnded.value ? `合約已於 ${o.value.contractEndAt} 結束` : closed.value ? '已結案' : ''))

/* 合約結束日：業務填；可從驗收完成日起算一年 */
const endEditing = ref(false)
const endDraft = ref('')
const acceptedAt = computed(() => shipments.filter((sh) => sh.orderId === o.value?.id && sh.signedAt).map((sh) => sh.signedAt!).sort().pop())
function editEnd() {
  endDraft.value = o.value?.contractEndAt ?? ''
  endEditing.value = true
}
function endFromAccept() {
  if (!acceptedAt.value) return
  const d = new Date(acceptedAt.value)
  d.setFullYear(d.getFullYear() + 1)
  endDraft.value = d.toISOString().slice(0, 10)
}
function saveEnd() {
  if (o.value) store.setContractEnd(o.value, endDraft.value ?? '')
  endEditing.value = false
}
const orderStatus = computed(() => (!o.value ? '' : voided.value ? '已作廢' : isG.value ? '保證單' : closed.value ? '結案' : o.value.changeQuoteId ? '合約變更中' : '執行中'))
const statusCls = computed(() => (voided.value ? 'slate' : isG.value ? 'amber' : closed.value ? 'olive' : o.value?.changeQuoteId ? 'amber' : 'teal'))
function startChange() {
  const x = o.value
  if (!x) return
  const base = quotes.find((q) => q.id === x.quoteId) ?? quotes.filter((q) => q.dealId === x.dealId).sort((a, b) => b.version - a.version)[0]
  if (!base) return
  const version = Math.max(...quotes.filter((q) => q.dealId === x.dealId).map((q) => q.version)) + 1
  const draft: Quote = {
    id: `q-${Date.now()}`,
    dealId: x.dealId,
    version,
    date: new Date().toISOString().slice(0, 10),
    status: '草稿',
    note: `合約變更：自 v${base.version} 複製`,
    items: base.items.map((i) => ({ ...i })),
    lines: base.lines.map((l) => ({ ...l })),
  }
  quotes.push(draft)
  x.changeQuoteId = draft.id
  store.logOrder(x, '合約', `開始合約變更，自 v${base.version} 複製為 v${version} 草稿`)
  const d = deals.find((y) => y.id === x.dealId)
  if (d) d.quoteVersions = quotes.filter((q) => q.dealId === x.dealId).length
  openChange()
}
function openChange() {
  if (!o.value) return
  changeQuoteId.value = o.value.changeQuoteId
  changeDeal.value = o.value.dealId
}

/* 出貨與驗收 */
const shipping = ref<Order | null>(null)
const creatingShipment = ref<Order | null>(null)
/* 出貨單由採購（倉管）建立，業務只做客戶簽收 */
const canCreateShip = computed(() => !isG.value && canShipPage.value && ['採購', '採購主管', '執行長'].includes(store.role))
const canShip = computed(() => !!o.value && remainingToShip(o.value) > 0 && !o.value.changeQuoteId)
/* 驗收不必等出貨（1113：先驗收未出貨），前面沒補的由檢查點用琥珀色提醒 */
const canSign = computed(() => !!o.value && !isG.value && (o.value.stageIndex < 6 || unsignedShipments.value > 0) && !o.value.changeQuoteId)
const shipHint = computed(() => (!o.value ? '' : o.value.changeQuoteId ? '合約變更期間暫停出貨' : remainingToShip(o.value) === 0 ? '已全部出貨' : ''))
const signHint = computed(() => (!o.value ? '' : o.value.changeQuoteId ? '合約變更期間暫停驗收' : o.value.stageIndex >= 6 ? '已驗收' : ''))
const unsignedShipments = computed(() => (o.value ? shipments.filter((s) => s.orderId === o.value!.id && s.status === '已出貨').length : 0))
function onSigned(orderId: string, method: string, file: string) {
  const x = orders.find((y) => y.id === orderId)
  if (!x) return
  store.signOff(x, method, undefined, file)
  ElMessage.success(`${x.customer} 已簽收（${method}），訂單進到「驗收」，業務收到通知`)
}

/* 簽收檔：點檔名預覽（示範用紙本）；重新簽收走同一個簽收抽屜（iPad／連結／掃描），舊檔作廢並寫一筆流程紀錄 */
const signPreview = ref<Shipment | null>(null)
const resign = ref<Shipment | null>(null)
function onResigned(orderId: string, shipmentId: string, method: string, file: string) {
  const x = orders.find((y) => y.id === orderId)
  const s = shipments.find((y) => y.id === shipmentId)
  if (!x || !s) return
  store.resign(x, s, method, undefined, file)
  ElMessage.success(`${s.shipNo} 已重新簽收（${method}）`)
}

/* 請款：通知開票（BillingRequestDialog）→ 會計開票（填發票號碼）→ 收款入帳（示範，正式版由三期沖帳） */
async function issueInvoice(i: number) {
  const x = o.value
  if (!x) return
  const { value } = await ElMessageBox.prompt('發票號碼', `開立發票｜${x.soNo} 第 ${i + 1} 期 ${x.milestones[i]!.label}`, { inputValue: 'AB-', inputPlaceholder: '例：AB-12345678', confirmButtonText: '已開立', cancelButtonText: '取消', inputValidator: (v) => /^[A-Z]{2}-\d{8}$/.test(v.trim()) || '格式：兩碼英文加 8 碼數字' }).catch(() => ({ value: '' }))
  if (!value) return
  store.issueInvoice(x, i, value.trim())
  ElMessage.success(`第 ${i + 1} 期發票已開立，業務會收到通知`)
}
async function confirmPaid(i: number) {
  const x = o.value
  if (!x) return
  const ok = await ElMessageBox.confirm(`確認第 ${i + 1} 期 ${x.milestones[i]!.label} 已收款？正式版由三期收款沖帳自動推進。`, '收款入帳', { confirmButtonText: '已收款', cancelButtonText: '取消' }).then(() => true, () => false)
  if (!ok) return
  store.confirmPaid(x, i)
  ElMessage.success(isOrderClosed(x) ? '已收款，執行與財務都完成，訂單結案' : '已收款，業務會收到通知')
}

/* 請款條件：負責業務、業務主管、財務主管、會計、執行長可改；結案後不行；已請款的期數在編輯器裡鎖定 */
const msEditing = ref(false)
const msDraft = ref<Milestone[]>([])
const canEditMs = computed(() => !!o.value && canOperatePage.value && !closed.value && (['業務主管', '財務主管', '會計', '執行長'].includes(store.role) || (store.role === '業務' && o.value.owner === store.currentUser.name)))
function editMs() {
  if (!o.value) return
  msDraft.value = o.value.milestones.map((m) => ({ ...m }))
  msEditing.value = true
}
const msProblems = computed(() => (msEditing.value && o.value ? milestoneProblems(msDraft.value, o.value.amount, true) : []))
function saveMs() {
  const x = o.value
  if (!x || msProblems.value.length) return
  x.milestones = msDraft.value.map((m) => ({ ...m }))
  store.logOrder(x, '財務', `請款條件更新為 ${x.milestones.length} 期`)
  msEditing.value = false
  ElMessage.success(`${x.soNo} 請款條件已更新為 ${x.milestones.length} 期，財務會收到通知`)
}

/* 結案後：右上角「續約」建立續約商機；已有進行中的續約商機就顯示它 */
const renewalDeal = computed(() => (o.value ? store.activeRenewalOf(o.value.dealId) : undefined))
async function renewFromSo() {
  const x = o.value
  if (!x) return
  const lic = x.licenses.map((l) => `${l.sku} × ${l.qty}（${l.expires} 到期）`).join('、')
  const ok = await ElMessageBox.confirm(`為 ${x.customer} ${x.soNo} 建立續約商機？${lic ? `續約項目：${lic}。` : ''}`, '建立續約商機', { confirmButtonText: '建立', cancelButtonText: '取消' }).then(() => true, () => false)
  if (!ok) return
  const r = store.createRenewalDeal(x)
  if (r.existing) {
    openDeal(r.existing.id)
    return
  }
  if (r.deal) {
    ElMessage.success(`已建立續約商機 ${r.deal.dealNo}，負責 ${r.deal.owner}`)
    openDeal(r.deal.id)
  }
}
</script>

<template>
  <el-drawer v-model="open" direction="btt" size="100%" :with-header="false" destroy-on-close class="deal-drawer" modal-class="deal-drawer-mask">
    <div v-if="o" class="drawer">
      <header class="head">
        <div class="head-main">
          <div class="eyebrow">
            <span class="num">{{ o.soNo }}</span>
            <span class="tag" :class="statusCls">{{ orderStatus }}</span>
            <span v-if="isRenewal" class="tag slate">續約</span>
            <span v-if="isG && o.guaranteeReason" class="tag amber">{{ o.guaranteeReason }}</span>
            <span v-if="!isG && o.guaranteeNo" class="muted">原保證單 {{ o.guaranteeNo }}</span>
            <span v-if="showDealLink" class="muted">商機 <a v-if="canDealPage" class="link" @click="openDeal(o.dealId)">{{ o.dealNo }}</a><template v-else>{{ o.dealNo }}</template></span>
          </div>
          <h2>{{ o.customer }}</h2>
          <p class="muted">{{ o.product }}</p>
          <div class="meta">
            <span>業務 <b>{{ o.owner }}</b></span>
            <template v-if="seeMoney">
              <span>訂單金額 <b class="num">{{ money(o.amount) }}</b>（含稅 {{ money(orderTaxTotal(o)) }}）</span>
              <span>毛利率 <b>{{ pct((o.amount - actualCost) / o.amount) }}</b></span>
            </template>
          </div>
        </div>
        <div class="head-actions">
          <template v-if="canOps && isG">
            <el-button v-if="!voided" @click="startVoid">作廢</el-button>
          </template>
          <template v-else-if="canOps">
            <template v-if="closed">
              <el-button v-if="renewalDeal" @click="openDeal(renewalDeal.id)">續約商機 {{ renewalDeal.dealNo }}</el-button>
              <el-button v-else @click="renewFromSo">續約</el-button>
            </template>
            <el-button v-else-if="o.changeQuoteId" @click="openChange">繼續合約變更</el-button>
            <el-button v-else :disabled="!canChange" :title="changeHint" @click="startChange">合約變更</el-button>
          </template>
          <el-button @click="emit('close')">關閉</el-button>
        </div>
      </header>

      <!-- 摘要列：所有頁簽都看得到 -->
      <div class="summary" :class="{ done: closed }">
        <div class="sum-block">
          <span class="sum-label">執行</span>
          <div class="cps">
            <span v-for="c in checkpoints" :key="c.key" class="cp" :class="{ done: c.done, gap: c.gap, wait: !!c.wait }" :title="c.gap ? '後面已完成，這一步還沒補' : ''">{{ c.label }}<template v-if="c.done && c.at"> {{ c.at }}</template><template v-else-if="c.wait"> {{ c.wait }}</template></span>
            <span v-if="closed" class="mini-terminal">✓ 結案</span>
            <span v-else-if="o.changeQuoteId" class="mini-terminal amber">合約變更中</span>
          </div>
        </div>
        <div v-if="seeMoney && !isG" class="sum-block fin">
          <span class="sum-label">財務（含稅，總額 {{ money(billTax.total) }}）</span>
          <div class="fin-bar"><span class="paid" :style="{ width: widthOf(bill.paid) }"></span><span class="inv" :style="{ width: widthOf(bill.invoicedUnpaid) }"></span></div>
          <div class="fin-nums">
            <span>已收款 <b class="num">{{ money(billTax.paid) }}</b></span>
            <span>已開票未收 <b class="num">{{ money(billTax.invoicedUnpaid) }}</b></span>
            <span class="un">未開票 <b class="num">{{ money(billTax.uninvoiced) }}</b></span>
          </div>
        </div>
        <el-button v-if="canRequest" type="primary" class="req-btn" @click="billing = { order: o }">通知財務開票</el-button>
      </div>

      <el-tabs v-model="tab" class="tabs">
        <el-tab-pane label="訂單明細" name="lines">
          <div class="section lines-page">
            <div class="lines-main">
              <div class="sub-head">
                <h3 class="sub">訂單明細</h3>
                <span class="muted small">{{ quoteLabel }}</span>
              </div>
              <table v-if="lineRows.length" class="plain-table inner lines">
                <thead>
                  <tr>
                    <th class="c-no">項次</th>
                    <th>品項</th>
                    <th class="num c-qty">數量</th>
                    <template v-if="seeMoney"><th class="num c-amt">單價（未稅）</th><th class="num c-amt">小計（未稅）</th><th class="num c-amt">含稅</th></template>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="l in lineRows" :key="l.no">
                    <tr class="ext">
                      <td class="c-no">{{ l.no }}</td>
                      <td><b>{{ l.name }}</b><div v-if="l.sku || l.desc" class="muted small">{{ [l.sku, l.desc].filter(Boolean).join('　·　') }}</div></td>
                      <td class="num">{{ l.qty }}</td>
                      <template v-if="seeMoney"><td class="num">{{ money(l.unitPrice) }}</td><td class="num">{{ money(l.qty * l.unitPrice) }}</td><td class="num">{{ money(withTax(l.qty * l.unitPrice)) }}</td></template>
                    </tr>
                    <tr v-for="x in l.internal" :key="`${l.no}-${x.no}`" class="int">
                      <td class="c-no muted small">{{ l.no }}.{{ x.no }}</td>
                      <td class="muted small">{{ x.intSku }}　·　{{ x.nature }}<template v-if="x.months">　·　{{ x.months }} 個月</template><template v-if="seeMoney">　·　{{ x.vendor === '自有工程' ? '自有工程' : x.stockQty && x.stockQty >= x.qty ? '使用庫存' : x.vendor || '供應商未定' }}</template></td>
                      <td class="num muted small">{{ x.qty }}</td>
                      <template v-if="seeMoney"><td class="num muted small">{{ x.unitCost === null ? '—' : money(x.unitCost) }}</td><td></td><td></td></template>
                    </tr>
                  </template>
                </tbody>
                <tfoot v-if="seeMoney">
                  <tr><td></td><td>合計</td><td></td><td></td><td class="num">{{ money(linesTotal) }}</td><td class="num">{{ money(withTax(linesTotal)) }}</td></tr>
                </tfoot>
              </table>
              <p v-else class="muted small">尚無訂單明細。</p>
            </div>
            <aside class="lines-side">
              <section v-if="showDealLink" class="side-card">
                <div class="sub-head">
                  <h3 class="sub">下一步</h3>
                  <el-button v-if="canOps" size="small" @click="editNext">編輯</el-button>
                </div>
                <p class="next-text">{{ deal?.nextAction || '—' }}<NextHistory v-if="deal" :deal="deal" /></p>
              </section>
              <section v-if="!isG" class="side-card">
                <div class="sub-head">
                  <h3 class="sub">合約結束日</h3>
                  <el-button v-if="canOps" size="small" @click="editEnd">編輯</el-button>
                </div>
                <p class="next-text"><span :class="{ late: contractEnded }">{{ o.contractEndAt ?? '—' }}</span><span v-if="contractEnded" class="muted small">　已結束，不能合約變更</span></p>
              </section>
              <section v-if="seeMoney" class="side-card">
                <h3 class="sub">毛利</h3>
                <dl class="kv-rows">
                  <dt>預估成本</dt><dd class="num">{{ money(o.cost) }}</dd>
                  <dt>實際成本</dt><dd class="num"><b>{{ money(actualCost) }}</b></dd>
                  <dt>毛利率</dt><dd class="num"><b>{{ pct((o.amount - actualCost) / o.amount) }}</b></dd>
                </dl>
              </section>
            </aside>
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="showTab.finance" label="請款與財務" name="finance">
          <div class="section">
            <div class="sub-head">
              <h3 class="sub">請款里程碑</h3>
              <el-button v-if="canEditMs" size="small" @click="editMs">編輯請款條件</el-button>
            </div>
            <table v-if="rows.length" class="plain-table inner ms">
              <thead><tr><th>期次 / 名稱</th><th class="num">未稅</th><th class="num">含稅</th><th>預計開票</th><th>預計付款</th><th>狀態</th><th>發票 / 收款</th><th></th></tr></thead>
              <tbody>
                <tr v-for="r in rows" :key="r.i" :class="{ next: r.i === nextIdx && !closed }">
                  <td><span class="idx">{{ r.i + 1 }}</span>{{ r.m.label }}</td>
                  <td class="num">{{ money(r.m.amount) }}</td>
                  <td class="num"><b>{{ money(msTax[r.i] ?? withTax(r.m.amount)) }}</b></td>
                  <td class="id" :class="{ late: r.m.status === '待請款' && r.m.planInvoiceAt && r.m.planInvoiceAt <= today }">{{ mmdd(r.m.planInvoiceAt) }}</td>
                  <td class="id" :class="{ late: r.m.status !== '已收款' && r.m.planPayAt && r.m.planPayAt < today }">{{ mmdd(r.m.planPayAt) }}</td>
                  <td><span class="tag" :class="msTag[r.m.status]">{{ r.m.status === '已申請' ? '待開票' : r.m.status === '待請款' ? '未開票' : r.m.status }}</span><div v-if="r.m.requestedAt" class="muted small">通知 {{ mmdd(r.m.requestedAt) }}</div></td>
                  <td class="id">
                    <template v-if="r.m.invoiceNo"><div :title="r.m.invoicedAt">{{ r.m.invoiceNo }} · {{ mmdd(r.m.invoicedAt) }}</div><div class="muted small" :title="r.m.paidAt">{{ r.m.paidAt ? `收款 ${mmdd(r.m.paidAt)}` : '未收款' }}</div></template>
                    <template v-else>—</template>
                  </td>
                  <td class="acts">
                    <el-button v-if="r.m.status === '待請款' && canOps" size="small" type="primary" @click="billing = { order: o, index: r.i }">通知開票</el-button>
                    <el-button v-else-if="r.m.status === '已申請' && isFinance" size="small" type="primary" @click="issueInvoice(r.i)">開立發票</el-button>
                    <el-button v-else-if="r.m.status === '已開票' && isFinance" size="small" @click="confirmPaid(r.i)">收款入帳</el-button>
                    <span v-else-if="r.m.status === '已申請'" class="muted small">等會計開票</span>
                    <span v-else-if="r.m.status === '已開票'" class="muted small">等客戶付款</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted small">尚未設定請款條件。</p>
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="showTab.delivery" label="交付與授權" name="delivery">
          <div class="section">
            <h3 class="sub">採購單</h3>
            <table v-if="soPos.length" class="plain-table inner">
              <thead><tr><th>PO</th><th>供應商</th><th>狀態</th><th>預計交期</th><th>原廠簽回</th></tr></thead>
              <tbody>
                <tr v-for="p in soPos" :key="p.id" :class="{ 'click-row': canPoPage }" @click="canPoPage && router.push({ path: '/purchase/po', query: { po: p.poNo } })">
                  <td class="id">{{ p.poNo }}<span v-if="p.preOrder" class="tag amber">預下單</span></td>
                  <td>{{ p.vendor }}</td>
                  <td><span class="tag" :class="p.status === '待核准' ? 'amber' : p.status === '已到貨' ? 'olive' : 'teal'">{{ p.status }}</span></td>
                  <td class="id">{{ p.expectedAt ?? '—' }}</td>
                  <td class="small">{{ p.signbackFile ? '已簽回' : '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted small">尚無採購單。</p>
            <div class="sub-head">
              <h3 class="sub">簽收</h3>
              <div class="sub-acts">
                <el-button v-if="canOps && canSign && !unsignedShipments" size="small" @click="shipping = o">客戶驗收</el-button>
                <el-button v-if="canCreateShip" size="small" :disabled="!canShip" :title="shipHint" @click="creatingShipment = o">{{ orderShipments.length && remainingToShip(o) > 0 ? '出貨剩餘項次' : '建立出貨單' }}</el-button>
              </div>
            </div>
            <table v-if="orderShipments.length" class="plain-table inner four">
              <colgroup><col /><col class="c2" /><col class="c3" /><col class="c4" /></colgroup>
              <thead><tr><th>內容</th><th>單號</th><th>日期</th><th></th></tr></thead>
              <tbody>
                <tr v-for="s in orderShipments" :key="s.id">
                  <td>{{ s.lines.map((l) => `${l.name} × ${l.qty}`).join('、') }}</td>
                  <td class="id"><a class="link" @click="shipDetail = s">{{ s.shipNo }}</a></td>
                  <td class="id">{{ s.at }}</td>
                  <td class="sign-cell">
                    <div v-if="s.status === '已簽收'" class="sign-wrap">
                      <a class="link file" :title="s.signFile" @click="signPreview = s">{{ s.signFile ?? '簽收檔' }}</a>
                      <el-button v-if="canOps" text size="small" class="re-up" @click="resign = s">重新簽收</el-button>
                    </div>
                    <el-button v-else-if="canOps" size="small" type="primary" :disabled="!canSign" :title="signHint" @click="shipping = o">客戶簽收</el-button>
                    <span v-else class="muted small">待簽收</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted small">尚未建立出貨單。</p>

            <h3 class="sub">到期項目</h3>
            <table v-if="o.licenses.length" class="plain-table inner four">
              <colgroup><col class="c4" /><col /><col class="c3" /><col class="c3" /></colgroup>
              <thead><tr><th>類型</th><th>項目</th><th class="num">數量</th><th>到期日</th></tr></thead>
              <tbody>
                <tr v-for="l in o.licenses" :key="l.id" :class="{ 'click-row': canLicensesPage }" @click="jumpLicense(l)">
                  <td><span class="tag teal">{{ kindLabel(l.kind) }}</span></td>
                  <td>{{ l.name }}<div v-if="l.sku" class="muted small">{{ l.sku }}</div></td>
                  <td class="num">{{ l.qty }}</td>
                  <td class="id">
                    <template v-if="l.kind === '授權' && !l.start">
                      <span class="tag amber">待起算</span>
                      <el-button v-if="canStartLicense" size="small" text type="primary" @click.stop="openStart(l)">確認起算日</el-button>
                    </template>
                    <template v-else>{{ l.expires }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted small">尚無到期項目。</p>
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="showTab.eng && deal" label="工程服務" name="eng">
          <div class="section">
            <div v-if="!isG" class="sub-head eng-head">
              <h3 class="sub">工程結案</h3>
              <div class="sub-acts">
                <span v-if="o.engClosedAt" class="tag olive">已結案 {{ o.engClosedAt }}</span>
                <el-button v-else-if="canEngClose" size="small" type="primary" :disabled="openTickets.length > 0" :title="openTickets.length ? `還有 ${openTickets.length} 張服務單未完成` : ''" @click="engClose">工程結案</el-button>
                <span v-else class="muted small">未結案</span>
              </div>
            </div>
            <EngSupportCard :deal="deal" :can-edit="canOps && !closed && !voided" />
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`留言（${caseCommentCount}）`" name="comments">
          <div class="section">
            <CaseComments v-if="deal" :deal="deal" :can-manage-members="canManageMembers" :active="tab === 'comments'" @add-member="membersOpen = true" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="附件與紀錄" name="records">
          <div class="section">
            <div class="sub-head">
              <h3 class="sub">附件</h3>
              <el-button size="small" :icon="Upload" @click="uploading = true">上傳附件</el-button>
            </div>
            <table v-if="caseFiles.length" class="plain-table inner">
              <thead><tr><th>類型</th><th>檔案</th><th>單號</th><th>上傳者</th><th>時間</th><th class="num">大小</th></tr></thead>
              <tbody>
                <tr v-for="f in caseFiles" :key="f.id">
                  <td><span class="tag slate">{{ f.type }}</span></td>
                  <td><span class="file"><el-icon><Paperclip /></el-icon>{{ f.title ?? f.fileName }}</span></td>
                  <td class="id">{{ f.refNo }}</td>
                  <td>{{ f.uploader }}</td>
                  <td class="id nowrap">{{ dateTime(f.at) }}</td>
                  <td class="num">{{ kb(f.sizeKb) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted small">還沒有附件。</p>

            <h3 class="sub">流程紀錄</h3>
            <table v-if="logRows.length" class="plain-table inner">
              <thead><tr><th>時間</th><th>階段</th><th>內容</th><th>操作人</th></tr></thead>
              <tbody>
                <tr v-for="(l, i) in logRows" :key="i">
                  <td class="muted small nowrap">{{ dateTime(l.at) }}</td>
                  <td><span class="tag" :class="trackTag[l.track]">{{ l.track }}</span></td>
                  <td><template v-for="(seg, k) in linkify(l.text)" :key="k"><a v-if="seg.to" class="link" @click="go(seg.to)">{{ seg.text }}</a><a v-else-if="seg.ship" class="link" @click="openShipment(seg.ship)">{{ seg.text }}</a><a v-else-if="seg.invoice" class="link" @click="previewInvoice(seg.invoice)">{{ seg.text }}</a><template v-else>{{ seg.text }}</template></template></td>
                  <td>{{ l.by }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted small">尚無流程紀錄。</p>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <ShipmentDrawer :order="shipping ?? (resign ? o ?? null : null)" :shipment="resign" @close="shipping = null; resign = null" @signed="onSigned" @resigned="onResigned" />
    <ShipmentDetailDrawer :shipment="shipDetail" @close="shipDetail = null" />
    <MembersDialog v-model="membersOpen" :deal="deal ?? null" />
    <BillingRequestDialog :order="billing?.order ?? null" :index="billing?.index" @close="billing = null" />
    <el-dialog v-model="endEditing" title="合約結束日" width="420px" append-to-body>
      <div class="end-form">
        <el-date-picker v-model="endDraft" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        <el-button v-if="acceptedAt" size="small" @click="endFromAccept">驗收完成起算一年（{{ acceptedAt }}）</el-button>
      </div>
      <template #footer>
        <el-button @click="endEditing = false">取消</el-button>
        <el-button type="primary" @click="saveEnd">儲存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="voidOpen" :title="o ? `作廢保證單 ${o.soNo}` : ''" width="520px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="原因" required>
          <el-radio-group v-model="voidForm.reason">
            <el-radio-button value="客戶未下單">客戶未下單</el-radio-button>
            <el-radio-button value="改由其他案件承接">改由其他案件承接</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="voidForm.reason === '改由其他案件承接'" label="承接的商機" required>
          <el-select v-model="voidForm.dealId" placeholder="同客戶的商機" style="width: 100%">
            <el-option v-for="d in successorOptions" :key="d.id" :value="d.id" :label="`${d.dealNo}　${d.customerDept}　${d.product}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="備註">
          <el-input v-model="voidForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="voidOpen = false">取消</el-button>
        <el-button type="danger" @click="submitVoid">作廢</el-button>
      </template>
    </el-dialog>
    <UploadDialog v-if="o" v-model="uploading" :ref-no="o.soNo" :party="o.customer" simple title="上傳附件" />
    <el-dialog v-model="nextEditing" title="下一步" width="520px" append-to-body>
      <el-input v-model="nextDraft" type="textarea" :rows="3" />
      <template #footer>
        <el-button @click="nextEditing = false">取消</el-button>
        <el-button type="primary" @click="saveNext">儲存</el-button>
      </template>
    </el-dialog>
    <ShipmentCreateDialog :order="creatingShipment" @close="creatingShipment = null" />
    <DealDrawer :deal-id="changeDeal" initial-tab="quotes" :initial-quote-id="changeQuoteId" @close="changeDeal = null" @open="(id: string) => { changeQuoteId = undefined; changeDeal = id }" />
    <SignReceiptPreview v-if="o" :shipment="signPreview" :customer="o.customer" :so-no="o.soNo" @close="signPreview = null" />
    <el-dialog :model-value="!!invoiceNo" title="發票預覽" width="560px" append-to-body @close="invoiceNo = null">
      <div v-if="o && invoiceNo" class="invoice">
        <div class="inv-head"><b>電子發票證明聯</b><span class="id">{{ invoiceNo }}</span></div>
        <dl class="kv">
          <dt>開立日期</dt><dd>{{ invoiceMs?.invoicedAt ?? '—' }}</dd>
          <dt>買受人</dt><dd>{{ o.customer }}</dd>
          <dt>品名</dt><dd>{{ o.product }}{{ invoiceMs ? `（${invoiceMs.label}）` : '' }}</dd>
          <dt>銷售額</dt><dd class="num">{{ money(invoiceMs?.amount ?? 0) }}</dd>
          <dt>營業稅</dt><dd class="num">{{ money(invoiceTax - (invoiceMs?.amount ?? 0)) }}</dd>
          <dt>總計</dt><dd class="num"><b>{{ money(invoiceTax) }}</b></dd>
        </dl>
      </div>
      <template #footer><el-button @click="invoiceNo = null">關閉</el-button></template>
    </el-dialog>
    <el-dialog v-model="msEditing" :title="o ? `${o.soNo} 請款條件` : ''" width="640px">
      <MilestoneEditor v-if="msEditing && o" v-model="msDraft" :total="o.amount" with-dates :pay-days="customers.find((c) => c.name === o!.customer)?.payDays" />
      <template #footer>
        <el-button @click="msEditing = false">取消</el-button>
        <el-button type="primary" :disabled="msProblems.length > 0" :title="msProblems.join('、')" @click="saveMs">確定</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="startDlg.open" width="380px" title="確認授權起算日" append-to-body>
      <p v-if="startDlg.lic" class="muted small">{{ startDlg.lic.name }} × {{ startDlg.lic.qty }}，{{ startDlg.lic.months }} 個月</p>
      <el-date-picker v-model="startDlg.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      <template #footer>
        <el-button @click="startDlg.open = false">取消</el-button>
        <el-button type="primary" :disabled="!startDlg.date" @click="confirmStart">確定</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<style scoped>
.drawer {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  width: 100%;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--line);
}

.head-main {
  min-width: 0;
}

.eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 6px;
}

.head h2 {
  font-size: 20px;
}

.head p {
  font-size: 13px;
}

.meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 13px;
  color: var(--muted);
}

.meta b {
  color: var(--ink);
  margin-left: 4px;
}

.head-actions {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  flex: none;
}

.tabs {
  flex: 1;
}

.tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 24px;
}

.section {
  padding: 20px 24px 32px;
  max-width: 1320px;
}

.sub {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.sub {
  margin: 22px 0 8px;
}

.sub-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sub-head .sub {
  margin-bottom: 0;
}

.sub-head + .ms,
.sub-head + table,
.sub-head + p {
  margin-top: 8px;
}

.sub-acts {
  display: flex;
  gap: 8px;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 56px;
  padding: 12px 24px;
  background: var(--paper);
  border-bottom: 1px solid var(--line);
}

.action-bar.done {
  background: var(--olive-soft, var(--paper));
}

.action-text {
  flex: 1;
  min-width: 0;
}

.mini-tracks {
  display: grid;
  gap: 8px;
  flex: none;
}

.mini {
  display: grid;
  grid-template-columns: 36px 84px 98px max-content;
  align-items: center;
  column-gap: 8px;
  min-height: 20px;
}

.mini-domain {
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.mini-name {
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  color: var(--teal-ink, var(--teal));
  font-size: 13px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
}

.mini--initial .mini-name {
  color: var(--muted);
}

.mini--waiting .mini-name {
  color: var(--amber);
}

.mini--waiting .stage-state-dot,
.mini--exception .stage-state-dot {
  display: inline-block;
  background: var(--amber);
}

.mini--complete .mini-name,
.mini--closed .mini-name {
  color: var(--olive);
}

.mini--complete .stage-state-dot,
.mini--closed .stage-state-dot {
  display: inline-block;
  background: var(--olive);
}

.mini-terminal {
  color: var(--olive);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.mini-terminal.amber {
  color: var(--amber);
}

.action-next {
  font-size: 15px;
  font-weight: 600;
}

.done-mark {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--olive, var(--teal));
  color: #fff;
  font-weight: 700;
}


.inner {
  background: var(--surface);
}

.ms th,
.ms td {
  font-size: 13px;
  white-space: nowrap;
  padding-left: 8px;
  padding-right: 8px;
}

.ms td:nth-child(2) {
  white-space: normal;
}

.ms tr.next td {
  background: var(--teal-soft);
}

.ms .idx {
  display: inline-block;
  width: 22px;
  color: var(--muted);
}

.ms .acts {
  text-align: right;
}

.bars {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 6px;
}

.bar-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
}

.bar-track {
  height: 8px;
  border-radius: 4px;
  background: var(--slate-soft);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
}

.bar-fill.teal {
  background: var(--teal);
}

.bar-fill.olive {
  background: var(--olive, var(--teal));
}

.note {
  margin-top: 12px;
}

.nowrap {
  white-space: nowrap;
}

/* 簽收表與序號表共用欄寬，兩張表對齊 */
.four {
  table-layout: fixed;
}

.four .c2 {
  width: 22%;
}

.four .c3 {
  width: 16%;
}

.four .c4 {
  width: 26%;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}

.click-row {
  cursor: pointer;
}

.click-row:hover td {
  background: var(--surface-2);
}

.sign-cell .sign-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.sign-cell .file {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sign-cell .re-up {
  flex: none;
  padding: 0 4px;
}

.link {
  color: var(--teal-ink, var(--teal));
  text-decoration: underline dotted;
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
}

.invoice .inv-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.worse {
  color: var(--red);
  font-weight: 600;
}

.better {
  color: var(--olive, var(--teal));
  font-weight: 600;
}

.small {
  font-size: 12px;
}

/* 摘要列：執行檢查點＋財務三個金額 */
.summary {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
  padding: 12px 24px;
  background: var(--paper);
  border-bottom: 1px solid var(--line);
}

.summary.done {
  background: var(--olive-soft, var(--paper));
}

.sum-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sum-block.fin {
  flex: 1;
  min-width: 300px;
}

.sum-label {
  color: var(--muted);
  font-size: 12px;
}

.cps {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.cp {
  padding: 3px 9px;
  border-radius: var(--radius-s);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  font-size: 13px;
}

.cp.done {
  background: var(--teal-soft);
  border-color: var(--teal-soft);
  color: var(--teal-ink, var(--teal));
}

.cp.wait {
  background: var(--amber-soft);
  border: 1px dashed var(--amber);
  color: var(--amber);
}

.cp.gap {
  border-color: var(--amber);
  color: var(--amber);
}

.fin-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--slate-soft);
}

.fin-bar .paid {
  background: var(--olive, var(--teal));
}

.fin-bar .inv {
  background: var(--teal);
}

.fin-nums {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  font-size: 13px;
}

.fin-nums .un {
  color: var(--amber);
}

.late {
  color: var(--red);
  font-weight: 600;
}

.end-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

/* 訂單明細：左表右側欄 */
.lines-page {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.lines-main {
  flex: 999 1 640px;
  min-width: 0;
}

.lines-side {
  flex: 1 1 280px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 22px;
}

.side-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  padding: 12px 14px;
}

.side-card .sub {
  margin: 0 0 8px;
}

.side-card .sub-head .sub {
  margin: 0;
}

.next-text {
  margin: 8px 0 0;
  line-height: 1.6;
  white-space: pre-wrap;
}

.kv-rows {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 12px;
  margin: 0;
  font-size: 13px;
}

.kv-rows dt {
  color: var(--muted);
}

.kv-rows dd {
  margin: 0;
}

.lines {
  margin-top: 8px;
}

.lines .c-no {
  width: 56px;
}

.lines .c-qty {
  width: 64px;
}

.lines .c-amt {
  width: 120px;
}

.lines tr.int td {
  padding-top: 2px;
  padding-bottom: 6px;
  border-top: none;
}

.lines tfoot td {
  font-weight: 600;
  border-top: 2px solid var(--line-strong);
}

.eng-head {
  margin-bottom: 12px;
}

.eng-head .sub {
  margin-top: 0;
}

.file {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 1100px) {
  .bars {
    grid-template-columns: 1fr;
  }
}
</style>
