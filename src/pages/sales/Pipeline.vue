<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AgGridVue } from 'ag-grid-vue3'
import { themeQuartz, type ColDef, type GridApi, type GridReadyEvent, type RowClickedEvent } from 'ag-grid-community'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Setting, Plus } from '@element-plus/icons-vue'
import { deals, orders, customers, dealMembers, stageDefaultProb, isOrderClosed, type Deal } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { themes } from '../../theme'
import { money, pct, dateTime } from '../../utils/format'
import DealDrawer from '../../components/DealDrawer.vue'
import MembersDialog from '../../components/MembersDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const view = ref<'list' | 'weekly'>('list')
const openDeal = ref<string | null>(null)
const drawerTab = ref<'basic' | 'quotes' | 'comments' | 'files' | undefined>()
const drawerQuote = ref<string | undefined>()

/* 資料範圍：業務只看自己，主管與執行長看全部 */
const scoped = computed(() => store.scopedDeals)
const showLost = ref(false)
/* 閒置商機：超過 30 天沒更新且還在進行中，標示提醒（釋出規則待確認，Demo 只標示不自動釋出） */
const IDLE_DAYS = 30
const idleDays = (d: Deal) => (d.stage === 'SO已成立' || d.stage === '未成交' ? 0 : Math.floor((new Date('2026-10-08').getTime() - new Date(d.updatedAt).getTime()) / 86400000))
/* 階段欄只顯示階段本身（待接單涵蓋 SO 上單送審與簽核中） */
const stageLabel = (d: Deal) => d.stage
/* 預設不列未成交，也不列已結案（SO已成立且訂單已結案）的商機 */
const isClosed = (d: Deal) => d.stage === 'SO已成立' && orders.some((o) => o.dealId === d.id && isOrderClosed(o))
const rowData = computed(() => (showLost.value ? scoped.value : scoped.value.filter((d) => d.stage !== '未成交' && !isClosed(d))))

/* AG Grid 主題跟著個人配色走 */
const theme = computed(() => {
  const def = themes.find((t) => t.id === store.theme) ?? themes[0]!
  return themeQuartz.withParams({
    ...def.grid,
    fontFamily: 'inherit',
    fontSize: 14,
    headerFontWeight: 500,
    rowHeight: 40,
    headerHeight: 38,
    wrapperBorderRadius: 6,
  })
})

