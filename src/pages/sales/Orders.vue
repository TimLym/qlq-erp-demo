<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { AgGridVue } from 'ag-grid-vue3'
import { themeQuartz, type ColDef, type GridApi, type GridReadyEvent, type RowClickedEvent } from 'ag-grid-community'
import { Setting } from '@element-plus/icons-vue'
import { deals, isOrderClosed, isGuarantee, billingOf, billingTaxOf, overduePay, type Order } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { themes } from '../../theme'
import { money, pct } from '../../utils/format'
import { checkpointsOf } from '../../utils/checkpoints'
import SoDrawer from '../../components/SoDrawer.vue'
import BillingRequestDialog from '../../components/BillingRequestDialog.vue'
import { useJump } from '../../composables/useJump'
import { CheckFilter } from '../../utils/checkFilter'

/*
 * 銷售訂單列表比照 Pipeline：AG Grid（欄位排序、欄位篩選、快速篩選、欄位顯示）。
 * 上方兩列可點的階段 stepper（執行階段、財務階段）可交叉篩選；階段欄用「當前階段名稱＋小條」呈現，抽屜裡不再重複階段條。
 * SO 只在上單最後一關核准時產生，所以每一列都從「接單」開始。
 */
const store = useAppStore()
const route = useRoute()
const router = useRouter()
const salesOnly = computed(() => store.role === '業務')
/* 工程主管、工程師看不到金額 */
const engView = computed(() => ['工程主管', '工程師'].includes(store.role))

/* AG Grid 主題跟著個人配色走 */
const theme = computed(() => {
  const def = themes.find((t) => t.id === store.theme) ?? themes[0]!
  return themeQuartz.withParams({
    ...def.grid,
    fontFamily: 'inherit',
    fontSize: 14,
    headerFontWeight: 500,
    rowHeight: 60,
    headerHeight: 40,
    wrapperBorderRadius: 6,
  })
})

/*
 * 篩選都在欄位標題：「執行進度」「財務進度」各有勾選篩選。進度會疊加（例如部分出貨又已開票），
 * 所以條件是「卡在哪」，一張單可以同時符合好幾個；勾多個時符合任一個就列出。
 */
