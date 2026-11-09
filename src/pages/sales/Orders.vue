<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AgGridVue } from 'ag-grid-vue3'
import { themeQuartz, type ColDef, type GridApi, type GridReadyEvent, type RowClickedEvent } from 'ag-grid-community'
import { Setting } from '@element-plus/icons-vue'
import { deals, execStages, financeStages, financeStageOf, isOrderClosed, soFocusOf, type Order } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { themes } from '../../theme'
import { money, pct } from '../../utils/format'
import { stageTrackHtml, execToneOf, finToneOf } from '../../utils/stageTrack'
import SoDrawer from '../../components/SoDrawer.vue'
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

/* 階段名稱：執行階段看 stageIndex（結案另列），財務階段看里程碑 */
const execName = (o: Order) => (isOrderClosed(o) ? '結案' : execStages[o.stageIndex]!)
const finName = (o: Order) => financeStages[financeStageOf(o.milestones)]!
/* 篩選列是可點的流程 stepper：節點＝件數圓圈＋名稱，節點間細線；「全部」在左、終態「結案」在右，都不是流程節點 */
const execPassed = (i: number) => execFilter.value !== '全部' && execFilter.value !== '結案' && i <= execStages.indexOf(execFilter.value as (typeof execStages)[number])
const finPassed = (i: number) => finFilter.value !== '全部' && i <= financeStages.indexOf(finFilter.value as (typeof financeStages)[number])
const execFilter = ref<string>('全部')
const finFilter = ref<string>('全部')
const matchExec = (o: Order, f: string) => f === '全部' || execName(o) === f
const matchFin = (o: Order, f: string) => f === '全部' || finName(o) === f
const countExec = (f: string) => store.scopedOrders.filter((o) => matchExec(o, f) && matchFin(o, finFilter.value)).length
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
/* 階段 cell：上面是當前階段名稱＋第 n/7 步，下面是分段軌道；tone 決定顏色語意（見 utils/stageTrack） */
function execRenderer(p: { data?: Order }) {
  const o = p.data
  if (!o) return ''
  const closed = isOrderClosed(o)
  const tone = execToneOf(o)
  const name = closed ? '結案' : execStages[o.stageIndex]!
  const title = tone === 'exception' ? `合約變更中，停在「${name}」；下一步：${soFocusOf(o).next}` : closed ? '執行與財務都完成' : `下一步：${soFocusOf(o).next}`
  const right = tone === 'exception' ? '<span class="stage-exception-label">合約變更中</span>' : closed ? '<span class="stage-position check">✓</span>' : `<span class="stage-position">${o.stageIndex + 1}/${execStages.length}</span>`
  return `<div class="stage-cell stage-cell--${tone}" title="${esc(title)}"><div class="stage-cell-heading"><span class="stage-cell-name"><i class="stage-state-dot"></i>${name}</span>${right}</div>${stageTrackHtml(execStages.length, o.stageIndex, tone, 'cell')}</div>`
}
function finRenderer(p: { data?: Order }) {
  const o = p.data
  if (!o) return ''
  const idx = financeStageOf(o.milestones)
  const tone = finToneOf(o)
  const name = tone === 'waiting' ? '待會計開票' : finName(o)
  const inv = o.milestones.filter((m) => m.status === '已開票' || m.status === '已收款').length
  const paid = o.milestones.filter((m) => m.status === '已收款').length
  const right = tone === 'closed' ? '<span class="stage-position check">✓</span>' : `<span class="stage-position">${idx + 1}/${financeStages.length}</span>`
  return `<div class="stage-cell stage-cell--${tone}" title="開票 ${inv}/${o.milestones.length} · 收款 ${paid}/${o.milestones.length}"><div class="stage-cell-heading"><span class="stage-cell-name"><i class="stage-state-dot"></i>${name}</span>${right}</div>${stageTrackHtml(financeStages.length, idx, tone, 'cell')}</div>`
}
const isRenewal = (o: Order) => !!deals.find((d) => d.id === o.dealId)?.renewalOfDealId
const marginOf = (o: Order) => (o.amount ? (o.amount - o.cost) / o.amount : 0)
const marginTip = (o: Order) => (salesOnly.value ? '' : `業務毛利率 ${pct(marginOf(o))}；公司毛利率 ${o.actualCost === undefined ? '—（PO 核准後寫回）' : pct((o.amount - o.actualCost) / o.amount)}${o.actualCost !== undefined && o.actualCost !== o.cost ? `；成本差異 ${o.actualCost > o.cost ? '+' : '−'}${money(Math.abs(o.actualCost - o.cost))}` : ''}`)

