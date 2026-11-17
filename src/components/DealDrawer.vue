<script setup lang="ts">
import NextHistory from './NextHistory.vue'
import { computed, nextTick, reactive, ref, toRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Paperclip, Upload, Plus, Close } from '@element-plus/icons-vue'
import UploadDialog from './UploadDialog.vue'
import QuoteWorkbench from './QuoteWorkbench.vue'
import MembersDialog from './MembersDialog.vue'
import EngSupportCard from './EngSupportCard.vue'
import CaseComments from './CaseComments.vue'
import SubmitChecklistCard from './SubmitChecklistCard.vue'
import MilestoneSummaryCard from './MilestoneSummaryCard.vue'
import MilestoneDialog from './MilestoneDialog.vue'
import MarginGauge from './MarginGauge.vue'
import { useQuoteSubmit } from '../composables/useQuoteSubmit'
import { deals, quotes, orders, isOrderClosed, isGuarantee, guaranteeReasons, quoteTotal, pipelineStages, stageDefaultProb, isIdle, stageIdleDays, type Deal, type Milestone, type PipelineStage, type GuaranteeReason } from '../mock/data'
import { useAppStore } from '../stores/app'
import { evaluate, routing } from '../mock/routing'
import { money, pct, dateTime } from '../utils/format'
import { supplyProgress, pctText } from '../utils/execProgress'

const props = defineProps<{ dealId: string | null; initialTab?: 'basic' | 'quotes' | 'comments' | 'files'; initialQuoteId?: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'open', id: string): void }>()
const router = useRouter()
const store = useAppStore()

const open = computed({
  get: () => !!props.dealId,
  set: (v) => {
    if (!v) emit('close')
  },
})

const deal = computed(() => deals.find((d) => d.id === props.dealId))
const dealQuotes = computed(() => quotes.filter((q) => q.dealId === props.dealId))
const activeTab = ref<'basic' | 'quotes' | 'comments' | 'files'>('basic')
watch(
  () => props.dealId,
  (id) => {
    if (!id) return
    activeTab.value = props.initialTab ?? 'basic'
  },
  { immediate: true },
)

/* 留言在 store（pinia 已解包成陣列），這裡包一層 computed 讓既有的 .value 寫法不用動 */
const localComments = computed(() => store.comments)
const dealComments = computed(() =>
  localComments.value.filter((c) => c.dealId === props.dealId).sort((a, b) => a.at.localeCompare(b.at)),
)

/* 協作成員：負責業務、主管以外被拉進來的人；工程師由派工加入 */
const canSeeMoney = computed(() => !!deal.value && store.canSeeMoney(deal.value))
const frozen = computed(() => deal.value?.stage === 'SO已成立')
/* 頁面權限：Pipeline 只有「檢視」時，抽屜裡的編輯、報價、轉單、成員管理都不開 */
const canOperatePage = computed(() => store.can('/sales/pipeline', 'edit'))
const canOrdersPage = computed(() => store.can('/sales/orders', 'link'))
const canManageMembers = computed(() => !!deal.value && !frozen.value && canOperatePage.value && store.canManageMembers(deal.value))
const members = computed(() => (deal.value ? store.membersOf(deal.value.id) : []))
const collaborators = computed(() => members.value.filter((m) => m.kind === '協作成員'))
const memberUser = (id: string) => store.users.find((u) => u.id === id)
const membersOpen = ref(false)
const hasActiveTicket = (m: { engRequestIds?: string[] }) => (deal.value?.engRequests ?? []).some((t) => (t.status === '已派工' || t.status === '待接受') && m.engRequestIds?.includes(t.id))
const canRemove = (m: { kind: string; engRequestIds?: string[] }) => (m.kind === '工程師' ? store.role === '工程主管' && !hasActiveTicket(m) : canManageMembers.value)
async function removeMember(userId: string) {
  const d = deal.value
  if (!d) return
  const u = memberUser(userId)
  const ok = await ElMessageBox.confirm(`把 ${u?.name ?? userId} 移出商機？他在這個商機的回覆與工程代辦會一併取消。`, '移出商機', { confirmButtonText: '移出', cancelButtonText: '取消', type: 'warning' }).then(() => true, () => false)
  if (!ok) return
  store.removeMember(d, userId)
}
/** 工程師在成員區標示負責哪幾張服務單 */

