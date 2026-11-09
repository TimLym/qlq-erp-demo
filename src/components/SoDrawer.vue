<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orders, quotes, deals, shipments, execStages, financeStages, financeStageOf, isOrderClosed, milestoneProblems, type Order, type Quote, type Milestone, type Shipment, type License, expiryKinds } from '../mock/data'
import { useAppStore } from '../stores/app'
import { money, pct, dateTime } from '../utils/format'
import DealDrawer from './DealDrawer.vue'
import ShipmentCreateDialog from './ShipmentCreateDialog.vue'
import ShipmentDrawer from './ShipmentDrawer.vue'
import MilestoneEditor from './MilestoneEditor.vue'
import ShipmentDetailDrawer from './ShipmentDetailDrawer.vue'
import SignReceiptPreview from './SignReceiptPreview.vue'
import StageTrack from './StageTrack.vue'
import { execToneOf, finToneOf } from '../utils/stageTrack'

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
type Tab = 'finance' | 'delivery' | 'records'
/* 紀錄頁簽只有流程紀錄 */
const tab = ref<Tab>('finance')
const isFinance = computed(() => ['會計', '財務主管', '執行長'].includes(store.role))
/* 預設頁簽依情境：財務角色或已驗收看請款與財務；還在交付就看交付與授權 */
watch(() => props.orderId, () => {
  const x = orders.find((y) => y.id === props.orderId)
  tab.value = !x || isFinance.value || x.stageIndex >= 6 ? 'finance' : 'delivery'
})

