<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
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
 * 篩選：執行面看檢查點、財務面看金額，兩個下拉可交叉；上方快捷標籤是業務每天要追的三件事。
 * 階段不是一步一步走，所以不用 stepper。
 */
const today = new Date().toISOString().slice(0, 10)
const execOptions = ['全部', '未下單', '未到貨', '未出貨', '待驗收', '已驗收未結案', '結案', '保證單'] as const
const finOptions = ['全部', '有未開票', '已開票未收款', '逾期未收', '已收齊'] as const
const execFilter = ref<string>('全部')
const finFilter = ref<string>(typeof route.query.fin === 'string' && (finOptions as readonly string[]).includes(route.query.fin) ? route.query.fin : '全部')
function matchExec(o: Order, f: string) {
  if (f === '全部') return true
  if (f === '保證單') return isGuarantee(o)
  if (isGuarantee(o)) return false
  const cp = Object.fromEntries(checkpointsOf(o).map((c) => [c.key, c.done]))
  const closed = isOrderClosed(o)
  if (f === '未下單') return !cp.order
  if (f === '未到貨') return !!cp.order && !cp.arrive
  if (f === '未出貨') return !cp.ship
  if (f === '待驗收') return !!cp.ship && !cp.accept
  if (f === '已驗收未結案') return !!cp.accept && !closed
  if (f === '結案') return closed
  return true
}
function matchFin(o: Order, f: string) {
  if (f === '全部') return true
  if (isGuarantee(o)) return false
  const b = billingOf(o)
  if (f === '有未開票') return b.uninvoiced > 0
  if (f === '已開票未收款') return b.invoicedUnpaid > 0
  if (f === '逾期未收') return overduePay(o, today).length > 0
  if (f === '已收齊') return b.paid >= b.total
  return true
}
const countFin = (f: string) => store.scopedOrders.filter((o) => matchExec(o, execFilter.value) && matchFin(o, f)).length
const rowData = computed(() => store.scopedOrders.filter((o) => matchExec(o, execFilter.value) && matchFin(o, finFilter.value)))
const filterSummary = computed(() => [execFilter.value !== '全部' ? execFilter.value : '', finFilter.value !== '全部' ? finFilter.value : ''].filter(Boolean).join(' × '))
function resetFilters() {
  execFilter.value = '全部'
  finFilter.value = '全部'
  quick.value = ''
  api.value?.setFilterModel(null)
  api.value?.resetColumnState()
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
const canBill = (o: Order) => !isGuarantee(o) && o.milestones.some((m) => m.status === '待請款') && (['業務主管', '執行長'].includes(store.role) || (store.role === '業務' && o.owner === store.currentUser.name))
const billCell = (p: { data?: Order }) => (p.data && canBill(p.data) ? '<button type="button" class="bill-btn" data-bill="1">通知開票</button>' : '')
const isRenewal = (o: Order) => !!deals.find((d) => d.id === o.dealId)?.renewalOfDealId
const marginOf = (o: Order) => (o.amount ? (o.amount - o.cost) / o.amount : 0)
const marginTip = (o: Order) => (salesOnly.value ? '' : `業務毛利率 ${pct(marginOf(o))}；公司毛利率 ${o.actualCost === undefined ? '—（PO 核准後寫回）' : pct((o.amount - o.actualCost) / o.amount)}${o.actualCost !== undefined && o.actualCost !== o.cost ? `；成本差異 ${o.actualCost > o.cost ? '+' : '−'}${money(Math.abs(o.actualCost - o.cost))}` : ''}`)

const allColumnDefs = (): ColDef<Order>[] => [
  { field: 'soNo', headerName: 'SO 編號', width: 172, pinned: 'left', cellClass: 'num', cellRenderer: (p: { data?: Order; value: string }) => (p.data ? `${p.value}<div class="sub"><a class="link" data-deal="${p.data.dealNo}">${p.data.dealNo}</a></div>` : '') },
  { field: 'customer', headerName: '客戶 / 內容', flex: 1, minWidth: 300, cellRenderer: (p: { data?: Order; value: string }) => (p.data ? `<b>${esc(p.value)}</b>${isRenewal(p.data) ? ' <span class="tag slate mini">續約</span>' : ''}<div class="sub ellipsis" title="${esc(p.data.product)}">${esc(p.data.product)}</div>` : '') },
  { field: 'owner', headerName: '業務', width: 104 },
  { field: 'amount', headerName: '訂單金額', hide: true, width: 136, type: 'rightAligned', valueFormatter: (p) => money(p.value), cellClass: 'num' },
  { colId: 'margin', hide: true, headerName: salesOnly.value ? '業務毛利率' : '毛利率', width: 112, type: 'rightAligned', valueGetter: (p) => (p.data ? marginOf(p.data) : 0), valueFormatter: (p) => pct(p.value), cellClass: 'num', tooltipValueGetter: (p) => (p.data ? marginTip(p.data) : '') },
  { colId: 'exec', headerName: '執行', width: 300, filter: false, sortable: false, cellRenderer: cpRenderer, cellClass: 'cp-col' },
  { colId: 'uninvoiced', headerName: '未開票（含稅）', width: 140, type: 'rightAligned', filter: false, valueGetter: amtValue('uninvoiced'), cellRenderer: amtCell('uninvoiced') },
  { colId: 'invoicedUnpaid', headerName: '已開票未收', width: 130, type: 'rightAligned', filter: false, valueGetter: amtValue('invoicedUnpaid'), cellRenderer: amtCell('invoicedUnpaid') },
  { colId: 'paid', headerName: '已收款', width: 130, type: 'rightAligned', filter: false, valueGetter: amtValue('paid'), cellRenderer: amtCell('paid') },
  { colId: 'bill', headerName: '通知開票', width: 112, filter: false, sortable: false, cellRenderer: billCell },
  { field: 'product', headerName: '產品', width: 240, hide: true },
  { field: 'dealNo', headerName: '商機編號', width: 150, hide: true },
]
/* 金額類欄位：工程角色直接不給（欄位設定也看不到），切換示範身分時重建 */
const MONEY_COLS = new Set(['amount', 'margin', 'uninvoiced', 'invoicedUnpaid', 'paid'])
const columnDefs = computed<ColDef<Order>[]>(() => allColumnDefs().filter((c) => !(engView.value && MONEY_COLS.has((c.colId ?? c.field) as string))))
const defaultColDef: ColDef = { sortable: true, filter: true, resizable: true }
const quick = ref('')
const api = shallowRef<GridApi<Order> | null>(null)
function onReady(e: GridReadyEvent<Order>) {
  api.value = e.api
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
const colLabels = computed(() => columnDefs.value.map((c) => ({ id: (c.colId ?? c.field) as string, label: c.headerName as string })))

/* 抽屜：底部全幅，全站統一（Pipeline、CRM、SO） */
const openId = ref<string | null>(null)
watch(
  () => route.query.so,
  (so) => {
    if (!so) return
    const o = store.scopedOrders.find((x) => x.soNo === String(so))
    if (o) openId.value = o.id
    /* 開了就把網址的 ?so= 清掉；不能等關抽屜才清，否則抽屜裡 push 去別頁後緊接的 replace 會把那次跳轉蓋掉 */
    router.replace({ query: {} })
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
  <div class="page">
    <div class="page-head">
      <div>
        <h1>銷售訂單（SO）</h1>
      </div>
    </div>

    <div class="filters">
      <label class="f">執行
        <el-select v-model="execFilter" size="default" style="width: 150px">
          <el-option v-for="x in execOptions" :key="x" :value="x" :label="x" />
        </el-select>
      </label>
      <label class="f">財務
        <el-select v-model="finFilter" size="default" style="width: 150px">
          <el-option v-for="x in finOptions" :key="x" :value="x" :label="x" />
        </el-select>
      </label>
      <span class="sep"></span>
      <button v-for="x in ['有未開票', '已開票未收款', '逾期未收']" :key="x" type="button" class="quick-chip" :class="{ on: finFilter === x, hot: x !== '已開票未收款' && countFin(x) > 0 }" @click="finFilter = finFilter === x ? '全部' : x">{{ x }} <b>{{ countFin(x) }}</b></button>
      <span v-if="!engView" class="muted small tax">金額為含稅</span>
    </div>

    <div class="toolbar">
      <el-input v-model="quick" placeholder="搜尋 SO、商機、客戶、內容、業務" clearable class="quick" />
      <span class="muted small">{{ filterSummary ? `${filterSummary}　` : '' }}共 {{ rowData.length }} 筆</span>
      <el-button v-if="filterSummary || quick" text @click="resetFilters">重設</el-button>
      <span class="spacer"></span>
      <el-popover trigger="click" width="220" placement="bottom-end" @show="syncColVisible">
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
        :overlay-no-rows-template="execFilter === '全部' && finFilter === '全部' && !quick ? '<span class=\'muted\'>目前沒有銷售訂單。商機完成上單核准後，SO 會出現在這裡。</span>' : '<span class=\'muted\'>沒有符合此篩選條件的訂單。</span>'"
        style="height: 100%"
        @grid-ready="onReady"
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

.grid {
  height: calc(100vh - var(--topbar-h) - 260px);
  min-height: 360px;
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