/* 承辦人：客戶部門加該部門在客戶主檔的聯絡人 */
const contactOf = (d: Deal) => {
  const c = customers.find((x) => x.name === d.customer)?.depts.find((x) => x.name === d.customerDept)?.contact
  return c ? `${d.customerDept} ${c}` : d.customerDept
}
/* 協作欄：加人（有權限才出現）與留言泡泡（有未讀提及顯示紅數字，點了直接開留言頁簽） */
const membersFor = ref<string | null>(null)
const membersDeal = computed(() => deals.find((d) => d.id === membersFor.value) ?? null)
function collabRenderer(p: { data?: Deal }) {
  const d = p.data
  const el = document.createElement('div')
  el.className = 'collab'
  if (!d) return el
  if (store.canManageMembers(d)) {
    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'cbtn add'
    add.title = '加入協作成員'
    add.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M18 8v6M15 11h6"/></svg>'
    add.onclick = (e) => { e.stopPropagation(); membersFor.value = d.id }
    el.appendChild(add)
  }
  const n = store.comments.filter((c) => c.dealId === d.id).length
  const unread = store.unreadMentions(d.id).length
  const bub = document.createElement('button')
  bub.type = 'button'
  bub.className = 'cbtn bubble' + (unread ? ' hot' : n ? ' has' : '')
  bub.title = unread ? `${unread} 則提及你的留言` : n ? `${n} 則留言` : '還沒有留言'
  bub.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>' + (unread ? `<i>${unread}</i>` : '')
  bub.onclick = (e) => { e.stopPropagation(); drawerTab.value = 'comments'; openDeal.value = d.id }
  el.appendChild(bub)
  return el
}
const moneyOf = (d: Deal, v: number) => (store.canSeeMoney(d) ? v : null)
/* 工程支援欄：待派工 N（琥珀）· 進行中 N（青）· 共 N；全部完成綠字；只有退回紅字 */
function engRenderer(p: { data?: Deal }) {
  const d = p.data
  const el = document.createElement('div')
  el.className = 'eng'
  if (!d) return el
  const s = store.engSummary(d)
  if (!s.total) { el.innerHTML = '<span class="muted">—</span>'; return el }
  const parts: string[] = []
  if (s.pending) parts.push(`<b class="amber">${s.urgent ? '急件 ' : ''}待派工 ${s.pending}</b>`)
  if (s.active) parts.push(`<b class="teal">進行中 ${s.active}</b>`)
  if (!s.pending && !s.active && s.returned) parts.push(`<b class="red">退回 ${s.returned}</b>`)
  if (!s.pending && !s.active && !s.returned && s.done) parts.push(`<b class="olive">已完成 ${s.done}</b>`)
  parts.push(`<span class="muted">共 ${s.total}</span>`)
  el.innerHTML = parts.join('<span class="dot">·</span>')
  el.title = (d.engRequests ?? []).map((t) => `${t.requestNo.slice(-3)} ${t.type} ${t.title}：${t.status === '已派工' ? '進行中' : t.status}`).join('\n')
  return el
}
const columnDefs = ref<ColDef<Deal>[]>([
  { colId: 'collab', headerName: '協作', width: 92, pinned: 'left', sortable: false, filter: false, resizable: false, cellRenderer: collabRenderer, cellClass: 'collab-cell' },
  { field: 'dealNo', headerName: '商機編號', width: 160, pinned: 'left', cellClass: 'num', cellRenderer: (p: { data?: Deal; value: string }) => (p.data && store.accessOf(p.data) === 'member' ? `${p.value} <span class="tag slate mini">協作</span>` : p.value) },
  { field: 'customer', headerName: '客戶', width: 150 },
  { field: 'customerDept', headerName: '承辦人', width: 150, valueGetter: (p) => contactOf(p.data as Deal) },
  { field: 'product', headerName: '需求摘要', flex: 1, minWidth: 220 },
  { field: 'stage', headerName: '階段', width: 150, valueGetter: (p) => stageLabel(p.data as Deal), cellClass: (p) => `stage-${(p.data as Deal).stage}` },
  { field: 'prob', headerName: '機率', width: 80, type: 'rightAligned', valueGetter: (p) => (p.data ? moneyOf(p.data, p.data.prob) : null), valueFormatter: (p) => (p.value === null ? '—' : pct(p.value, 0)), cellClass: 'num' },
  { field: 'owner', headerName: '負責業務', width: 100 },
  { colId: 'eng', headerName: '工程支援', width: 170, valueGetter: (p) => (p.data ? store.engSummary(p.data).weight : 0), comparator: (a: number, b: number) => a - b, cellRenderer: engRenderer, cellClass: 'eng-cell', filter: false, sort: store.role === '工程主管' ? 'desc' : null },
  { field: 'amount', headerName: '預估金額', width: 130, type: 'rightAligned', valueGetter: (p) => (p.data ? moneyOf(p.data, p.data.amount) : null), valueFormatter: (p) => (p.value === null ? '—' : money(p.value)), cellClass: 'num' },
  { field: 'expectClose', headerName: '預計成交', width: 110, cellClass: 'num' },
  { field: 'kind', headerName: '類型', width: 110, valueGetter: (p) => (p.data ? `${p.data.kind}${p.data.renewalOfDealId ? ' · 續約' : ''}` : '') },
  { field: 'via', headerName: '交易', width: 90, hide: true },
  { field: 'quoteVersions', headerName: '報價版本', width: 95, type: 'rightAligned', hide: true },
  { field: 'nextAction', headerName: '下一步', width: 260, hide: true },
  { field: 'updatedAt', headerName: '最後更新', width: 190, valueFormatter: (p) => dateTime(p.value) + (idleDays(p.data as Deal) >= IDLE_DAYS ? '（閒置）' : ''), cellClass: (p) => (idleDays(p.data as Deal) >= IDLE_DAYS ? 'idle-cell' : '') },
])

const defaultColDef: ColDef = { sortable: true, filter: true, resizable: true }
const quick = ref('')
const api = shallowRef<GridApi<Deal> | null>(null)