/* 其他附件：合約書、會議紀錄這類；報價單、回簽、廠商報價單都在報價單版本頁簽 */
const uploading = ref(false)
const dealFiles = computed(() =>
  deal.value ? store.attachments.filter((a) => a.refNo.startsWith(deal.value!.dealNo) && a.type === '其他' && !a.voided).sort((a, b) => b.at.localeCompare(a.at)) : [],
)
const extOf = (f: string) => (f.includes('.') ? f.slice(f.lastIndexOf('.') + 1).toUpperCase() : '—')
/* 基本資料編輯：負責業務或主管可改；SO已成立後鎖定 */
const editing = ref(false)
const edit = ref({ stage: '規劃預算' as PipelineStage, prob: 0, amount: 0, expectClose: '', nextAction: '', poc: '', lostReason: '', via: '直接交易' as Deal['via'], endUser: '', kind: '新購' as Deal['kind'], renewalOf: '', renewalReason: '到期續簽' as NonNullable<Deal['renewalReason']>, renewalItems: [] as string[], preOrder: false, prepay: false })
const locked = computed(() => deal.value?.stage === 'SO已成立')
const canEdit = computed(() => !!deal.value && canOperatePage.value && !locked.value && (deal.value.ownerId === store.currentUserId || ['業務主管', '執行長'].includes(store.role)))
const amountFollowsQuote = computed(() => !!deal.value && deal.value.quoteVersions > 0)
const stageOptions = computed(() => pipelineStages.filter((st) => st !== 'SO已成立'))
function startEdit() {
  const d = deal.value
  if (!d) return
  edit.value = { stage: d.stage, prob: Math.round(d.prob * 100), amount: d.amount, expectClose: d.expectClose, nextAction: d.nextAction, poc: d.poc ?? '', lostReason: d.lostReason ?? '', via: d.via, endUser: d.endUser ?? '', kind: d.kind, renewalOf: d.renewalOfDealId ?? '', renewalReason: d.renewalReason ?? '到期續簽', renewalItems: [...(d.renewalItems ?? [])], preOrder: d.preOrder, prepay: d.prepay }
  editing.value = true
}
function onStageChange(st: PipelineStage) {
  edit.value.prob = Math.round(stageDefaultProb[st] * 100)
}
function saveEdit() {
  const d = deal.value
  if (!d) return
  /* SO 成立後只收下一步，其他欄位唯讀 */
  if (locked.value) {
    if (store.setNextAction(d, edit.value.nextAction)) ElMessage.success('下一步已更新')
    editing.value = false
    return
  }
  if (edit.value.stage === '未成交' && !edit.value.lostReason.trim()) {
    ElMessage.warning('改成未成交要填原因')
    return
  }
  if (edit.value.stage === 'POC中' && !edit.value.poc.trim()) {
    ElMessage.warning('階段為 POC 中時要填 POC 狀態')
    return
  }
  if (edit.value.via === '中間商' && !edit.value.endUser.trim()) {
    ElMessage.warning('經中間商的案要填終端使用者')
    return
  }
  const changes: string[] = []
  if (d.stage !== edit.value.stage) changes.push(`階段 ${d.stage}→${edit.value.stage}`)
  if (Math.round(d.prob * 100) !== edit.value.prob) changes.push(`機率 ${Math.round(d.prob * 100)}%→${edit.value.prob}%`)
  if (d.amount !== edit.value.amount) changes.push(`金額 ${money(d.amount)}→${money(edit.value.amount)}`)
  if (d.expectClose !== edit.value.expectClose) changes.push(`預計成交 ${d.expectClose}→${edit.value.expectClose}`)
  if (d.nextAction !== edit.value.nextAction) changes.push('下一步')
  if ((d.poc ?? '') !== edit.value.poc) changes.push('POC 狀態')
  if (d.via !== edit.value.via) changes.push(`交易方式 ${d.via}→${edit.value.via}`)
  if ((d.endUser ?? '') !== (edit.value.via === '中間商' ? edit.value.endUser.trim() : '')) changes.push('終端使用者')
  if (d.kind !== edit.value.kind) changes.push(`類型 ${d.kind}→${edit.value.kind}`)
  if ((d.renewalOfDealId ?? '') !== edit.value.renewalOf) changes.push(`續約自 ${deals.find((x) => x.id === d.renewalOfDealId)?.dealNo ?? '無'}→${deals.find((x) => x.id === edit.value.renewalOf)?.dealNo ?? '無'}`)
  const attrNames = { preOrder: '預下單', prepay: '預付' } as const
  for (const k of Object.keys(attrNames) as (keyof typeof attrNames)[]) {
    if (d[k] !== edit.value[k]) changes.push(`${edit.value[k] ? '勾選' : '取消'}${attrNames[k]}`)
  }
  const prepayTurnedOn = !d.prepay && edit.value.prepay
  const lostNow = d.stage !== '未成交' && edit.value.stage === '未成交'
  const now = new Date().toISOString()
  if (d.stage !== edit.value.stage) d.stageAt = now
  if (d.nextAction !== edit.value.nextAction.trim()) d.nextHistory = [...(d.nextHistory ?? []), { at: now, by: store.currentUser.name, text: edit.value.nextAction.trim() }]
  const preOrderTurnedOn = !d.preOrder && edit.value.preOrder
  Object.assign(d, {
    stage: edit.value.stage,
    prob: edit.value.prob / 100,
    amount: edit.value.amount,
    expectClose: edit.value.expectClose,
    nextAction: edit.value.nextAction.trim(),
    poc: edit.value.poc.trim() || undefined,
    lostReason: edit.value.stage === '未成交' ? edit.value.lostReason.trim() : undefined,
    via: edit.value.via,
    endUser: edit.value.via === '中間商' ? edit.value.endUser.trim() : undefined,
    kind: edit.value.kind,
    renewalOfDealId: edit.value.renewalOf || undefined,
    renewalReason: edit.value.renewalOf ? edit.value.renewalReason : undefined,
    renewalItems: edit.value.renewalOf && edit.value.renewalItems.length ? [...edit.value.renewalItems] : undefined,
    preOrder: edit.value.preOrder,
    prepay: edit.value.prepay,
    updatedAt: new Date().toISOString(),
  })
  if (lostNow) {
    /* 未成交：還在簽的單（上單、預付）自動收回，掛在這個商機下還沒處理的代辦一律結案；已退回的簽核單維持原狀留作紀錄 */
    const pending = store.approvals.filter((a) => a.dealId === d.id && a.status === '待簽核')
    pending.forEach((a) => {
      a.status = '已收回'
      a.history.push({ role: store.currentUser.role, name: store.currentUser.name, action: '收回', at: d.updatedAt, note: '商機未成交，簽核單自動收回' })
    })
    const stale = store.todos.filter((t) => t.refNo === d.dealNo || t.dealId === d.id)
    if (stale.length) store.todos = store.todos.filter((t) => !stale.includes(t))
    if (pending.length) changes.push(`收回 ${pending.length} 張簽核單`)
    if (stale.length) changes.push(`結案 ${stale.length} 件代辦`)
  }
  if (prepayTurnedOn) ElMessage.info('已標記預付：上單後會產生預付款簽核單')
  if (preOrderTurnedOn) {
    const hasQuote = quotes.some((q) => q.dealId === d.id && q.status !== '草稿')
    store.requestPreOrder(d)
    ElMessage.info(hasQuote ? '已標記預下單：採購收到建立 PO 代辦，PO 會多一關業務主管核准' : '已標記預下單：採購已收到代辦，但要先有一版客戶回簽的報價單才能建 PO')
  }
  if (changes.length) {
    localComments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: store.currentUser.name, role: store.currentUser.role, at: d.updatedAt, text: `修改基本資料：${changes.join('、')}` })
  }
  editing.value = false
  ElMessage.success(changes.length ? `已儲存並記錄異動：${changes.join('、')}` : '沒有變更')
}