const today = new Date().toISOString().slice(0, 10)
const EXEC_OPTS = ['未下單', '未到貨', '未出貨', '待驗收', '待工程結案', '已結案', '合約變更中', '保證單', '已作廢']
const FIN_OPTS = ['有未開票', '待會計開票', '已開票未收', '逾期未收', '已收齊']
function matchExec(o: Order, f: string) {
  if (f === '已作廢') return !!o.voidedAt
  if (o.voidedAt) return false
  if (f === '保證單') return isGuarantee(o)
  if (isGuarantee(o)) return false
  const closed = isOrderClosed(o)
  /* 優先序：作廢 → 保證單 → 已結案（以上互斥）；合約變更中可與下面的執行檢查點疊加 */
  if (closed) return f === '已結案'
  if (f === '已結案') return false
  const cp = Object.fromEntries(checkpointsOf(o).map((c) => [c.key, c.done]))
  if (f === '未下單') return !cp.order
  if (f === '未到貨') return !!cp.order && !cp.arrive
  if (f === '未出貨') return !cp.ship
  if (f === '待驗收') return !!cp.ship && !cp.accept
  if (f === '待工程結案') return !!cp.accept && !o.engClosedAt
  if (f === '合約變更中') return !!o.changeQuoteId
  return true
}
function matchFin(o: Order, f: string) {
  if (isGuarantee(o) || o.voidedAt) return false
  const b = billingOf(o)
  if (f === '有未開票') return b.uninvoiced > 0
  if (f === '待會計開票') return o.milestones.some((m) => m.status === '已申請')
  if (f === '已開票未收' || f === '已開票未收款') return b.invoicedUnpaid > 0
  if (f === '逾期未收') return overduePay(o, today).length > 0
  if (f === '已收齊') return b.paid >= b.total
  return true
}
const rowData = computed(() => store.scopedOrders)
const shown = ref(0)
const filtered = ref(false)
function onFilterChanged() {
  shown.value = api.value?.getDisplayedRowCount() ?? 0
  filtered.value = !!api.value?.isAnyFilterPresent() || !!quick.value
}
function resetFilters() {
  quick.value = ''
  api.value?.setFilterModel(null)
  api.value?.resetColumnState()
  activeView.value = ''
  syncColVisible()
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
/* 執行欄：檢查點 chip；保證單只標狀態 */
function cpRenderer(p: { data?: Order }) {
  const o = p.data
  if (!o) return ''
  if (isGuarantee(o)) return `<span class="tag ${o.voidedAt ? 'slate' : 'amber'}">${o.voidedAt ? '已作廢' : `保證單 · ${o.guaranteeReason ?? ''}`}</span>`
  const chips = checkpointsOf(o)
    .filter((c) => c.key !== 'eng' || c.done || isOrderClosed(o))
    .map((c) => `<span class="cp${c.done ? ' done' : ''}${c.wait ? ' wait' : ''}${c.gap ? ' gap' : ''}">${c.label}</span>`)
    .join('')
  const tail = isOrderClosed(o) ? '<span class="cp-end">✓ 結案</span>' : o.changeQuoteId ? '<span class="cp-end amber">合約變更中</span>' : ''
  return `<div class="cps">${chips}${tail}</div>`
}
/* 財務進度：開票幾期、收款幾期；逾期與待會計開票另外標 */
function finRenderer(p: { data?: Order }) {
  const o = p.data
  if (!o) return ''
  if (isGuarantee(o) || o.voidedAt) return '<span class="muted">—</span>'
  const n = o.milestones.length
  const inv = o.milestones.filter((m) => m.status === '已開票' || m.status === '已收款').length
  const paid = o.milestones.filter((m) => m.status === '已收款').length
  const asked = o.milestones.filter((m) => m.status === '已申請').length
  const late = overduePay(o, today).length
  const step = (label: string, k: number) => `<span class="fp${k >= n && n ? ' done' : k > 0 ? ' part' : ''}">${label} ${k}/${n}</span>`
  const flags = [asked ? `<span class="fp-flag amber">待開票 ${asked}</span>` : '', late ? `<span class="fp-flag red">逾期 ${late}</span>` : ''].join('')
  return `<div class="fps">${step('開票', inv)}${step('收款', paid)}${flags}</div>`
}
/* 金額欄：含稅；保證單不請款 */
const amtCell = (key: 'uninvoiced' | 'invoicedUnpaid' | 'paid') => (p: { data?: Order }) => {
  const o = p.data
  if (!o) return ''
  if (isGuarantee(o) || !store.canSeeOrderMoney(o)) return '<span class="muted">—</span>'
  const v = billingTaxOf(o)[key]
  const cls = key === 'uninvoiced' && v > 0 ? 'amt warn' : v === 0 ? 'amt zero' : 'amt'
  return `<span class="${cls}">${money(v)}</span>`
}
const amtValue = (key: 'uninvoiced' | 'invoicedUnpaid' | 'paid') => (p: { data?: Order }) => (p.data && !isGuarantee(p.data) ? billingOf(p.data)[key] : -1)
/* 通知開票：負責業務、業務主管、執行長；有未開票的期數才出現 */
const canBill = (o: Order) => store.can('/sales/orders', 'edit') && !isGuarantee(o) && o.milestones.some((m) => m.status === '待請款') && (['業務主管', '執行長'].includes(store.role) || (store.role === '業務' && o.owner === store.currentUser.name))
const billCell = (p: { data?: Order }) => (p.data && canBill(p.data) ? '<button type="button" class="bill-btn" data-bill="1">通知開票</button>' : '')
const isRenewal = (o: Order) => !!deals.find((d) => d.id === o.dealId)?.renewalOfDealId
const marginOf = (o: Order) => (o.amount ? (o.amount - o.cost) / o.amount : 0)
const marginTip = (o: Order) => (salesOnly.value ? '' : `業務毛利率 ${pct(marginOf(o))}；公司毛利率 ${o.actualCost === undefined ? '—（PO 核准後寫回）' : pct((o.amount - o.actualCost) / o.amount)}${o.actualCost !== undefined && o.actualCost !== o.cost ? `；成本差異 ${o.actualCost > o.cost ? '+' : '−'}${money(Math.abs(o.actualCost - o.cost))}` : ''}`)

const allColumnDefs = (): ColDef<Order>[] => [
  { field: 'soNo', headerName: 'SO 編號', width: 172, pinned: 'left', cellClass: 'num', getQuickFilterText: (p) => `${p.value} ${p.data?.dealNo ?? ''}`, cellRenderer: (p: { data?: Order; value: string }) => (p.data ? `${p.value}<div class="sub">${store.can('/sales/pipeline') ? `<a class="link" data-deal="${p.data.dealNo}">${p.data.dealNo}</a>` : p.data.dealNo}</div>` : '') },
  { field: 'customer', headerName: '客戶 / 內容', flex: 1, minWidth: 300, getQuickFilterText: (p) => `${p.value} ${p.data?.product ?? ''}`, cellRenderer: (p: { data?: Order; value: string }) => (p.data ? `<b>${esc(p.value)}</b>${isRenewal(p.data) ? ' <span class="tag slate mini">續約</span>' : ''}<div class="sub ellipsis" title="${esc(p.data.product)}">${esc(p.data.product)}</div>` : '') },
  { field: 'owner', headerName: '負責業務', width: 104 },
  { field: 'amount', headerName: '訂單金額', hide: true, width: 136, type: 'rightAligned', valueFormatter: (p) => money(p.value), cellClass: 'num' },
  { colId: 'margin', hide: true, headerName: salesOnly.value ? '業務毛利率' : '毛利率', width: 112, type: 'rightAligned', valueGetter: (p) => (p.data ? marginOf(p.data) : 0), valueFormatter: (p) => pct(p.value), cellClass: 'num', tooltipValueGetter: (p) => (p.data ? marginTip(p.data) : '') },
  { colId: 'exec', headerName: '執行進度', width: 320, sortable: false, cellRenderer: cpRenderer, cellClass: 'cp-col', filter: CheckFilter, filterParams: { options: EXEC_OPTS, match: matchExec } },
  { colId: 'finProgress', headerName: '財務進度', width: 230, sortable: false, cellRenderer: finRenderer, filter: CheckFilter, filterParams: { options: FIN_OPTS, match: matchFin } },
  { colId: 'uninvoiced', headerName: '未開票（含稅）', width: 136, hide: true, type: 'rightAligned', filter: false, valueGetter: amtValue('uninvoiced'), cellRenderer: amtCell('uninvoiced') },
  { colId: 'invoicedUnpaid', headerName: '已開票未收（含稅）', width: 156, hide: true, type: 'rightAligned', filter: false, valueGetter: amtValue('invoicedUnpaid'), cellRenderer: amtCell('invoicedUnpaid') },
  { colId: 'paid', headerName: '已收款（含稅）', width: 136, hide: true, type: 'rightAligned', filter: false, valueGetter: amtValue('paid'), cellRenderer: amtCell('paid') },
  { colId: 'bill', headerName: '通知開票', width: 112, filter: false, sortable: false, cellRenderer: billCell },
  { field: 'product', headerName: '需求摘要', width: 240, hide: true },
]
/* 金額類欄位：工程角色直接不給（欄位設定也看不到），切換示範身分時重建 */
const MONEY_COLS = new Set(['amount', 'margin', 'finProgress', 'uninvoiced', 'invoicedUnpaid', 'paid'])
const idOf = (c: ColDef<Order>) => (c.colId ?? c.field) as string
const columnDefs = computed(() => allColumnDefs().filter((c) => !(engView.value && MONEY_COLS.has(idOf(c)))))
const flatCols = computed(() => columnDefs.value.map((c) => ({ id: idOf(c), label: c.headerName as string })))
const defaultColDef: ColDef = { sortable: true, filter: true, resizable: true }
const quick = ref('')
const api = shallowRef<GridApi<Order> | null>(null)
function onReady(e: GridReadyEvent<Order>) {
  api.value = e.api
  const saved = views.value.find((v) => v.isDefault)
  if (saved) applyView(saved.name)
  /* 首頁「逾期未收」等連結帶 ?fin=：套到財務進度欄的篩選 */
  const rawFin = typeof route.query.fin === 'string' ? route.query.fin : ''
  const fin = rawFin === '已開票未收款' ? '已開票未收' : rawFin
  if (rawFin) {
    if (!engView.value && FIN_OPTS.includes(fin))
      e.api
        .setColumnFilterModel('finProgress', { values: [fin] })
        .then(() => {
          e.api.onFilterChanged()
          onFilterChanged()
        })
        .catch(() => {})
    const { fin: _fin, ...rest } = route.query
    router.replace({ query: rest })
  }
  onFilterChanged()
}
watch(() => store.currentUserId, () => api.value?.refreshCells({ force: true }))

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
const colLabels = flatCols

/* 個人視圖（比照 Pipeline）：存在瀏覽器，正式版存 core.user_view（jsonb） */
interface SavedView {
  name: string
  isDefault?: boolean
  columnState: unknown
  filterModel: unknown
  quick: string
}
/* 切換示範身分時整頁會重新掛載（AppShell 的 RouterView key），所以這裡用掛載當下的身分即可 */
const VIEW_KEY = `erp.orders.views.${store.currentUserId}`
const readViews = (): SavedView[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '[]')
    if (!Array.isArray(v)) return []
    return v
      .filter((x): x is SavedView => !!x && typeof x === 'object' && typeof (x as SavedView).name === 'string' && Array.isArray((x as SavedView).columnState))
      .map(({ name, isDefault, columnState, filterModel, quick }) => ({ name, isDefault, columnState, filterModel, quick: typeof quick === 'string' ? quick : '' }))
  } catch {
    return []
  }
}
const views = ref<SavedView[]>(readViews())
const activeView = ref<string>('')
const writeViews = (): boolean => {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(views.value))
    return true
  } catch {
    ElMessage.warning('瀏覽器不允許儲存，這個視圖只在這次開啟有效')
    return false
  }
}
async function saveView() {
  if (!api.value) return
  const { value } = await ElMessageBox.prompt('視圖名稱', '另存為我的視圖', { inputValue: activeView.value || '我的視圖', confirmButtonText: '儲存', cancelButtonText: '取消' }).catch(() => ({ value: '' }))
  if (!value) return
  const v: SavedView = { name: value, columnState: api.value.getColumnState(), filterModel: api.value.getFilterModel(), quick: quick.value }
  const idx = views.value.findIndex((x) => x.name === value)
  if (idx >= 0) views.value[idx] = { ...views.value[idx], ...v }
  else views.value.push(v)
  activeView.value = value
  if (writeViews()) ElMessage.success(`視圖「${value}」已儲存，下次登入自動套用`)
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
  if (writeViews()) ElMessage.success('已設為預設視圖')
}

