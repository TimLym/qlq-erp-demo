<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { AgGridVue } from 'ag-grid-vue3'
import { themeQuartz, type ColDef, type GridApi, type GridReadyEvent, type RowClickedEvent } from 'ag-grid-community'
import { Setting } from '@element-plus/icons-vue'
import { deals, isOrderClosed, isGuarantee, orderTaxTotal, overduePay, type Order } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { themes } from '../../theme'
import { money, pct } from '../../utils/format'
import { supplyProgress, engProgress, canAccept, billingProgress, pctText } from '../../utils/execProgress'
import SoDrawer from '../../components/SoDrawer.vue'
import BillingRequestDialog from '../../components/BillingRequestDialog.vue'
import CollectNoticeDialog from '../../components/CollectNoticeDialog.vue'
import AcceptDialog from '../../components/AcceptDialog.vue'
import { useJump } from '../../composables/useJump'
import { CheckFilter } from '../../utils/checkFilter'

/*
 * 訂單列表（2026-11-17 規劃_訂單執行進度.md）：AG Grid，欄位可自訂、可存個人視圖。
 * 執行進度＝接單、採購（到客戶％，照未稅售價加權）、工程％、驗收；財務拆成待開票筆數、待收款筆數。
 * 篩選都在欄位標題（勾選式）；每列的動作按鈕給業務：開票（通知會計）、收款（通知會計催收）、驗收。
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

const today = new Date().toISOString().slice(0, 10)
const inactive = (o: Order) => isGuarantee(o) || !!o.voidedAt

/* 執行進度篩選：作廢、保證單、已結案互斥；其餘可疊加（例如合約變更中又未到客戶） */
const EXEC_OPTS = ['未下單完成', '未到客戶', '可驗收', '已驗收待工程結案', '已結案', '合約變更中', '保證單', '已作廢']
function matchExec(o: Order, f: string) {
  if (f === '已作廢') return !!o.voidedAt
  if (o.voidedAt) return false
  if (f === '保證單') return isGuarantee(o)
  if (isGuarantee(o)) return false
  if (isOrderClosed(o)) return f === '已結案'
  if (f === '已結案') return false
  if (f === '合約變更中') return !!o.changeQuoteId
  const s = supplyProgress(o)
  if (f === '未下單完成') return s.ordered !== null && s.ordered < 1
  if (f === '未到客戶') return s.delivered !== null && s.delivered < 1
  if (f === '可驗收') return canAccept(o).ok
  if (f === '已驗收待工程結案') return !!o.acceptedAt && !o.engClosedAt
  return true
}
const INV_OPTS = ['有待開票', '已通知待會計開票', '全部已開票']
function matchInv(o: Order, f: string) {
  if (inactive(o)) return false
  const b = billingProgress(o)
  if (f === '有待開票') return b.toInvoice > 0
  if (f === '已通知待會計開票') return o.milestones.some((m) => m.status === '已申請')
  if (f === '全部已開票') return b.count > 0 && b.toInvoice === 0
  return true
}
const COL_OPTS = ['有待收款', '逾期未收', '已收齊']
function matchCol(o: Order, f: string) {
  if (inactive(o)) return false
  const b = billingProgress(o)
  if (f === '有待收款') return b.toCollect > 0
  if (f === '逾期未收') return overduePay(o, today).length > 0
  if (f === '已收齊') return b.count > 0 && b.paidCount === b.count
  return true
}
/* 首頁等外部連結帶 ?fin=：對到待開票或待收款欄的篩選 */
const FIN_LINK: Record<string, [string, string]> = {
  逾期未收: ['toCollect', '逾期未收'],
  已開票未收: ['toCollect', '有待收款'],
  已開票未收款: ['toCollect', '有待收款'],
  有未開票: ['toInvoice', '有待開票'],
  待會計開票: ['toInvoice', '已通知待會計開票'],
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
const mmdd = (d?: string) => (d ? d.slice(5).replace('-', '/') : '')
const dash = '<span class="muted">—</span>'

/* 執行進度：接單、採購（到客戶％）、工程％（沒有工程不顯示）、驗收 */
function execRenderer(p: { data?: Order }) {
  const o = p.data
  if (!o) return ''
  if (o.voidedAt) return '<span class="tag slate">已作廢</span>'
  if (isGuarantee(o)) return `<span class="tag amber">保證單 · ${esc(o.guaranteeReason ?? '')}</span>`
  const s = supplyProgress(o)
  const e = engProgress(o)
  const step = (label: string, v: number | null) => (v === null ? '' : `<span class="cp${v >= 1 ? ' done' : v > 0 ? ' part' : ''}">${label} ${pctText(v)}</span>`)
  const acc = o.acceptedAt ? `<span class="cp done">驗收 ${mmdd(o.acceptedAt)}</span>` : canAccept(o).ok ? '<span class="cp ready">可驗收</span>' : '<span class="cp">驗收</span>'
  const tail = isOrderClosed(o) ? '<span class="cp-end">✓ 結案</span>' : o.changeQuoteId ? '<span class="cp-end amber">合約變更中</span>' : ''
  return `<div class="cps"><span class="cp done">接單</span>${step('採購', s.delivered)}${step('工程', e?.pct ?? null)}${acc}${tail}</div>`
}
/* 待開票筆數：還沒開票的期數；已通知會計的另外標 */
function invRenderer(p: { data?: Order }) {
  const o = p.data
  if (!o) return ''
  if (inactive(o) || !store.canSeeOrderMoney(o)) return dash
  const b = billingProgress(o)
  const asked = o.milestones.filter((m) => m.status === '已申請').length
  return `<span class="cnt${b.toInvoice ? ' warn' : ' zero'}">${b.toInvoice}</span>${asked ? `<span class="fp-flag amber">已通知 ${asked}</span>` : ''}`
}
/* 待收款筆數：已開票未收款的期數；逾期標紅 */
function colRenderer(p: { data?: Order }) {
  const o = p.data
  if (!o) return ''
  if (inactive(o) || !store.canSeeOrderMoney(o)) return dash
  const b = billingProgress(o)
  const late = overduePay(o, today).length
  return `<span class="cnt${b.toCollect ? '' : ' zero'}">${b.toCollect}</span>${late ? `<span class="fp-flag red">逾期 ${late}</span>` : ''}`
}
/* 開票進度、收款進度（含稅） */
const progRenderer = (kind: 'inv' | 'pay') => (p: { data?: Order }) => {
  const o = p.data
  if (!o) return ''
  if (inactive(o) || !store.canSeeOrderMoney(o)) return dash
  const b = billingProgress(o)
  const [done, n, ratio, k] = kind === 'inv' ? [b.invoiced, b.invCount, b.invoicedPct, '開票'] : [b.paid, b.paidCount, b.paidPct, '收款']
  return `<div class="prog"><span class="amt">${money(done)} / ${money(b.total)}</span><span class="sub">${k} ${n}/${b.count} 期 · ${pct(ratio, 0)}</span></div>`
}
const moneyCell = (get: (o: Order) => number) => (p: { data?: Order }) => (!p.data ? '' : isGuarantee(p.data) || !store.canSeeOrderMoney(p.data) ? dash : `<span class="amt">${money(get(p.data))}</span>`)

/* 動作按鈕：負責業務、業務主管、執行長 */
const canAct = (o: Order) => store.can('/sales/orders', 'edit') && !inactive(o) && (['業務主管', '執行長'].includes(store.role) || (store.role === '業務' && o.owner === store.currentUser.name))
function actRenderer(p: { data?: Order }) {
  const o = p.data
  if (!o || !canAct(o)) return ''
  const bill = o.milestones.some((m) => m.status === '待請款')
  const collect = o.milestones.some((m) => m.status === '已開票')
  const acc = canAccept(o)
  const btn = (act: string, label: string, on: boolean, title = '') => `<button type="button" class="act-btn" data-act="${act}"${on ? '' : ' disabled'}${title ? ` title="${esc(title)}"` : ''}>${label}</button>`
  return `<div class="acts">${btn('bill', '開票', bill, bill ? '通知會計開票' : '沒有待開票的期數')}${btn('collect', '收款', collect, collect ? '通知會計收款／催收' : '沒有已開票待收款的期數')}${o.acceptedAt ? '' : btn('accept', '驗收', acc.ok, acc.ok ? '整案驗收' : acc.reason)}</div>`
}

const isRenewal = (o: Order) => !!deals.find((d) => d.id === o.dealId)?.renewalOfDealId
const marginOf = (o: Order) => (o.amount ? (o.amount - o.cost) / o.amount : 0)
const marginTip = (o: Order) => (salesOnly.value ? '' : `業務毛利率 ${pct(marginOf(o))}；公司毛利率 ${o.actualCost === undefined ? '—（PO 核准後寫回）' : pct((o.amount - o.actualCost) / o.amount)}${o.actualCost !== undefined && o.actualCost !== o.cost ? `；成本差異 ${o.actualCost > o.cost ? '+' : '−'}${money(Math.abs(o.actualCost - o.cost))}` : ''}`)
const dealLink = (o: Order) => (store.can('/sales/pipeline') ? `<a class="link" data-deal="${o.dealNo}">${o.dealNo}</a>` : o.dealNo)
const custHtml = (o: Order) => `<b>${esc(o.customer)}</b>${isRenewal(o) ? ' <span class="tag slate mini">續約</span>' : ''}`

const allColumnDefs = (): ColDef<Order>[] => [
  /* 組合欄（一欄兩行）與子欄（各自一欄）：欄位設定裡互斥，預設子欄「訂單編號」「客戶」 */
  { colId: 'soCombo', headerName: '訂單／商機編號', width: 172, pinned: 'left', hide: true, valueGetter: (p) => p.data?.soNo, cellClass: 'num', getQuickFilterText: (p) => `${p.data?.soNo ?? ''} ${p.data?.dealNo ?? ''}`, cellRenderer: (p: { data?: Order }) => (p.data ? `${p.data.soNo}<div class="sub">${dealLink(p.data)}</div>` : '') },
  { field: 'soNo', headerName: '訂單編號', width: 168, pinned: 'left', cellClass: 'num' },
  { field: 'dealNo', headerName: '商機編號', width: 160, hide: true, cellClass: 'num', cellRenderer: (p: { data?: Order }) => (p.data ? dealLink(p.data) : '') },
  { colId: 'custCombo', headerName: '客戶／需求摘要', flex: 1, minWidth: 280, hide: true, valueGetter: (p) => p.data?.customer, getQuickFilterText: (p) => `${p.data?.customer ?? ''} ${p.data?.product ?? ''}`, cellRenderer: (p: { data?: Order }) => (p.data ? `${custHtml(p.data)}<div class="sub ellipsis" title="${esc(p.data.product)}">${esc(p.data.product)}</div>` : '') },
  { field: 'customer', headerName: '客戶', flex: 1, minWidth: 180, cellRenderer: (p: { data?: Order }) => (p.data ? custHtml(p.data) : '') },
  { field: 'product', headerName: '需求摘要', width: 260, hide: true, tooltipField: 'product' },
  { field: 'owner', headerName: '負責業務', width: 104 },
  { field: 'amount', headerName: '訂單金額（未稅）', width: 150, type: 'rightAligned', filter: 'agNumberColumnFilter', cellRenderer: moneyCell((o) => o.amount) },
  { colId: 'amountTax', headerName: '訂單金額（含稅）', width: 150, hide: true, type: 'rightAligned', filter: 'agNumberColumnFilter', valueGetter: (p) => (p.data ? orderTaxTotal(p.data) : 0), cellRenderer: moneyCell((o) => orderTaxTotal(o)) },
  { colId: 'marginAmt', headerName: salesOnly.value ? '業務毛利金額' : '毛利金額', width: 132, hide: true, type: 'rightAligned', filter: 'agNumberColumnFilter', valueGetter: (p) => (p.data ? p.data.amount - p.data.cost : 0), cellRenderer: moneyCell((o) => o.amount - o.cost), tooltipValueGetter: (p) => (p.data ? marginTip(p.data) : '') },
  { colId: 'margin', headerName: salesOnly.value ? '業務毛利率' : '毛利率', width: 112, type: 'rightAligned', filter: 'agNumberColumnFilter', valueGetter: (p) => (p.data ? marginOf(p.data) : 0), valueFormatter: (p) => pct(p.value), cellClass: 'num', tooltipValueGetter: (p) => (p.data ? marginTip(p.data) : '') },
  { colId: 'exec', headerName: '執行進度', width: 330, sortable: false, cellRenderer: execRenderer, cellClass: 'cp-col', filter: CheckFilter, filterParams: { options: EXEC_OPTS, match: matchExec } },
  { colId: 'toInvoice', headerName: '待開票筆數', width: 132, type: 'rightAligned', valueGetter: (p) => (p.data && !inactive(p.data) ? billingProgress(p.data).toInvoice : -1), cellRenderer: invRenderer, filter: CheckFilter, filterParams: { options: INV_OPTS, match: matchInv } },
  { colId: 'invProgress', headerName: '開票進度（含稅）', width: 210, hide: true, filter: false, valueGetter: (p) => (p.data && !inactive(p.data) ? billingProgress(p.data).invoicedPct : -1), cellRenderer: progRenderer('inv') },
  { colId: 'toCollect', headerName: '待收款筆數', width: 132, type: 'rightAligned', valueGetter: (p) => (p.data && !inactive(p.data) ? billingProgress(p.data).toCollect : -1), cellRenderer: colRenderer, filter: CheckFilter, filterParams: { options: COL_OPTS, match: matchCol } },
  { colId: 'payProgress', headerName: '收款進度（含稅）', width: 210, hide: true, filter: false, valueGetter: (p) => (p.data && !inactive(p.data) ? billingProgress(p.data).paidPct : -1), cellRenderer: progRenderer('pay') },
  { colId: 'actions', headerName: '動作', width: 196, filter: false, sortable: false, cellRenderer: actRenderer },
]
/* 金額類欄位：工程角色直接不給（欄位設定也看不到），切換示範身分時重建 */
const MONEY_COLS = new Set(['amount', 'amountTax', 'marginAmt', 'margin', 'toInvoice', 'invProgress', 'toCollect', 'payProgress', 'actions'])
const idOf = (c: ColDef<Order>) => (c.colId ?? c.field) as string
const columnDefs = computed(() => allColumnDefs().filter((c) => !(engView.value && MONEY_COLS.has(idOf(c)))))
/* 欄位設定：組合欄底下列子欄；其他照順序 */
const COMBOS: { id: string; children: string[] }[] = [
  { id: 'soCombo', children: ['soNo', 'dealNo'] },
  { id: 'custCombo', children: ['customer', 'product'] },
]
const colTree = computed(() => {
  const label = (id: string) => (columnDefs.value.find((c) => idOf(c) === id)?.headerName as string) ?? id
  const childIds = new Set(COMBOS.flatMap((g) => g.children))
  return columnDefs.value
    .map((c) => idOf(c))
    .filter((id) => !childIds.has(id))
    .map((id) => ({ id, label: label(id), children: (COMBOS.find((g) => g.id === id)?.children ?? []).map((x) => ({ id: x, label: label(x) })) }))
})
const defaultColDef: ColDef = { sortable: true, filter: true, resizable: true }
const quick = ref('')
const api = shallowRef<GridApi<Order> | null>(null)
function onReady(e: GridReadyEvent<Order>) {
  api.value = e.api
  const saved = views.value.find((v) => v.isDefault)
  if (saved) applyView(saved.name)
  const rawFin = typeof route.query.fin === 'string' ? route.query.fin : ''
  if (rawFin) {
    const target = FIN_LINK[rawFin]
    if (!engView.value && target)
      e.api
        .setColumnFilterModel(target[0], { values: [target[1]] })
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

/* 欄位顯示設定：勾組合欄就關掉子欄，勾子欄就關掉組合欄 */
const colVisible = ref<Record<string, boolean>>({})
function syncColVisible() {
  const state = api.value?.getColumnState() ?? []
  const next: Record<string, boolean> = {}
  state.forEach((s) => (next[s.colId] = !s.hide))
  colVisible.value = next
}
function toggleCol(colId: string, visible: boolean) {
  if (!api.value) return
  const combo = COMBOS.find((g) => g.id === colId)
  const parent = COMBOS.find((g) => g.children.includes(colId))
  api.value.setColumnsVisible([colId], visible)
  if (visible && combo) api.value.setColumnsVisible(combo.children, false)
  if (visible && parent) api.value.setColumnsVisible([parent.id], false)
  syncColVisible()
}

/* 個人視圖（比照 Pipeline）：存在瀏覽器，正式版存 core.user_view（jsonb） */
interface SavedView {
  name: string
  isDefault?: boolean
  columnState: unknown
  filterModel: unknown
  quick: string
}
/* 切換示範身分時整頁會重新掛載（AppShell 的 RouterView key），所以這裡用掛載當下的身分即可；
 * 欄位改版後舊視圖的欄位對不上，換一個 key（v2）重新開始 */
const VIEW_KEY = `erp.orders.views.v2.${store.currentUserId}`
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

/* 抽屜：底部全幅，全站統一（Pipeline、CRM、訂單） */
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
const billing = ref<Order | null>(null)
const collecting = ref<Order | null>(null)
const accepting = ref<Order | null>(null)
function onRowClicked(e: RowClickedEvent<Order>) {
  /* 點商機編號：開商機抽屜，不開訂單抽屜 */
  const target = (e.event as MouseEvent | undefined)?.target as HTMLElement | null
  const dl = target?.closest?.('a[data-deal]') as HTMLElement | null
  if (dl?.dataset.deal) {
    goDealNo(dl.dataset.deal)
    return
  }
  const act = target?.closest?.('button[data-act]') as HTMLButtonElement | null
  if (act && e.data) {
    if (act.disabled) return
    /* 表格給的是列資料的複本，動作要改原本的訂單（store 裡那一份） */
    const o = store.scopedOrders.find((x) => x.id === e.data!.id)
    if (!o) return
    if (act.dataset.act === 'bill') billing.value = o
    if (act.dataset.act === 'collect') collecting.value = o
    if (act.dataset.act === 'accept') accepting.value = o
    return
  }
  /* 停用的動作按鈕點下去不開抽屜 */
  if (target?.closest?.('.acts')) return
  if (e.data) openId.value = e.data.id
}
function refresh() {
  api.value?.refreshCells({ force: true })
  onFilterChanged()
}
function close() {
  openId.value = null
  api.value?.deselectAll()
  refresh()
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
      <el-input v-model="quick" placeholder="搜尋訂單、商機、客戶、內容、業務" clearable class="quick" />
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
          <template v-for="c in colTree" :key="c.id">
            <el-checkbox :model-value="!!colVisible[c.id]" @update:model-value="(v: boolean | string | number) => toggleCol(c.id, !!v)">{{ c.label }}</el-checkbox>
            <el-checkbox v-for="x in c.children" :key="x.id" class="child" :model-value="!!colVisible[x.id]" @update:model-value="(v: boolean | string | number) => toggleCol(x.id, !!v)">{{ x.label }}</el-checkbox>
          </template>
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
        :overlay-no-rows-template="!filtered ? '<span class=\'muted\'>目前沒有訂單。商機完成上單核准後，訂單會出現在這裡。</span>' : '<span class=\'muted\'>沒有符合此篩選條件的訂單。</span>'"
        style="height: 100%"
        @grid-ready="onReady"
        @filter-changed="onFilterChanged"
        @row-data-updated="onFilterChanged"
        @row-clicked="onRowClicked"
      />
    </div>

    <SoDrawer :order-id="openId" @close="close" />
    <BillingRequestDialog :order="billing" @close="billing = null; refresh()" />
    <CollectNoticeDialog :order="collecting" @close="collecting = null; refresh()" />
    <AcceptDialog :order="accepting" @close="accepting = null; refresh()" />
  </div>
</template>

<style scoped>
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
  font-variant-numeric: tabular-nums;
}

.grid :deep(.cp.part) {
  border-color: var(--teal);
  color: var(--teal);
}

.grid :deep(.cp.done) {
  background: var(--teal-soft);
  border-color: var(--teal-soft);
  color: var(--teal-ink, var(--teal));
}

.grid :deep(.cp.ready) {
  background: var(--amber-soft);
  border: 1px dashed var(--amber);
  color: var(--amber);
  font-weight: 600;
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

.grid :deep(.cnt) {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.grid :deep(.cnt.warn) {
  color: var(--amber);
}

.grid :deep(.cnt.zero) {
  color: var(--muted);
  font-weight: 400;
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

.grid :deep(.prog) {
  display: flex;
  flex-direction: column;
  line-height: 18px;
}

.grid :deep(.acts) {
  display: flex;
  gap: 6px;
}

.grid :deep(.act-btn) {
  font: inherit;
  font-size: 13px;
  border: 1px solid var(--teal);
  color: var(--teal);
  background: var(--surface);
  border-radius: var(--radius-m);
  padding: 3px 9px;
  cursor: pointer;
  white-space: nowrap;
}

.grid :deep(.act-btn:hover:not(:disabled)) {
  background: var(--teal-soft);
}

.grid :deep(.act-btn:disabled) {
  border-color: var(--line);
  color: var(--muted);
  cursor: not-allowed;
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

.col-list .child {
  margin-left: 22px;
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
</style>