/* 閒置釋放：主管手動，設未成交；同承辦人的防撞佔位跟著解除 */
async function release() {
  const d = deal.value
  if (!d) return
  const { value } = await ElMessageBox.prompt(`${d.customer} ${d.customerDept} 階段「${d.stage}」已 ${stageIdleDays(d)} 天沒變。釋放後設為未成交。`, '釋放閒置商機', { inputPlaceholder: '備註（選填）', confirmButtonText: '釋放', cancelButtonText: '取消' }).then((r) => ({ value: r.value ?? '' }), () => ({ value: null as string | null }))
  if (value === null) return
  if (store.releaseIdle(d, value.trim())) ElMessage.success(`${d.dealNo} 已釋放`)
}

/* 續約：原商機與它的 SO；反向列出以這筆為原案的續約商機 */
const renewalOf = computed(() => (deal.value?.renewalOfDealId ? deals.find((x) => x.id === deal.value!.renewalOfDealId) : undefined))
const renewalOfOrder = computed(() => (renewalOf.value ? orders.find((o) => o.dealId === renewalOf.value!.id) : undefined))
const renewals = computed(() => (deal.value ? deals.filter((x) => x.renewalOfDealId === deal.value!.id) : []))
const renewalOptions = computed(() => (deal.value ? store.renewalCandidates(deal.value.customer, deal.value.id) : []))
const renewalLicenses = computed(() => (edit.value.renewalOf ? orders.find((o) => o.dealId === edit.value.renewalOf)?.licenses.filter((l) => l.expires && l.expires !== '—') ?? [] : []))
const renewalItemLabels = computed(() => (renewalOf.value && deal.value?.renewalItems?.length ? (orders.find((o) => o.dealId === renewalOf.value!.id)?.licenses ?? []).filter((l) => deal.value!.renewalItems!.includes(l.id)).map((l) => `${l.sku} × ${l.qty}（${l.expires} 到期）`) : []))
watch(() => edit.value.renewalOf, (id, prev) => { if (editing.value && id !== prev) edit.value.renewalItems = renewalLicenses.value.map((l) => l.id) })

/* SO 成立後商務欄位鎖定，但協作的事繼續在商機抽屜：下一步、工程支援、留言、成員 */
const canCollab = computed(() => !!deal.value && canOperatePage.value && deal.value.stage !== '未成交' && (deal.value.ownerId === store.currentUserId || ['業務主管', '執行長'].includes(store.role)))

/* 報價單版本工作區在 QuoteWorkbench；這裡只接送審、簽核單與系統留言 */
const dealOrder = computed(() => (deal.value ? orders.find((o) => o.dealId === deal.value!.id && !o.voidedAt) : undefined))
/* 保證單：客戶已回簽 v、還沒送審、還沒有 SO 或保證單時，可以先轉保證單（不計業績、可派工） */
const signedQuote = computed(() => [...dealQuotes.value].filter((q) => q.status === '報價回簽').sort((a, b) => b.version - a.version)[0])
const canGuarantee = computed(() => !!signedQuote.value && !signedQuote.value.submittedAt && !dealOrder.value && canEditQuote.value && !store.approvals.some((a) => a.dealId === deal.value?.id && a.type === '上單' && a.status === '待簽核'))
const gOpen = ref(false)
const gForm = ref<{ reason: GuaranteeReason; note: string }>({ reason: '議價中', note: '' })
function startGuarantee() {
  gForm.value = { reason: deal.value?.preOrder ? '預下單' : '議價中', note: '' }
  gOpen.value = true
}
function submitGuarantee() {
  const d = deal.value
  if (!d) return
  const g = store.createGuarantee(d, gForm.value.reason, gForm.value.note)
  gOpen.value = false
  if (g) ElMessage.success(`已轉保證單 ${g.soNo}，不計業績；議價完成後照常上單送審`)
}
const canEditQuote = computed(
  () => !!deal.value && canOperatePage.value && deal.value.stage !== 'SO已成立' && deal.value.stage !== '未成交' && (deal.value.ownerId === store.currentUserId || ['業務主管', '執行長'].includes(store.role)),
)
function onSubmitted() {
  emit('close')
  router.push('/approvals/mine')
}