function onReady(e: GridReadyEvent<Deal>) {
  api.value = e.api
  const saved = views.value.find((v) => v.isDefault)
  if (saved) applyView(saved.name)
}

watch([() => store.comments.length, () => store.unreadMentionTotal, () => store.currentUserId, () => dealMembers.length], () => api.value?.refreshCells({ force: true, columns: ['collab', 'dealNo', 'amount', 'prob', 'eng'] }))

function onRowClicked(e: RowClickedEvent<Deal>) {
  if (e.data) openDeal.value = e.data.id
}

/* 欄位顯示設定 */
const colVisible = ref<Record<string, boolean>>({})
function syncColVisible() {
  const state = api.value?.getColumnState() ?? []
  const next: Record<string, boolean> = {}
  state.forEach((s) => (next[s.colId] = !s.hide))
  colVisible.value = next
}
function toggleCol(colId: string, visible: boolean) {
  api.value?.setColumnsVisible([colId], visible)
  colVisible.value[colId] = visible
}
const colLabels = computed(() => columnDefs.value.map((c) => ({ id: (c.colId ?? c.field) as string, label: c.headerName as string })))

/* 個人視圖：存在瀏覽器，正式版存 core.user_view（jsonb） */
interface SavedView {
  name: string
  isDefault?: boolean
  columnState: unknown
  filterModel: unknown
  quick: string
}
const VIEW_KEY = `erp.pipeline.views.${store.currentUserId}`
const views = ref<SavedView[]>(JSON.parse(localStorage.getItem(VIEW_KEY) ?? '[]'))
const activeView = ref<string>('')

async function saveView() {
  if (!api.value) return
  const { value } = await ElMessageBox.prompt('視圖名稱', '另存為我的視圖', { inputValue: activeView.value || '我的視圖', confirmButtonText: '儲存', cancelButtonText: '取消' }).catch(() => ({ value: '' }))
  if (!value) return
  const v: SavedView = { name: value, columnState: api.value.getColumnState(), filterModel: api.value.getFilterModel(), quick: quick.value }
  const idx = views.value.findIndex((x) => x.name === value)
  if (idx >= 0) views.value[idx] = { ...views.value[idx], ...v }
  else views.value.push(v)
  localStorage.setItem(VIEW_KEY, JSON.stringify(views.value))
  activeView.value = value
  ElMessage.success(`視圖「${value}」已儲存，下次登入自動套用`)
}
function applyView(name: string) {
  const v = views.value.find((x) => x.name === name)
  if (!v || !api.value) return
  api.value.applyColumnState({ state: v.columnState as never, applyOrder: true })
  api.value.setFilterModel(v.filterModel as never)
  quick.value = v.quick
  activeView.value = name
  syncColVisible()
}
function setDefaultView(name: string) {
  views.value.forEach((v) => (v.isDefault = v.name === name))
  localStorage.setItem(VIEW_KEY, JSON.stringify(views.value))
  ElMessage.success('已設為預設視圖')
}
function resetView() {
  api.value?.resetColumnState()
  api.value?.setFilterModel(null)
  quick.value = ''
  activeView.value = ''
  syncColVisible()
}

/* 週會視圖 */
const weeklyRows = computed(() => {
  const byOwner = new Map<string, Deal[]>()
  rowData.value
    .filter((d) => d.stage !== '未成交' && !isClosed(d))
    .forEach((d) => {
      if (!byOwner.has(d.owner)) byOwner.set(d.owner, [])
      byOwner.get(d.owner)!.push(d)
    })
  return [...byOwner.entries()].map(([owner, list]) => ({
    owner,
    list: list.sort((a, b) => b.amount - a.amount),
    total: list.reduce((s, d) => s + d.amount, 0),
  }))
})
function lastComment(dealId: string) {
  return store.comments.filter((c) => c.dealId === dealId).sort((a, b) => b.at.localeCompare(a.at))[0]
}