const columnDefs = ref<ColDef<Order>[]>([
  { field: 'soNo', headerName: 'SO 編號', width: 172, pinned: 'left', cellClass: 'num', cellRenderer: (p: { data?: Order; value: string }) => (p.data ? `${p.value}<div class="sub"><a class="link" data-deal="${p.data.dealNo}">${p.data.dealNo}</a></div>` : '') },
  { field: 'customer', headerName: '客戶 / 內容', flex: 1, minWidth: 300, cellRenderer: (p: { data?: Order; value: string }) => (p.data ? `<b>${esc(p.value)}</b>${isRenewal(p.data) ? ' <span class="tag slate mini">續約</span>' : ''}<div class="sub ellipsis" title="${esc(p.data.product)}">${esc(p.data.product)}</div>` : '') },
  { field: 'owner', headerName: '業務', width: 104 },
  { field: 'amount', headerName: '訂單金額', width: 136, type: 'rightAligned', valueFormatter: (p) => money(p.value), cellClass: 'num' },
  { colId: 'margin', headerName: salesOnly.value ? '業務毛利率' : '毛利率', width: 112, type: 'rightAligned', valueGetter: (p) => (p.data ? marginOf(p.data) : 0), valueFormatter: (p) => pct(p.value), cellClass: 'num', tooltipValueGetter: (p) => (p.data ? marginTip(p.data) : '') },
  { colId: 'exec', headerName: '執行階段', width: 184, valueGetter: (p) => (p.data ? (isOrderClosed(p.data) ? 7 : p.data.stageIndex) : 0), comparator: (a: number, b: number) => a - b, filter: false, cellRenderer: execRenderer, cellClass: 'stage-col' },
  { colId: 'fin', headerName: '財務階段', width: 168, valueGetter: (p) => (p.data ? financeStageOf(p.data.milestones) : 0), comparator: (a: number, b: number) => a - b, filter: false, cellRenderer: finRenderer, cellClass: 'stage-col' },
  { field: 'product', headerName: '產品', width: 240, hide: true },
  { field: 'dealNo', headerName: '商機編號', width: 150, hide: true },
])
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
  if (e.data) openId.value = e.data.id
}
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

    <div class="stage-nav">
      <div class="stage-row">
        <span class="stage-row-label">執行階段</span>
        <button type="button" class="stage-all" :class="{ on: execFilter === '全部' }" @click="execFilter = '全部'">全部<span class="n">{{ countExec('全部') }}</span></button>
        <div class="stepper">
          <template v-for="(c, i) in execStages" :key="c">
            <span v-if="i > 0" class="link" :class="{ lit: execPassed(i) }"></span>
            <button type="button" class="node" :class="{ on: execFilter === c, passed: execPassed(i) && execFilter !== c, zero: countExec(c) === 0 && execFilter !== c }" :title="`第 ${i + 1} 步 ${c}`" @click="execFilter = c"><span class="dot">{{ countExec(c) }}</span><span class="lbl">{{ c }}</span></button>
          </template>
        </div>
        <button type="button" class="node terminal" :class="{ on: execFilter === '結案', zero: countExec('結案') === 0 && execFilter !== '結案' }" title="執行與財務都完成的訂單" @click="execFilter = '結案'"><span class="dot">✓</span><span class="lbl">結案<span class="n">{{ countExec('結案') }}</span></span></button>
      </div>
      <div class="stage-row">
        <span class="stage-row-label">財務階段</span>
        <button type="button" class="stage-all" :class="{ on: finFilter === '全部' }" @click="finFilter = '全部'">全部<span class="n">{{ countFin('全部') }}</span></button>
        <div class="stepper">
          <template v-for="(c, i) in financeStages" :key="c">
            <span v-if="i > 0" class="link" :class="{ lit: finPassed(i) }"></span>
            <button type="button" class="node" :class="{ on: finFilter === c, passed: finPassed(i) && finFilter !== c, zero: countFin(c) === 0 && finFilter !== c }" :title="`第 ${i + 1} 步 ${c}`" @click="finFilter = c"><span class="dot">{{ countFin(c) }}</span><span class="lbl">{{ c }}</span></button>
          </template>
        </div>
      </div>
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
  </div>
</template>

<style scoped>
/* 階段 stepper：節點＝件數圓圈＋名稱；選到某步，該步圓圈實心、走過的圓圈與線變 teal */
.stage-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 12px;
}

.stage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
}

.stage-row-label {
  width: 64px;
  flex: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.stage-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  font: inherit;
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
}

.stage-all:hover {
  border-color: var(--teal);
  color: var(--teal-ink, var(--teal));
}

.stage-all.on {
  border-color: var(--teal);
  background: var(--teal-soft);
  color: var(--teal-ink, var(--teal));
  font-weight: 600;
}

.n {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  text-align: center;
}

.stage-all.on .n,
.node.on .n {
  background: var(--surface);
  color: inherit;
}

.stepper {
  display: flex;
  align-items: center;
  margin-left: 6px;
}

.link {
  width: 26px;
  height: 2px;
  background: var(--line);
  flex: none;
}

.link.lit {
  background: var(--teal);
}

.node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px 3px 3px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: var(--ink);
  cursor: pointer;
  transition: color 160ms ease, background-color 160ms ease;
}

.node .dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid var(--line-strong);
  background: var(--surface);
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease;
}

.node:hover {
  background: var(--teal-soft);
}

.node:hover .dot,
.node.passed .dot {
  border-color: var(--teal);
  color: var(--teal-ink, var(--teal));
}

.node.passed .lbl {
  color: var(--teal-ink, var(--teal));
}

.node.on {
  background: var(--teal-soft);
}

.node.on .dot {
  background: var(--teal);
  border-color: var(--teal);
  color: #fff;
}

.node.on .lbl {
  color: var(--teal-ink, var(--teal));
  font-weight: 600;
}

/* 0 件：圓圈虛線、文字淡，但仍可點 */
.node.zero .dot {
  border-style: dashed;
  border-color: var(--line);
  background: var(--surface-2);
}

.node.zero .lbl {
  color: var(--muted);
}

/* 終態「結案」：勾號、橄欖色，跟流程節點隔開 */
.node.terminal {
  margin-left: 18px;
}

.node.terminal .lbl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.node.terminal .dot {
  border-color: var(--olive);
  background: var(--olive-soft);
  color: var(--olive);
}

.node.terminal:hover {
  background: var(--olive-soft);
}

.node.terminal.on {
  background: var(--olive-soft);
}

.node.terminal.on .dot {
  background: var(--olive);
  color: #fff;
}

.node.terminal.on .lbl {
  color: var(--olive);
  font-weight: 600;
}

.node.terminal.zero .dot {
  border-style: dashed;
  border-color: var(--line);
  background: var(--surface-2);
  color: var(--muted);
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