/*
 * 上單條件、請款條件、毛利率：和報價單版本頁簽共用同一套計算（useQuoteSubmit）。
 * 這裡固定看最新版本（合約變更時就是變更版），不跟著報價單頁簽切到的歷史版本走。
 */
const qs = reactive(useQuoteSubmit(toRef(props, 'dealId'), ref('')))
const msOpen = ref(false)
function saveMilestones(v: Milestone[]) {
  qs.milestones = v
  ElMessage.success('請款條件已更新')
}
function submitFromCard() {
  const msg = qs.submit()
  if (!msg) return
  ElMessage.success(msg)
  onSubmitted()
}
function openOrder(soNo: string) {
  if (!canOrdersPage.value) return
  emit('close')
  router.push({ path: '/sales/orders', query: { so: soNo } })
}
/* 上單條件卡點未完成項目：跳到該欄位所在的頁面，點亮 2.5 秒 */
const flash = ref<'vendorFiles' | 'signback' | 'milestones' | 'stage' | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined
function openItem(key: 'vendorFiles' | 'signback' | 'milestones' | 'stage') {
  if (key === 'vendorFiles' || key === 'signback') activeTab.value = 'quotes'
  else if (key === 'stage') startEdit()
  flash.value = key
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = null), 2500)
  nextTick(() => setTimeout(() => document.querySelector('.flash')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80))
}
const milestoneNote = computed(() => (qs.isRetry && qs.order ? `合約變更沿用 ${qs.order.soNo} 的請款條件` : qs.q?.submittedAt ? `已隨 v${qs.q.version} 送審鎖定` : ''))
function openApproval(id: string) {
  emit('close')
  router.push({ path: '/approvals', query: { open: id } })
}
function systemComment(text: string) {
  const d = deal.value
  if (!d) return
  localComments.value.push({ id: `c-${Date.now()}`, dealId: d.id, author: store.currentUser.name, role: store.currentUser.role, at: new Date().toISOString(), text })
}

/* 預付款申請：商機勾了預付，業務提出金額與理由，路由依簽核路由設定 */
const prepayOpen = ref(false)
const prepayForm = ref({ amount: 0, reason: '' })
const latestTotal = computed(() => {
  const latest = [...dealQuotes.value].sort((a, b) => b.version - a.version)[0]
  return latest ? quoteTotal(latest) : deal.value?.amount ?? 0
})
const prepayEval = computed(() => evaluate('預付', { applicantId: store.currentUserId, facts: { amount: prepayForm.value.amount, ratio: latestTotal.value ? (prepayForm.value.amount / latestTotal.value) * 100 : 0 } }))
const prepayRoute = computed(() => prepayEval.value.route)
function startPrepay() {
  prepayForm.value = { amount: Math.round(latestTotal.value * 0.3), reason: '原廠要求預付 30% 鎖貨' }
  prepayOpen.value = true
}
function submitPrepay() {
  const d = deal.value
  if (!d || prepayForm.value.amount <= 0 || !prepayForm.value.reason.trim()) {
    ElMessage.warning('金額與理由必填')
    return
  }
  const now = new Date()
  const approvalId = `a-${now.getTime()}-pp`
  d.prepayApprovalId = approvalId
  store.approvals.unshift({ id: approvalId, type: '預付', title: `預付款：${d.customer} ${d.product}`, refNo: d.dealNo, dealId: d.id, submitterId: store.currentUserId, submitter: store.currentUser.name, submittedAt: now.toISOString(), amount: prepayForm.value.amount, route: prepayRoute.value, steps: prepayEval.value.steps, currentStep: 0, status: '待簽核', reason: prepayForm.value.reason.trim(), history: [{ role: store.role, name: store.currentUser.name, action: '送出', at: now.toISOString() }] })
  store.todos.unshift({ id: `t-${now.getTime()}-pp`, kind: '簽核', title: `預付款：${d.customer} ${d.product}`, refNo: d.dealNo, forRoles: [prepayRoute.value[0]!], forUserIds: prepayEval.value.steps[0]?.candidateIds, approvalId, createdAt: now.toISOString() })
  prepayOpen.value = false
  ElMessage.success(`預付款申請已送出：${prepayRoute.value.join(' → ')}`)
}

const stageTag: Record<string, string> = {
  規劃預算: 'slate',
  報價階段: 'teal',
  簡報: 'teal',
  POC中: 'teal',
  Pending: 'slate',
  專案規劃: 'teal',
  前置文件: 'teal',
  議價: 'amber',
  待接單: 'amber',
  SO已成立: 'olive',
  未成交: 'red',
}
</script>