/* 抽屜：底部全幅，全站統一（Pipeline、CRM、SO） */
const openId = ref<string | null>(null)
watch(
  () => route.query.so,
  (so) => {
    if (!so) return
    const o = store.scopedOrders.find((x) => x.soNo === String(so))
    if (o) openId.value = o.id
    /* 開了就把網址的 ?so= 清掉（其他參數保留）；不能等關抽屜才清，否則抽屜裡 push 去別頁後緊接的 replace 會把那次跳轉蓋掉 */
    const { so: _so, ...rest } = route.query
    router.replace({ query: rest })
  },
  { immediate: true },
)
const { goDealNo } = useJump()
function onRowClicked(e: RowClickedEvent<Order>) {
  /* 點 SO 編號底下的商機編號：開 Pipeline 的商機抽屜，不開 SO 抽屜 */
  const target = (e.event as MouseEvent | undefined)?.target as HTMLElement | null
  const dealLink = target?.closest?.('a[data-deal]') as HTMLElement | null
  if (dealLink?.dataset.deal) {
    goDealNo(dealLink.dataset.deal)
    return
  }
  if (target?.closest?.('button[data-bill]') && e.data) {
    billing.value = e.data
    return
  }
  if (e.data) openId.value = e.data.id
}
const billing = ref<Order | null>(null)
function close() {
  openId.value = null
  api.value?.deselectAll()
  api.value?.refreshCells({ force: true })
}
</script>