/* 防撞檢核：新增商機 */
const creating = ref(false)
const blankForm = () => ({ customer: '', dept: '', product: '', amount: 500000, via: '直接交易' as Deal['via'], endUser: '', kind: '新購' as Deal['kind'], renewalOf: '', renewalReason: '到期續簽' as NonNullable<Deal['renewalReason']>, renewalItems: [] as string[], needsEng: false, preOrder: false, prepay: false })
const form = ref(blankForm())
/* 續約自：同一客戶、已成立 SO 的商機；選了就帶原案的類型、部門、產品 */
const renewalOptions = computed(() => store.renewalCandidates(form.value.customer))
/** 原 SO 的授權清單：續約項目從這裡勾 */
const renewalLicenses = computed(() => (form.value.renewalOf ? orders.find((o) => o.dealId === form.value.renewalOf)?.licenses.filter((l) => l.expires && l.expires !== '—') ?? [] : []))
const coTermNote = computed(() => {
  const picked = renewalLicenses.value.filter((l) => form.value.renewalItems.includes(l.id))
  const dates = [...new Set(picked.map((l) => l.expires))]
  return dates.length > 1 ? `到期日不同（${dates.join('、')}），報價時併到同一天（co-term）` : ''
})
watch(() => form.value.renewalOf, (id) => {
  const d = deals.find((x) => x.id === id)
  form.value.renewalItems = d ? renewalLicenses.value.map((l) => l.id) : []
  if (!d) return
  form.value.kind = d.kind === '新購' ? '授權' : d.kind
  form.value.dept = d.customerDept
  if (!form.value.product.trim()) form.value.product = `${d.product} 續約`
  form.value.via = d.via
  form.value.endUser = d.endUser ?? ''
})
watch(() => form.value.customer, () => { form.value.renewalOf = '' })
const conflict = computed(() => {
  if (!form.value.customer || !form.value.dept) return null
  return deals.find((d) => d.customer === form.value.customer && d.customerDept === form.value.dept && d.stage !== '未成交' && d.stage !== 'SO已成立') ?? null
})
/* 客戶與部門來自客戶主檔；沒有主檔的客戶要先建檔 */
const NEW_DEPT = '新部門（需主檔建立）'
const customerOptions = computed(() => customers.filter((c) => c.status === '正常' && c.type === '終端客戶'))
const customerRec = computed(() => customers.find((c) => c.name === form.value.customer))
const deptsOf = computed(() => [...(customerRec.value?.depts.map((d) => d.name) ?? []), NEW_DEPT])
const newDeptName = ref('')
function createDeal() {
  if (conflict.value) return
  const rec = customerRec.value
  if (!rec) {
    ElMessage.warning('客戶不在主檔，請先到客戶主檔建檔')
    return
  }
  let dept = form.value.dept
  if (!dept) {
    ElMessage.warning('客戶部門必填')
    return
  }
  if (form.value.via === '中間商' && !form.value.endUser.trim()) {
    ElMessage.warning('經中間商的案要填終端使用者')
    return
  }
  if (dept === NEW_DEPT) {
    const name = newDeptName.value.trim()
    if (!name) {
      ElMessage.warning('請填新部門名稱，系統會建到客戶主檔')
      return
    }
    if (rec.depts.some((d) => d.name === name)) {
      ElMessage.warning(`「${name}」已存在於主檔，請直接選用`)
      return
    }
    rec.depts.push({ name })
    dept = name
  }
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10)
  const seq = deals.filter((d) => d.dealNo.startsWith(`D-${ymd.slice(0, 4)}-${ymd.slice(5, 7)}${ymd.slice(8, 10)}`)).length + 1
  const dealNo = `D-${ymd.slice(0, 4)}-${ymd.slice(5, 7)}${ymd.slice(8, 10)}-${String(seq).padStart(3, '0')}`
  const close = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)
  const d: Deal = {
    id: `d-${now.getTime()}`,
    dealNo,
    customer: form.value.customer,
    customerDept: dept,
    via: form.value.via,
    endUser: form.value.via === '中間商' && form.value.endUser.trim() ? form.value.endUser.trim() : undefined,
    kind: form.value.kind,
    renewalOfDealId: form.value.renewalOf || undefined,
    renewalReason: form.value.renewalOf ? form.value.renewalReason : undefined,
    renewalItems: form.value.renewalOf && form.value.renewalItems.length ? [...form.value.renewalItems] : undefined,
    ownerId: store.currentUserId,
    owner: store.currentUser.name,
    dept: store.currentUser.dept,
    prob: stageDefaultProb['規劃預算'],
    amount: form.value.amount,
    stage: '規劃預算',
    updatedAt: now.toISOString(),
    expectClose: close,
    nextAction: '確認需求範圍與預算',
    needsEng: form.value.needsEng,
    preOrder: form.value.preOrder,
    prepay: form.value.prepay,
    quoteVersions: 0,
    product: form.value.product.trim() || '需求待確認',
  }
  deals.unshift(d)
  creating.value = false
  form.value = blankForm()
  newDeptName.value = ''
  if (d.preOrder) store.requestPreOrder(d)
  if (form.value.needsEng) store.requestEngineering(d, { type: '售前諮詢', title: '售前支援', desc: d.product, dueDate: close, urgent: false })
  ElMessage.success(`商機已建立，編號 ${dealNo}，${d.owner} 負責${d.prepay ? '；需預付，之後會產生預付款簽核' : ''}${d.preOrder ? '；已通知採購預下單，請先建立報價單' : ''}`)
  openDeal.value = d.id
}