<template>
  <el-drawer v-model="open" direction="btt" size="100%" :with-header="false" destroy-on-close class="deal-drawer" modal-class="deal-drawer-mask">
    <div v-if="deal" class="drawer">
      <header class="head">
        <div>
          <div class="eyebrow">
            <span class="num">{{ deal.dealNo }}</span>
            <span class="tag" :class="stageTag[deal.stage]">{{ deal.stage }}</span>
            <button v-if="dealOrder && isGuarantee(dealOrder) && canOrdersPage" type="button" class="tag amber link" :title="`開啟保證單 ${dealOrder.soNo}`" @click="openOrder(dealOrder.soNo)">保證單 {{ dealOrder.soNo }} · {{ dealOrder.guaranteeReason }}</button>
            <span v-else-if="dealOrder" class="tag slate" :title="dealOrder.soNo">{{ dealOrder.soNo }} · {{ isOrderClosed(dealOrder) ? '結案' : dealOrder.acceptedAt ? '已驗收' : `到客戶 ${pctText(supplyProgress(dealOrder).delivered)}` }}</span>
            <span v-if="deal.kind !== '新購'" class="tag slate">{{ deal.kind }}</span>
            <button v-if="renewalOf" type="button" class="tag teal link" :title="`開啟原商機 ${renewalOf.dealNo}`" @click="emit('open', renewalOf.id)">續約自 {{ renewalOf.dealNo }}<template v-if="renewalOfOrder"> · {{ renewalOfOrder.soNo }}</template></button>
            <button v-for="r in renewals" :key="r.id" type="button" class="tag teal link" :title="`開啟續約商機 ${r.dealNo}`" @click="emit('open', r.id)">續約商機 {{ r.dealNo }} · {{ r.stage }}</button>
            <span v-if="deal.via === '中間商'" class="tag slate">經中間商</span>
            <span v-if="isIdle(deal)" class="tag red">閒置 {{ stageIdleDays(deal) }} 天</span>
            <span v-if="deal.collision" class="tag amber" :title="`與 ${deals.find((x) => x.id === deal!.collision!.withDealId)?.dealNo ?? ''} 同承辦人`">撞單 {{ deals.find((x) => x.id === deal!.collision!.withDealId)?.dealNo }}</span>
          </div>
          <h2>{{ deal.customer }}<span class="dept">{{ deal.customerDept }}</span></h2>
          <p class="muted">{{ deal.product }}</p>
        </div>
        <div class="head-actions">
          <el-button v-if="store.canReleaseIdle(deal)" type="danger" plain @click="release">釋放</el-button>
          <el-button v-if="canSeeMoney && deal.prepay && !deal.prepayApprovalId && deal.stage !== '未成交' && canEditQuote" @click="startPrepay">申請預付款</el-button>
          <span v-else-if="deal.prepayApprovalId" class="tag amber">預付款簽核中</span>
          <el-button v-if="canGuarantee" @click="startGuarantee">轉保證單</el-button>
          <el-button @click="emit('close')">關閉</el-button>
        </div>
      </header>

      <div v-if="frozen && dealOrder" class="frozen-bar">
        <span>已轉 <b class="num">{{ dealOrder.soNo }}</b></span>
        <el-button v-if="canOrdersPage" size="small" type="primary" @click="openOrder(dealOrder.soNo)">前往 SO</el-button>
      </div>

      <el-tabs v-model="activeTab" class="tabs">
        <el-tab-pane label="基本資料" name="basic">
          <div class="section basic-page" :class="{ public: !canSeeMoney }">
            <!-- 同一個兩欄 grid：基本資料｜上單條件 → 請款條件｜毛利率 → 協作成員｜工程支援，欄寬一致、每列等高 -->
              <section class="card basic-card">
                <div class="card-head">
                  <h4>基本資料</h4>
                  <div class="head-right">
                    <span class="muted small">最後更新 {{ dateTime(deal.updatedAt) }}</span>
                    <el-button v-if="(canEdit || (locked && canCollab)) && canSeeMoney" size="small" @click="startEdit">編輯</el-button>
                  </div>
                </div>
                <div class="card-body">
        <!-- 檢視與編輯表單同一個順序：階段、機率、金額、預計成交 → POC、下一步 → 類型與續約 → 交易方式 → 案件屬性 → 未成交原因 → 負責業務、最後更新 -->
        <dl class="kv two">
          <dt>階段</dt><dd>{{ deal.stage }}</dd>
          <template v-if="canSeeMoney">
            <dt>成交機率</dt><dd class="num">{{ pct(deal.prob, 0) }}</dd>
            <dt>預估金額</dt><dd class="num">{{ money(deal.amount) }}</dd>
          </template>
          <dt>預計成交</dt><dd class="num">{{ deal.expectClose }}</dd>
          <dt>POC 狀態</dt><dd>{{ deal.poc || '無' }}</dd>
          <dt>下一步</dt><dd>{{ deal.nextAction }}<NextHistory :deal="deal" /></dd>
          <dt>類型</dt><dd>{{ deal.kind }}<template v-if="renewalOf"> | 續約自 {{ renewalOf.dealNo }}<template v-if="renewalOfOrder">（{{ renewalOfOrder.soNo }}）</template></template></dd>
          <template v-if="renewalItemLabels.length"><dt>續約項目</dt><dd><div v-for="x in renewalItemLabels" :key="x" class="id">{{ x }}</div></dd></template>
          <dt>交易方式</dt><dd>{{ deal.via }}<template v-if="deal.endUser">，終端使用者 {{ deal.endUser }}</template></dd>
          <dt>案件屬性</dt>
          <dd class="attrs">
            <span :class="{ on: (deal.engRequests ?? []).some((t) => t.status !== '已取消') }">工程支援</span>
            <span :class="{ on: deal.preOrder }">預下單</span>
            <span :class="{ on: deal.prepay }">預付</span>
            <span v-if="deal.poc" class="on">POC</span>
          </dd>
          <template v-if="deal.lostReason"><dt>未成交原因</dt><dd>{{ deal.lostReason }}</dd></template>
          <dt>負責業務</dt><dd>{{ deal.owner }}（{{ deal.dept }}）</dd>
        </dl>
                </div>
              </section>
              <SubmitChecklistCard
                v-if="canSeeMoney"
                :state="qs.state"
                :quote-version="qs.quoteVersion"
                :items="qs.checklistItems"
                :blockers="qs.blockers"
                :reason="qs.reason"
                :approval="qs.quoteApproval"
                :order="qs.order"
                :can-submit="qs.canSubmit"
                :submit-label="qs.submitLabel"
                :can-act="canCollab"
                :return-note="qs.lastReturnNote"
                :lost-reason="deal.lostReason"
                @update:reason="(v: string) => (qs.reason = v)"
                @submit="submitFromCard"
                @open-quote="activeTab = 'quotes'"
                @open-approval="openApproval"
                @open-order="openOrder"
                @open-item="openItem"
              />

              <!-- 第二列：請款條件＋毛利率，只給看得到金額的人 -->
              <MilestoneSummaryCard v-if="canSeeMoney" :class="{ flash: flash === 'milestones' }" :milestones="qs.isRetry && qs.order ? qs.order.milestones : qs.milestones" :total="qs.isRetry && qs.order ? qs.order.amount : qs.revenue" :editable="qs.canEditMilestones && canCollab" :note="milestoneNote" @edit="msOpen = true" />
              <MarginGauge v-if="canSeeMoney" :revenue="qs.revenue" :cost="qs.cost" :threshold="routing.lowMarginThreshold" :missing="qs.missingCost" :route="qs.routePreview" />

              <!-- 第三列：協作成員／工程支援人員＋工程支援服務單，固定高內捲 -->
              <section class="block">
                <div class="block-head">
                  <h4>協作成員<span class="muted sub">{{ collaborators.length + 1 }} 人</span></h4>
                  <el-button v-if="canManageMembers" size="small" type="primary" :icon="Plus" @click="membersOpen = true">加入成員</el-button>
                </div>
                <div class="block-body">
                <ul class="member-list">
                  <li>
                    <span class="avatar owner">{{ deal.owner.slice(0, 1) }}</span>
                    <span class="who"><b>{{ deal.owner }}</b><span class="muted small">{{ deal.dept }} · 負責業務</span></span>
                  </li>
                  <li v-for="m in collaborators" :key="m.userId">
                    <span class="avatar">{{ memberUser(m.userId)?.name.slice(0, 1) }}</span>
                    <span class="who"><b>{{ memberUser(m.userId)?.name }}</b><span class="muted small">{{ memberUser(m.userId)?.dept }} · {{ memberUser(m.userId)?.role }} · {{ memberUser(m.addedById)?.name }}加入 {{ dateTime(m.addedAt) }}</span></span>
                    <el-button v-if="canRemove(m)" size="small" text :icon="Close" title="移出商機" class="rm" @click="removeMember(m.userId)" />
                  </li>
                </ul>
                </div>
              </section>
              <EngSupportCard :deal="deal" :can-edit="canCollab && canSeeMoney && !frozen" :readonly="frozen" />
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="canSeeMoney" :label="`報價單版本（${dealQuotes.length}）`" name="quotes">
          <div class="section">
            <QuoteWorkbench :deal-id="deal.id" :initial-quote-id="initialQuoteId" :highlight="flash === 'vendorFiles' || flash === 'signback' ? flash : null" @submitted="onSubmitted" @open-approval="openApproval" @comment="systemComment" />
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`留言（${dealComments.length}）`" name="comments">
          <div class="section">
            <CaseComments :deal="deal" :readonly="frozen" :can-manage-members="canManageMembers" :active="activeTab === 'comments'" @add-member="membersOpen = true" />
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`其他附件（${dealFiles.length}）`" name="files">
          <div class="section">
            <div class="files-head">
              <el-button v-if="!frozen" type="primary" :icon="Upload" @click="uploading = true">上傳附件</el-button>
            </div>
            <table class="plain-table">
              <thead><tr><th>檔案名稱</th><th>類型</th><th>上傳者</th><th>時間</th><th class="num">大小</th></tr></thead>
              <tbody>
                <tr v-for="f in dealFiles" :key="f.id">
                  <td><span class="file"><el-icon><Paperclip /></el-icon>{{ f.title ?? f.fileName }}</span><span v-if="f.title" class="muted small orig">{{ f.fileName }}</span></td>
                  <td><span class="tag slate">{{ extOf(f.fileName) }}</span></td>
                  <td>{{ f.uploader }}</td>
                  <td class="id">{{ dateTime(f.at) }}</td>
                  <td class="num">{{ f.sizeKb >= 1024 ? (f.sizeKb / 1024).toFixed(1) + ' MB' : f.sizeKb + ' KB' }}</td>
                </tr>
                <tr v-if="!dealFiles.length"><td colspan="5" class="muted">還沒有附件。</td></tr>
              </tbody>
            </table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    <MembersDialog v-model="membersOpen" :deal="deal ?? null" />
    <!-- 基本資料用彈窗編輯：背景版面不動，右邊的上單條件還看得到 -->
    <el-dialog v-if="deal" v-model="editing" title="編輯基本資料" width="900px" :close-on-click-modal="false" append-to-body class="deal-edit-dialog">
      <el-form label-position="top" class="edit-form">
        <div class="grid2">
          <el-form-item label="階段" required :class="{ flash: flash === 'stage' }">
            <el-select v-model="edit.stage" style="width: 100%" @change="onStageChange" :disabled="locked">
              <el-option v-for="st in stageOptions" :key="st" :value="st" :label="st" />
            </el-select>
          </el-form-item>
          <el-form-item label="成交機率（%）">
            <el-input-number v-model="edit.prob" :min="0" :max="100" :step="10" style="width: 100%" :disabled="locked" />
          </el-form-item>
          <el-form-item label="預估金額">
            <el-input-number v-model="edit.amount" :min="0" :step="10000" :disabled="amountFollowsQuote || locked" style="width: 100%" />
          </el-form-item>
          <el-form-item label="預計成交">
            <el-date-picker v-model="edit.expectClose" type="date" value-format="YYYY-MM-DD" style="width: 100%" :disabled="locked" />
          </el-form-item>
        </div>
        <el-form-item label="POC 狀態" :required="edit.stage === 'POC中'">
          <el-input v-model="edit.poc" placeholder="例：10/14 到校部署，11/1 結案；有填就算 POC 案" :disabled="locked" />
        </el-form-item>
        <el-form-item label="下一步">
          <el-input v-model="edit.nextAction" placeholder="週會視圖會直接顯示這一欄" />
        </el-form-item>
        <div class="grid2">
          <el-form-item label="類型">
            <el-radio-group v-model="edit.kind" :disabled="locked">
              <el-radio-button value="新購">新購</el-radio-button>
              <el-radio-button value="授權">授權</el-radio-button>
              <el-radio-button value="維護">維護</el-radio-button>
              <el-radio-button value="服務">服務</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="續約自">
            <el-select v-model="edit.renewalOf" clearable :disabled="locked" :placeholder="renewalOptions.length ? '這家客戶已成立 SO 的商機' : '這家客戶還沒有成立過 SO'" style="width: 100%">
              <el-option v-for="r in renewalOptions" :key="r.d.id" :value="r.d.id" :disabled="!!r.active && r.active.id !== deal.id" :label="`${r.d.dealNo} · ${r.d.product}（${r.so.soNo}）${r.active && r.active.id !== deal.id ? `｜已有續約商機 ${r.active.dealNo}` : ''}`" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="edit.renewalOf" label="續約原因">
            <el-radio-group v-model="edit.renewalReason" :disabled="locked">
              <el-radio-button value="到期續簽">到期續簽</el-radio-button>
              <el-radio-button value="擴充">擴充</el-radio-button>
              <el-radio-button value="升級">升級</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item v-if="edit.renewalOf" label="續約項目（原 SO 的授權）">
          <el-checkbox-group v-model="edit.renewalItems" class="serials" :disabled="locked">
            <el-checkbox v-for="l in renewalLicenses" :key="l.id" :value="l.id">{{ l.sku }} × {{ l.qty }}<span class="muted small"> · {{ l.expires }} 到期</span></el-checkbox>
          </el-checkbox-group>
          <div v-if="!renewalLicenses.length" class="muted small">原 SO 還沒有授權到期資料。</div>
        </el-form-item>
        <div class="grid2">
          <el-form-item label="交易方式">
            <el-radio-group v-model="edit.via" :disabled="locked">
              <el-radio-button value="直接交易">直接交易</el-radio-button>
              <el-radio-button value="中間商">中間商</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="edit.via === '中間商'" label="終端使用者" required>
            <el-input v-model="edit.endUser" placeholder="實際使用的客戶" :disabled="locked" />
          </el-form-item>
        </div>
        <el-form-item label="案件屬性">
          <div class="attr-row">
            <el-checkbox v-model="edit.preOrder" :disabled="locked">預下單（未回簽先向原廠下單，PO 需主管核准）</el-checkbox>
            <el-checkbox v-model="edit.prepay" :disabled="locked">預付（上單後產生預付款簽核單）</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item v-if="edit.stage === '未成交'" label="未成交原因" required>
          <el-input v-model="edit.lostReason" placeholder="例：客戶選擇他牌，價差 12%" :disabled="locked" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editing = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">儲存</el-button>
      </template>
    </el-dialog>
    <MilestoneDialog v-model="msOpen" :milestones="qs.milestones" :total="qs.revenue" :title="deal ? `${deal.dealNo} 請款條件` : ''" @save="saveMilestones" />
    <UploadDialog v-if="deal" v-model="uploading" :ref-no="deal.dealNo" :party="deal.customer" simple title="上傳其他附件" />

    <el-dialog v-model="gOpen" title="轉保證單" width="480px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="原因" required>
          <el-radio-group v-model="gForm.reason">
            <el-radio-button v-for="r in guaranteeReasons" :key="r" :value="r">{{ r }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="備註">
          <el-input v-model="gForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="gOpen = false">取消</el-button>
        <el-button type="primary" @click="submitGuarantee">轉保證單</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="prepayOpen" title="申請預付款" width="480px">
      <el-form label-position="top">
        <el-form-item label="預付金額" required><el-input-number v-model="prepayForm.amount" :min="0" :step="10000" style="width: 100%" /><span class="muted small">報價合計 {{ money(latestTotal) }}</span></el-form-item>
        <el-form-item label="理由" required><el-input v-model="prepayForm.reason" /></el-form-item>
      </el-form>
      <p class="muted small">路由：{{ prepayRoute.join(' → ') }}</p>
      <template #footer><el-button @click="prepayOpen = false">取消</el-button><el-button type="primary" @click="submitPrepay">送出</el-button></template>
    </el-dialog>

  </el-drawer>
</template>

<style scoped>
.serials {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag.link {
  border: none;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.tag.link:hover {
  text-decoration: underline;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--slate-soft);
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
  flex: none;
  border: none;
}

.avatar.owner {
  background: var(--teal);
  color: #fff;
}

.avatar.eng {
  background: var(--amber-soft);
  color: var(--amber);
}

/* 留言頁人員列 */
.people-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.people-bar .avatar {
  width: 30px;
  height: 30px;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.people-bar .avatar:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 0 0 2px var(--teal-soft);
}

.people-bar .avatar:disabled {
  cursor: default;
  opacity: 0.6;
}

.people-bar .avatar.add {
  background: var(--surface);
  border: 1px dashed var(--line-strong);
  color: var(--muted);
}

.people-bar .avatar.add:hover {
  border-color: var(--teal);
  color: var(--teal);
}


.member-note {
  margin: 6px 0 0;
}

/* 工程支援與協作成員兩個區塊固定高度，內容超出在區塊內捲動，基本資料頁簽維持一個畫面高 */
.block {
  display: flex;
  flex-direction: column;
  height: 300px;
  min-height: 0;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.block-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin-right: -6px;
  padding-right: 6px;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.block-head h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.block-head .sub {
  font-weight: 400;
  font-size: 12px;
}

.member-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.member-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid var(--line);
}

.member-list li:first-child {
  border-top: none;
}

.member-list .who {
  display: flex;
  flex-direction: column;
  flex: 1;
  line-height: 1.3;
  font-size: 13px;
}

.member-list .rm {
  color: var(--muted);
}

.comments li.me {
  background: var(--amber-soft);
  border-radius: 6px;
  padding: 6px 8px;
}

/* 基本資料頁簽：一個兩欄 grid，右欄固定 38%（最少 360px），三列欄寬一致、同列等高；1100px 以下單欄 */
.basic-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 38%);
  gap: 14px;
  align-items: stretch;
}