const deal = computed(() => (o.value ? deals.find((d) => d.id === o.value!.dealId) : undefined))
const isRenewal = computed(() => !!deal.value?.renewalOfDealId)
const closed = computed(() => !!o.value && isOrderClosed(o.value))
const invoicedAmt = computed(() => o.value?.milestones.filter((m) => m.status === '已開票' || m.status === '已收款').reduce((s, m) => s + m.amount, 0) ?? 0)
const paidAmt = computed(() => o.value?.milestones.filter((m) => m.status === '已收款').reduce((s, m) => s + m.amount, 0) ?? 0)
const widthOf = (amt: number) => `${o.value && o.value.amount ? Math.min(100, Math.round((amt / o.value.amount) * 100)) : 0}%`
/* 行動列裡的精簡雙進度：抽屜可能從通知直接打開，使用者未必看過列表 */
const finIdx = computed(() => (o.value ? financeStageOf(o.value.milestones) : 0))
/* 結案時名稱保留最後走到的階段（驗收／已收款），右側另標「✓ 結案」，使用者仍看得到結案前走到哪 */
const execLabel = computed(() => (!o.value ? '' : execStages[o.value.stageIndex]!))
const finLabel = computed(() => (!o.value ? '' : o.value.milestones.some((m) => m.status === '已申請') ? '待會計開票' : financeStages[finIdx.value]!))
const execTone = computed(() => (o.value ? execToneOf(o.value) : 'normal'))
const finTone = computed(() => (o.value ? finToneOf(o.value) : 'normal'))
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
const kindLabel = (key: string) => expiryKinds.find((k) => k.key === key)?.label ?? key
function jumpLicense(l: License) {
  router.push({ path: '/inventory/licenses', query: { lic: l.id } })
  emit('close')
}
function openDeal(id: string) {
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
function previewInvoice(no: string) {
  invoiceNo.value = no
}
const mmdd = (d?: string) => (d ? d.slice(5).replace('-', '/') : '—')

/* 角色：負責業務、業務主管、執行長可做交付與請款的動作；會計、財務主管、執行長做開票與收款 */
const canOps = computed(() => !!o.value && (['業務主管', '執行長'].includes(store.role) || (store.role === '業務' && o.value.owner === store.currentUser.name)))
const msTag: Record<string, string> = { 待請款: 'slate', 已申請: 'amber', 已開票: 'teal', 已收款: 'olive' }

/* 合約變更：已核准版本要改，單一入口在這裡（接單到已入庫之間） */
const changeDeal = ref<string | null>(null)
const changeQuoteId = ref<string | undefined>()
/* 合約變更：接單到已入庫（還沒出貨）、沒有變更中的版本、未結案；負責業務、業務主管、執行長可做 */
const canChange = computed(() => !!o.value && o.value.stageIndex <= 3 && !o.value.changeQuoteId && !closed.value)
const changeHint = computed(() => (!o.value ? '' : o.value.stageIndex > 3 ? '已出貨，金額異動請走折讓或補單' : closed.value ? '已結案' : ''))
const orderStatus = computed(() => (!o.value ? '' : closed.value ? '結案' : o.value.changeQuoteId ? '合約變更中' : '執行中'))
const statusCls = computed(() => (closed.value ? 'olive' : o.value?.changeQuoteId ? 'amber' : 'teal'))
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
const canCreateShip = computed(() => ['採購', '執行長'].includes(store.role))
const canShip = computed(() => !!o.value && (o.value.stageIndex === 3 || o.value.stageIndex === 4) && !o.value.changeQuoteId)
const canSign = computed(() => !!o.value && (o.value.stageIndex === 4 || o.value.stageIndex === 5) && !o.value.changeQuoteId)
const shipHint = computed(() => (!o.value ? '' : o.value.changeQuoteId ? '合約變更期間暫停出貨' : o.value.stageIndex < 3 ? '貨入庫後才能出貨' : o.value.stageIndex >= 5 ? '已全部出貨' : ''))
const signHint = computed(() => (!o.value ? '' : o.value.changeQuoteId ? '合約變更期間暫停驗收' : o.value.stageIndex < 4 ? '先建立出貨單' : o.value.stageIndex >= 6 ? '已驗收' : ''))
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

/* 請款：業務申請 → 會計開票（填發票號碼）→ 收款入帳（示範，正式版由三期沖帳） */
function requestBilling(i: number) {
  if (!o.value) return
  store.requestBilling(o.value, i)
  ElMessage.success(`第 ${i + 1} 期已申請請款，會計收到開立發票代辦`)
}
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
const canEditMs = computed(() => !!o.value && !closed.value && (['業務主管', '財務主管', '會計', '執行長'].includes(store.role) || (store.role === '業務' && o.value.owner === store.currentUser.name)))
function editMs() {
  if (!o.value) return
  msDraft.value = o.value.milestones.map((m) => ({ ...m }))
  msEditing.value = true
}
const msProblems = computed(() => (msEditing.value && o.value ? milestoneProblems(msDraft.value, o.value.amount) : []))
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
            <span class="muted">商機 <a class="link" @click="openDeal(o.dealId)">{{ o.dealNo }}</a></span>
          </div>
          <h2>{{ o.customer }}</h2>
          <p class="muted">{{ o.product }}</p>
          <div class="meta">
            <span>業務 <b>{{ o.owner }}</b></span>
            <span>訂單金額 <b class="num">{{ money(o.amount) }}</b></span>
            <span>業務毛利率 <b>{{ pct((o.amount - o.cost) / o.amount) }}</b></span>
          </div>
        </div>
        <div class="head-actions">
          <template v-if="canOps">
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

      <!-- 行動列：所有頁簽都看得到；階段本身在列表的階段欄，這裡只說下一步 -->
      <div class="action-bar" :class="{ done: closed }">
        <div class="mini-tracks" aria-label="訂單階段摘要">
          <div class="mini" :class="`mini--${execTone}`">
            <span class="mini-domain">執行</span>
            <span class="mini-name"><i class="stage-state-dot"></i>{{ execLabel }}</span>
            <StageTrack :total="execStages.length" :current="o.stageIndex" :tone="execTone" size="drawer" />
            <span v-if="closed" class="mini-terminal">✓ 結案</span>
            <span v-else-if="o.changeQuoteId" class="mini-terminal amber">合約變更中</span>
          </div>
          <div class="mini" :class="`mini--${finTone}`">
            <span class="mini-domain">財務</span>
            <span class="mini-name"><i class="stage-state-dot"></i>{{ finLabel }}</span>
            <StageTrack :total="financeStages.length" :current="finIdx" :tone="finTone" size="drawer" />
          </div>
        </div>
      </div>


      <el-tabs v-model="tab" class="tabs">
        <el-tab-pane label="請款與財務" name="finance">
          <div class="section">
            <div class="bars">
              <div class="bar">
                <div class="bar-head"><span>已開票</span><b class="num">{{ money(invoicedAmt) }} / {{ money(o.amount) }}</b></div>
                <div class="bar-track"><div class="bar-fill teal" :style="{ width: widthOf(invoicedAmt) }"></div></div>
              </div>
              <div class="bar">
                <div class="bar-head"><span>已收款</span><b class="num">{{ money(paidAmt) }} / {{ money(o.amount) }}</b></div>
                <div class="bar-track"><div class="bar-fill olive" :style="{ width: widthOf(paidAmt) }"></div></div>
              </div>
            </div>

            <div class="sub-head">
              <h3 class="sub">請款里程碑</h3>
              <el-button v-if="canEditMs" size="small" @click="editMs">編輯請款條件</el-button>
            </div>
            <table v-if="rows.length" class="plain-table inner ms">
              <thead><tr><th>期次 / 名稱</th><th class="num">金額</th><th>狀態</th><th>申請日</th><th>發票 / 收款</th><th></th></tr></thead>
              <tbody>
                <tr v-for="r in rows" :key="r.i" :class="{ next: r.i === nextIdx && !closed }">
                  <td><span class="idx">{{ r.i + 1 }}</span>{{ r.m.label }}</td>
                  <td class="num">{{ money(r.m.amount) }}</td>
                  <td><span class="tag" :class="msTag[r.m.status]">{{ r.m.status }}</span></td>
                  <td class="id" :title="r.m.requestedAt">{{ mmdd(r.m.requestedAt) }}</td>
                  <td class="id">
                    <template v-if="r.m.invoiceNo"><div :title="r.m.invoicedAt">{{ r.m.invoiceNo }} · {{ mmdd(r.m.invoicedAt) }}</div><div class="muted small" :title="r.m.paidAt">{{ r.m.paidAt ? `收款 ${mmdd(r.m.paidAt)}` : '未收款' }}</div></template>
                    <template v-else>—</template>
                  </td>
                  <td class="acts">
                    <el-button v-if="r.m.status === '待請款' && canOps && o.stageIndex >= 6" size="small" type="primary" @click="requestBilling(r.i)">申請請款</el-button>
                    <span v-else-if="r.m.status === '待請款'" class="muted small">驗收後申請</span>
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

        <el-tab-pane label="交付與授權" name="delivery">
          <div class="section">
            <div class="sub-head">
              <h3 class="sub">簽收</h3>
              <div class="sub-acts">
                <el-button v-if="canCreateShip" size="small" :disabled="!canShip" :title="shipHint" @click="creatingShipment = o">{{ o.stageIndex === 4 ? '出貨剩餘項次' : '建立出貨單' }}</el-button>
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
                <tr v-for="l in o.licenses" :key="l.id" class="click-row" @click="jumpLicense(l)">
                  <td><span class="tag teal">{{ kindLabel(l.kind) }}</span></td>
                  <td>{{ l.name }}<div v-if="l.sku" class="muted small">{{ l.sku }}</div></td>
                  <td class="num">{{ l.qty }}</td>
                  <td class="id">{{ l.expires }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted small">尚無到期項目。</p>
          </div>
        </el-tab-pane>

        <el-tab-pane label="紀錄" name="records">
          <div class="section">
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
          <dt>銷售額</dt><dd class="num">{{ money(Math.round((invoiceMs?.amount ?? 0) / 1.05)) }}</dd>
          <dt>營業稅</dt><dd class="num">{{ money((invoiceMs?.amount ?? 0) - Math.round((invoiceMs?.amount ?? 0) / 1.05)) }}</dd>
          <dt>總計</dt><dd class="num"><b>{{ money(invoiceMs?.amount ?? 0) }}</b></dd>
        </dl>
      </div>
      <template #footer><el-button @click="invoiceNo = null">關閉</el-button></template>
    </el-dialog>
    <el-dialog v-model="msEditing" :title="o ? `${o.soNo} 請款條件` : ''" width="640px">
      <MilestoneEditor v-if="msEditing && o" v-model="msDraft" :total="o.amount" />
      <template #footer>
        <el-button @click="msEditing = false">取消</el-button>
        <el-button type="primary" :disabled="msProblems.length > 0" :title="msProblems.join('、')" @click="saveMs">確定</el-button>
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

@media (max-width: 1100px) {
  .bars {
    grid-template-columns: 1fr;
  }
}
</style>