onMounted(() => {
  const id = route.query.deal as string | undefined
  drawerTab.value = (route.query.tab as typeof drawerTab.value) ?? undefined
  drawerQuote.value = (route.query.quote as string | undefined) ?? undefined
  if (id) openDeal.value = id
  if (route.query.new) {
    creating.value = true
    if (route.query.customer) form.value.customer = String(route.query.customer)
  }
  if (id || route.query.new) router.replace({ query: {} })
})
</script>

<template>
  <div class="page pipeline">
    <div class="page-head">
      <div>
        <h1>潛在商機（Pipeline）</h1>
      </div>
      <div class="actions">
        <el-radio-group v-model="view">
          <el-radio-button value="list">列表</el-radio-button>
          <el-radio-button value="weekly">週會視圖</el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Plus" @click="creating = true">新增商機</el-button>
      </div>
    </div>

    <template v-if="view === 'list'">
      <div class="toolbar">
        <el-input v-model="quick" placeholder="快速篩選：客戶、編號、產品" clearable class="quick" />
        <el-checkbox v-model="showLost">含未成交與已結案</el-checkbox>
        <span class="spacer"></span>
        <el-select :model-value="activeView" placeholder="我的視圖" class="views" @change="applyView">
          <el-option v-for="v in views" :key="v.name" :value="v.name" :label="v.isDefault ? `${v.name}（預設）` : v.name" />
        </el-select>
        <el-button @click="saveView">另存視圖</el-button>
        <el-button v-if="activeView" text @click="setDefaultView(activeView)">設為預設</el-button>
        <el-button text @click="resetView">重設</el-button>
        <el-popover trigger="click" width="220" placement="bottom-end" @show="syncColVisible">
          <template #reference>
            <el-button :icon="Setting">欄位</el-button>
          </template>
          <div class="col-list">
            <el-checkbox
              v-for="c in colLabels"
              :key="c.id"
              :model-value="colVisible[c.id] !== false"
              @update:model-value="(v: boolean | string | number) => toggleCol(c.id, !!v)"
            >{{ c.label }}</el-checkbox>
          </div>
        </el-popover>
      </div>

      <div class="grid">
        <AgGridVue
          :theme="theme"
          :row-data="rowData"
          :column-defs="columnDefs"
          :default-col-def="defaultColDef"
          :quick-filter-text="quick"
          :animate-rows="true"
          row-selection="single"
          :suppress-cell-focus="true"
          style="height: 100%"
          @grid-ready="onReady"
          @row-clicked="onRowClicked"
        />
      </div>
    </template>

    <template v-else>
      <section v-for="g in weeklyRows" :key="g.owner" class="panel weekly">
        <div class="panel-head">
          <h2>{{ g.owner }}<span class="muted sub">{{ g.list.length }} 件 · 預估 {{ money(g.total) }}</span></h2>
        </div>
        <table class="plain-table">
          <thead>
            <tr>
              <th>客戶</th><th>進度</th><th class="num">預算</th><th class="num">機率</th><th>POC</th><th>最新留言</th><th>下一步</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in g.list" :key="d.id" class="row" @click="openDeal = d.id">
              <td>
                <b>{{ d.customer }}</b><span class="muted"> {{ d.customerDept }}</span>
                <div class="muted small">{{ d.product }}</div>
              </td>
              <td><span class="tag" :class="d.stage === '議價' || d.stage === '待接單' ? 'amber' : d.stage === 'SO已成立' ? 'olive' : 'teal'">{{ d.stage }}</span></td>
              <td class="num">{{ store.canSeeMoney(d) ? money(d.amount) : '—' }}</td>
              <td class="num">{{ store.canSeeMoney(d) ? pct(d.prob, 0) : '—' }}</td>
              <td>{{ d.poc ?? '—' }}</td>
              <td class="comment">
                <template v-if="lastComment(d.id)">
                  <span class="muted small">{{ lastComment(d.id)!.author }} · {{ dateTime(lastComment(d.id)!.at) }}</span>
                  <div>{{ lastComment(d.id)!.text }}</div>
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td>{{ d.nextAction }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <MembersDialog :model-value="!!membersFor" :deal="membersDeal" @update:model-value="(v: boolean) => { if (!v) membersFor = null }" />
    <DealDrawer :deal-id="openDeal" :initial-tab="drawerTab" :initial-quote-id="drawerQuote" @close="openDeal = null; drawerTab = undefined; drawerQuote = undefined" @open="(id: string) => { drawerTab = undefined; drawerQuote = undefined; openDeal = id }" />

    <el-dialog v-model="creating" title="新增商機" width="640px">
      <el-form label-position="top">
        <el-form-item label="客戶" required>
          <el-select v-model="form.customer" filterable placeholder="從客戶主檔選取" style="width: 100%" @change="form.dept = ''">
            <el-option v-for="c in customerOptions" :key="c.id" :value="c.name" :label="`${c.name}（${c.taxId}）`" />
          </el-select>
        </el-form-item>
        <el-form-item label="客戶部門" required>
          <el-select v-model="form.dept" :disabled="!form.customer" placeholder="部門採主檔選取，避免同一部門多種寫法" style="width: 100%">
            <el-option v-for="d in deptsOf" :key="d" :value="d" :label="d" />
          </el-select>
          <el-input v-if="form.dept === NEW_DEPT" v-model="newDeptName" placeholder="新部門名稱，建立商機時一併寫入客戶主檔" style="margin-top: 6px" />
        </el-form-item>
        <el-form-item label="需求摘要">
          <el-input v-model="form.product" placeholder="例：FortiGate 200F 高可用組 + 原廠維護" />
        </el-form-item>
        <div class="grid2">
          <el-form-item label="預估金額">
            <el-input-number v-model="form.amount" :step="10000" :min="0" style="width: 100%" />
          </el-form-item>
          <el-form-item label="類型">
            <el-radio-group v-model="form.kind">
              <el-radio-button value="新購">新購</el-radio-button>
              <el-radio-button value="授權">授權</el-radio-button>
              <el-radio-button value="維護">維護</el-radio-button>
              <el-radio-button value="服務">服務</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <div class="grid2">
          <el-form-item label="續約自">
            <el-select v-model="form.renewalOf" clearable :placeholder="form.customer ? (renewalOptions.length ? '這家客戶已成立 SO 的商機' : '這家客戶還沒有成立過 SO') : '先選客戶'" style="width: 100%">
              <el-option v-for="r in renewalOptions" :key="r.d.id" :value="r.d.id" :disabled="!!r.active" :label="`${r.d.dealNo} · ${r.d.product}（${r.so.soNo}）${r.active ? `｜已有續約商機 ${r.active.dealNo}` : ''}`" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.renewalOf" label="續約原因">
            <el-radio-group v-model="form.renewalReason">
              <el-radio-button value="到期續簽">到期續簽</el-radio-button>
              <el-radio-button value="擴充">擴充</el-radio-button>
              <el-radio-button value="升級">升級</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item v-if="form.renewalOf" label="續約項目（原 SO 的授權）">
          <el-checkbox-group v-model="form.renewalItems" class="serials">
            <el-checkbox v-for="l in renewalLicenses" :key="l.id" :value="l.id">{{ l.sku }} × {{ l.qty }}<span class="muted small"> · {{ l.expires }} 到期</span></el-checkbox>
          </el-checkbox-group>
          <div v-if="coTermNote" class="muted small">{{ coTermNote }}</div>
          <div v-else-if="!renewalLicenses.length" class="muted small">原 SO 還沒有授權到期資料。</div>
        </el-form-item>
        <div class="grid2">
          <el-form-item label="交易方式">
            <el-radio-group v-model="form.via">
              <el-radio-button value="直接交易">直接交易</el-radio-button>
              <el-radio-button value="中間商">中間商</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="form.via === '中間商'" label="終端使用者" required>
            <el-input v-model="form.endUser" placeholder="實際使用的客戶" />
          </el-form-item>
        </div>
        <el-form-item label="案件屬性">
          <div class="attr-row">
            <el-checkbox v-model="form.needsEng">需工程支援（建立後送工程主管派工）</el-checkbox>
            <el-checkbox v-model="form.preOrder">預下單（未回簽先向原廠下單，PO 需主管核准）</el-checkbox>
            <el-checkbox v-model="form.prepay">預付（會產生預付款簽核單）</el-checkbox>
          </div>
        </el-form-item>
      </el-form>
      <div v-if="conflict" class="conflict">
        <b>此客戶部門已有進行中的商機</b>
        <p>{{ conflict.dealNo }} 由 {{ conflict.owner }} 負責，階段「{{ conflict.stage }}」。</p>
      </div>
      <template #footer>
        <el-button @click="creating = false">取消</el-button>
        <el-button v-if="conflict" type="warning" @click="creating = false; ElMessage.info('已通知業務主管判定歸屬')">請主管判定</el-button>
        <el-button v-else type="primary" :disabled="!form.customer || !form.dept" @click="createDeal">建立商機</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.serials {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.grid :deep(.collab-cell) {
  padding: 0 6px;
}

.grid :deep(.collab) {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 100%;
}

.grid :deep(.cbtn) {
  position: relative;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.grid :deep(.cbtn:hover) {
  background: var(--paper);
  color: var(--teal);
}

.grid :deep(.cbtn.bubble.has svg) {
  fill: var(--slate-soft);
  color: var(--ink);
}

.grid :deep(.cbtn.bubble.hot) {
  color: var(--teal);
}

.grid :deep(.cbtn.bubble.hot svg) {
  fill: var(--teal-soft);
}

.grid :deep(.cbtn.bubble i) {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--red);
  color: #fff;
  font: 600 10px/16px var(--font-sans);
  font-style: normal;
}

.grid :deep(.eng) {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  white-space: nowrap;
}

.grid :deep(.eng b) {
  font-weight: 600;
}

.grid :deep(.eng .amber) {
  color: var(--amber);
}

.grid :deep(.eng .teal) {
  color: var(--teal);
}

.grid :deep(.eng .red) {
  color: var(--red);
}

.grid :deep(.eng .olive) {
  color: var(--olive);
}

.grid :deep(.eng .dot) {
  color: var(--line-strong);
}

.grid :deep(.tag.mini) {
  font-size: 10px;
  padding: 1px 5px;
  margin-left: 4px;
  vertical-align: middle;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.attr-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.quick {
  width: 280px;
}

.spacer {
  flex: 1;
}

.views {
  width: 160px;
}

.col-list {
  display: flex;
  flex-direction: column;
}

.grid {
  height: calc(100vh - var(--topbar-h) - 190px);
  min-height: 360px;
}

.grid :deep(.idle-cell) {
  color: var(--amber);
  font-weight: 600;
}

.grid :deep(.stage-議價),
.grid :deep(.stage-待接單) {
  color: var(--amber);
  font-weight: 500;
}

.grid :deep(.stage-SO已成立) {
  color: var(--olive);
}

.grid :deep(.stage-未成交) {
  color: var(--muted);
}

.small {
  font-size: 12px;
}

.weekly {
  margin-bottom: 16px;
}

.sub {
  font-weight: 400;
  font-size: 13px;
  margin-left: 10px;
}

.row {
  cursor: pointer;
}

.comment {
  max-width: 280px;
}

.conflict {
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--amber-soft);
  color: var(--amber);
}

.conflict p {
  color: var(--ink);
  margin-top: 4px;
  font-size: 13px;
}
</style>