/* 看不到金額的人：基本資料整寬，底下協作成員與工程支援一樣左右並排 */
.basic-page.public .basic-card {
  grid-column: 1 / -1;
}

/* 點亮：從上單條件卡跳過來的欄位或區塊 */
:global(.flash) {
  animation: flash-ring 2.5s ease-out;
  border-radius: 8px;
}

@keyframes flash-ring {
  0% { box-shadow: 0 0 0 3px var(--amber); background-color: var(--amber-soft); }
  70% { box-shadow: 0 0 0 3px var(--amber); background-color: var(--amber-soft); }
  100% { box-shadow: 0 0 0 0 transparent; background-color: transparent; }
}

.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}

.card-head h4 {
  margin: 0;
  font-size: 14px;
}

.lock-note {
  margin: 0 0 10px;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-body {
  padding: 12px 14px 14px;
}

@media (max-width: 1100px) {
  .basic-page {
    grid-template-columns: minmax(0, 1fr);
  }
}

.small {
  font-size: 12px;
}

.edit-form .grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.attr-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

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
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--line);
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

.dept {
  margin-left: 8px;
  font-weight: 400;
  font-size: 15px;
  color: var(--muted);
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
  padding: 18px 24px 30px;
}

.kv.two {
  grid-template-columns: 96px 1fr;
}

.attrs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.attrs span {
  padding: 1px 8px;
  border-radius: 3px;
  border: 1px dashed var(--line-strong);
  color: var(--muted);
  font-size: 12px;
}

.attrs span.on {
  border-style: solid;
  border-color: var(--teal);
  background: var(--teal-soft);
  color: var(--teal-ink);
}

.file {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--teal);
  font-size: 13px;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.small {
  font-size: 12px;
}

.comments {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
}

.comments li {
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}

.c-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13px;
}

.c-text {
  margin-top: 4px;
  white-space: pre-wrap;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.empty {
  color: var(--muted);
  padding: 20px 0;
  text-align: center;
}

.frozen-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 24px;
  background: var(--teal-soft);
  color: var(--teal-ink);
  font-size: 13px;
  border-bottom: 1px solid var(--line);
}

.files-head {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.orig {
  margin-left: 8px;
}
</style>