<template>
  <div class="page fill-page">
    <div class="page-head">
      <div>
        <h1>銷售訂單（SO）</h1>
      </div>
    </div>

    <div class="toolbar">
      <el-input v-model="quick" placeholder="搜尋 SO、商機、客戶、內容、業務" clearable class="quick" />
      <span class="muted small">{{ filtered ? `篩選後 ${shown} 筆` : `共 ${shown} 筆` }}</span>
      <span class="spacer"></span>
      <el-select :model-value="activeView" placeholder="我的視圖" class="views" @change="applyView">
        <el-option v-for="v in views" :key="v.name" :value="v.name" :label="v.isDefault ? `${v.name}（預設）` : v.name" />
      </el-select>
      <el-button @click="saveView">另存視圖</el-button>
      <el-button v-if="activeView" text @click="setDefaultView(activeView)">設為預設</el-button>
      <el-button text @click="resetFilters">重設</el-button>
      <el-popover trigger="click" width="240" placement="bottom-end" @show="syncColVisible">
        <template #reference>
          <el-button :icon="Setting">欄位</el-button>
        </template>
        <div class="col-list">
          <el-checkbox v-for="c in colLabels" :key="c.id" :model-value="colVisible[c.id] !== false" @update:model-value="(v: boolean | string | number) => toggleCol(c.id, !!v)">{{ c.label }}</el-checkbox>
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
        :tooltip-show-delay="300"
        :overlay-no-rows-template="!filtered ? '<span class=\'muted\'>目前沒有銷售訂單。商機完成上單核准後，SO 會出現在這裡。</span>' : '<span class=\'muted\'>沒有符合此篩選條件的訂單。</span>'"
        style="height: 100%"
        @grid-ready="onReady"
        @filter-changed="onFilterChanged"
        @row-data-updated="onFilterChanged"
        @row-clicked="onRowClicked"
      />
    </div>

    <SoDrawer :order-id="openId" @close="close" />
    <BillingRequestDialog :order="billing" @close="billing = null; api?.refreshCells({ force: true })" />
  </div>
</template>

<style scoped>
/* 篩選列：兩個下拉＋快捷標籤 */
.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0 0 12px;
}

.filters .f {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}

.filters .sep {
  width: 1px;
  height: 24px;
  background: var(--line);
}

.quick-chip {
  font: inherit;
  font-size: 13px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  border-radius: 999px;
  padding: 5px 12px;
  cursor: pointer;
}

.quick-chip.hot {
  border-color: var(--amber);
  background: var(--amber-soft);
  color: var(--amber);
}

.quick-chip.on {
  border-color: var(--teal);
  background: var(--teal);
  color: #fff;
}

.filters .tax {
  margin-left: auto;
}

.grid :deep(.cps) {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
  line-height: 1.4;
}

.grid :deep(.cp) {
  padding: 1px 6px;
  border-radius: var(--radius-s);
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
}

.grid :deep(.cp.done) {
  background: var(--teal-soft);
  border-color: var(--teal-soft);
  color: var(--teal-ink, var(--teal));
}

.grid :deep(.cp.wait) {
  background: var(--amber-soft);
  border: 1px dashed var(--amber);
  color: var(--amber);
}

.grid :deep(.cp.gap) {
  border-color: var(--amber);
  color: var(--amber);
}

.grid :deep(.cp-end) {
  font-size: 12px;
  font-weight: 600;
  color: var(--olive, var(--teal));
}

.grid :deep(.cp-end.amber) {
  color: var(--amber);
}

.grid :deep(.amt) {
  font-variant-numeric: tabular-nums;
}

.grid :deep(.amt.warn) {
  color: var(--amber);
  font-weight: 600;
}

.grid :deep(.amt.zero) {
  color: var(--muted);
}

.grid :deep(.bill-btn) {
  font: inherit;
  font-size: 13px;
  border: 1px solid var(--teal);
  color: var(--teal);
  background: var(--surface);
  border-radius: var(--radius-m);
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
}

.grid :deep(.bill-btn:hover) {
  background: var(--teal-soft);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.quick {
  width: 300px;
}

.spacer {
  flex: 1;
}

.col-list {
  display: flex;
  flex-direction: column;
}

/* 表格填滿到頁面底部；視窗太矮時改回整頁捲動，表格固定高度 */
.fill-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--topbar-h));
  padding-bottom: 16px;
}

.fill-page > * {
  flex: none;
}

.grid {
  flex: 1 1 auto !important;
  min-height: 0;
}

@media (max-height: 640px) {
  .fill-page {
    height: auto;
  }

  .grid {
    flex: none !important;
    height: 420px;
  }
}

.views {
  width: 170px;
}

.grid :deep(.fps) {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.grid :deep(.fp) {
  padding: 1px 6px;
  border-radius: var(--radius-s);
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.grid :deep(.fp.part) {
  border-color: var(--teal);
  color: var(--teal);
}

.grid :deep(.fp.done) {
  background: var(--teal-soft);
  border-color: var(--teal-soft);
  color: var(--teal-ink, var(--teal));
}

.grid :deep(.fp-flag) {
  font-size: 12px;
  font-weight: 600;
}

.grid :deep(.fp-flag.amber) {
  color: var(--amber);
}

.grid :deep(.fp-flag.red) {
  color: var(--red);
}

.grid :deep(.sub) {
  font-size: 12px;
  line-height: 16px;
  color: var(--muted);
}

.grid :deep(.ellipsis) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grid :deep(.ag-cell) {
  line-height: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.grid :deep(.ag-cell-value) {
  min-width: 0;
}

.grid :deep(.tag.mini) {
  font-size: 11px;
  padding: 1px 5px;
  margin-left: 4px;
  vertical-align: middle;
}

.grid :deep(.stage-cell) {
  display: grid;
  align-content: center;
  gap: 7px;
  min-width: 124px;
}

.grid :deep(.stage-cell-heading) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 124px;
}

.grid :deep(.stage-cell-name) {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  color: var(--teal-ink, var(--teal));
  font-size: 13px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
}

.grid :deep(.stage-position) {
  flex: none;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 16px;
}

.grid :deep(.stage-position.check) {
  display: inline-grid;
  width: 16px;
  height: 16px;
  place-items: center;
  border-radius: 50%;
  background: var(--olive-soft);
  color: var(--olive);
  font-weight: 700;
}

.grid :deep(.stage-exception-label) {
  flex: none;
  color: var(--amber);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.grid :deep(.stage-cell--initial .stage-cell-name) {
  color: var(--muted);
}

.grid :deep(.stage-cell--waiting .stage-cell-name) {
  color: var(--amber);
}

.grid :deep(.stage-cell--complete .stage-cell-name),
.grid :deep(.stage-cell--closed .stage-cell-name) {
  color: var(--olive);
}
</style>
