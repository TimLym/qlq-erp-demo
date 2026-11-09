<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { orders, deals, quotes, purchaseOrders, stock, type PurchaseOrder, type PoLine, type Role, quoteTotal } from '../mock/data'
import { routing, evaluate } from '../mock/routing'
import { useAppStore } from '../stores/app'
import { money } from '../utils/format'

const props = defineProps<{ modelValue: boolean; soNo?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'created', poNos: string[]): void }>()
const store = useAppStore()

/* 來源：接單到已入庫之間、還沒建 PO 的訂單；或勾了預下單、還沒上單的商機 */
type Source = { key: string; label: string; soNo: string; customer: string; dealId: string; quoteId?: string; preOrder: boolean; orderId?: string }
const sources = computed<Source[]>(() => {
  const list: Source[] = []
  orders
    .filter((o) => o.stageIndex <= 3 && !purchaseOrders.some((p) => p.soNo === o.soNo))
    .forEach((o) => list.push({ key: o.soNo, label: `${o.soNo} ${o.customer}`, soNo: o.soNo, customer: o.customer, dealId: o.dealId, quoteId: o.quoteId, preOrder: false, orderId: o.id }))
  deals
    .filter((d) => d.preOrder && d.stage !== 'SO已成立' && d.stage !== '未成交' && !purchaseOrders.some((p) => p.soNo === `預下單 ${d.dealNo}`))
    .forEach((d) => {
      const q = quotes.filter((x) => x.dealId === d.id && x.status !== '草稿').sort((a, b) => b.version - a.version)[0]
      list.push({ key: `pre-${d.id}`, label: `預下單 ${d.dealNo} ${d.customer}`, soNo: `預下單 ${d.dealNo}`, customer: d.customer, dealId: d.id, quoteId: q?.id, preOrder: true })
    })
  return list
})
const sourceKey = ref('')
const source = computed(() => sources.value.find((s) => s.key === sourceKey.value))

/* 依供應商拆單：每個供應商一張 PO */
interface Group {
  vendor: string
  lines: (PoLine & { useStock: boolean; stockFree: number; estCost: number })[]
  terms: string
  expectedAt: string
}
const groups = ref<Group[]>([])
const termsOptions = ['T/T 30 天', 'T/T 45 天', '月結 30 天', '分期：30% / 70%', '預付 100%']
const stockFree = (sku: string) => stock.filter((s) => s.sku === sku).reduce((n, s) => n + s.qty - s.reserved, 0)
const defaultDate = () => {
  const d = new Date()
  d.setDate(d.getDate() + 28)
  return d.toISOString().slice(0, 10)
}

watch(
  () => [props.modelValue, sourceKey.value] as const,
  () => {
    if (!props.modelValue) return
    const s = source.value
    const q = s?.quoteId ? quotes.find((x) => x.id === s.quoteId) : undefined
    const map = new Map<string, Group>()
    q?.lines
      .filter((l) => l.vendor && l.vendor !== '自有工程' && l.qty - Math.min(l.stockQty ?? 0, l.qty) > 0)
      .forEach((l) => {
        const buyQty = l.qty - Math.min(l.stockQty ?? 0, l.qty)
        if (!map.has(l.vendor)) map.set(l.vendor, { vendor: l.vendor, lines: [], terms: 'T/T 30 天', expectedAt: defaultDate() })
        map.get(l.vendor)!.lines.push({ no: map.get(l.vendor)!.lines.length + 1, extName: l.extName + (buyQty < l.qty ? `（另 ${l.qty - buyQty} 台用庫存）` : ''), intSku: l.intSku, vendorSku: l.vendorSku, qty: buyQty, unitCost: l.unitCost ?? 0, estCost: l.unitCost ?? 0, useStock: false, stockFree: stockFree(l.intSku) })
      })
    groups.value = [...map.values()]
  },
  { immediate: true },
)
watch(
  () => props.modelValue,
  (v) => {
    if (v) sourceKey.value = props.soNo && sources.value.some((s) => s.soNo === props.soNo) ? sources.value.find((s) => s.soNo === props.soNo)!.key : sources.value[0]?.key ?? ''
  },
)

const groupAmount = (g: Group) => g.lines.filter((l) => !l.useStock).reduce((s, l) => s + l.qty * l.unitCost, 0)
const total = computed(() => groups.value.reduce((s, g) => s + groupAmount(g), 0))

/* 預估 vs 實際：預估成本＝送審時的成本；實際成本＝PO 金額＋自有工程 */
const srcQuote = computed(() => (source.value?.quoteId ? quotes.find((q) => q.id === source.value!.quoteId) : undefined))
const revenue = computed(() => (srcQuote.value ? quoteTotal(srcQuote.value) : 0))
const ownCost = computed(() => (srcQuote.value ? srcQuote.value.lines.filter((l) => l.vendor === '自有工程').reduce((s, l) => s + l.qty * (l.unitCost ?? 0), 0) : 0))
const estCost = computed(() => groups.value.flatMap((g) => g.lines).reduce((s, l) => s + l.qty * l.estCost, 0) + ownCost.value)
const actualCost = computed(() => total.value + ownCost.value)
const estMargin = computed(() => (revenue.value ? (revenue.value - estCost.value) / revenue.value : 0))
const actualMargin = computed(() => (revenue.value ? (revenue.value - actualCost.value) / revenue.value : 0))
const costUp = computed(() => actualCost.value > estCost.value)
const marginBreach = computed(() => costUp.value && (actualMargin.value < routing.lowMarginThreshold || actualMargin.value < 0))
const lineUp = (l: { unitCost: number; estCost: number }) => l.estCost > 0 && l.unitCost > l.estCost
const pctText = (v: number) => `${(v * 100).toFixed(1)}%`
const evalPo = (amount: number, preOrder: boolean, breach = marginBreach.value) => evaluate('PO', { applicantId: store.currentUserId, facts: { amount, preOrder, costBreach: breach, newVendor: false } })
const routeFor = (amount: number, preOrder: boolean, breach = marginBreach.value): Role[] => evalPo(amount, preOrder, breach).route
/* 對話框下方的路由說明：以整批金額算一次 */
const routeNote = computed(() => {
  const r = evalPo(total.value, !!source.value?.preOrder)
  return `${r.route.join(' → ')}${r.applied.map((a) => `，${a.text}`).join('')}`
})

function submit() {
  const s = source.value
  if (!s) return
  const active = groups.value.filter((g) => g.lines.some((l) => !l.useStock))
  if (!active.length) {
    ElMessage.warning('沒有要向供應商採購的項次（全部改用公司庫存）')
    return
  }
  const missing = active.flatMap((g) => g.lines.filter((l) => !l.useStock && !l.unitCost))
  if (missing.length) {
    ElMessage.warning(`${missing.length} 項單位成本未填（預下單時業務尚未填成本，請採購依原廠報價填入）`)
    return
  }
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10)
  const created: string[] = []
  /* 先把預估／實際成本快照下來：PO 一放進清單，來源就會從下拉消失，之後再讀 computed 會變 0 */
  const snap = { estCost: estCost.value, actualCost: actualCost.value, estMargin: estMargin.value, actualMargin: actualMargin.value, costUp: costUp.value, breach: marginBreach.value }
  active.forEach((g, i) => {
    const seq = purchaseOrders.filter((p) => p.poNo.startsWith(ymd)).length + i + 1
    const poNo = `${ymd}-${String(seq).padStart(3, '0')}`
    const amount = groupAmount(g)
    const ev = evalPo(amount, s.preOrder, snap.breach)
    const route = ev.route
    const approvalId = `a-${now.getTime()}-${i}`
    const po: PurchaseOrder = {
      id: `po-${now.getTime()}-${i}`,
      poNo,
      vendor: g.vendor,
      soNo: s.soNo,
      customer: s.customer,
      dealId: s.dealId,
      orderId: s.orderId,
      amount,
      terms: g.terms,
      status: '待核准',
      createdAt: ymd,
      expectedAt: g.expectedAt,
      preOrder: s.preOrder,
      approvalId,
      lines: g.lines.filter((l) => !l.useStock).map((l, idx) => ({ no: idx + 1, extName: l.extName, intSku: l.intSku, vendorSku: l.vendorSku, qty: l.qty, unitCost: l.unitCost })),
    }
    purchaseOrders.unshift(po)
    store.approvals.unshift({
      id: approvalId,
      type: 'PO',
      title: `PO ${poNo} ${g.vendor}${s.preOrder ? '（預下單）' : ''}`,
      refNo: poNo,
      dealId: s.dealId,
      submitterId: store.currentUserId,
      submitter: store.currentUser.name,
      submittedAt: now.toISOString(),
      amount,
      route,
      steps: ev.steps,
      flags: snap.breach ? ['成本異動'] : undefined,
      currentStep: 0,
      status: '待簽核',
      reason: `${s.soNo} · ${g.terms} · 預計交期 ${g.expectedAt}${g.terms.startsWith('預付') ? '；需先走預付款簽核' : ''}${snap.costUp ? `；成本高於預估，實際毛利 ${pctText(snap.actualMargin)}` : ''}`,
      diff: snap.costUp
        ? [
            { field: '成本合計', before: money(snap.estCost), after: money(snap.actualCost) },
            { field: '毛利率', before: pctText(snap.estMargin), after: pctText(snap.actualMargin) },
            ...g.lines.filter((l) => !l.useStock && lineUp(l)).map((l) => ({ field: `項次 ${l.no} ${l.extName} 單位成本`, before: money(l.estCost), after: money(l.unitCost) })),
            ...(snap.breach ? [{ field: '簽核進度', before: routeFor(amount, s.preOrder, false).join(' → '), after: route.join(' → ') }] : []),
          ]
        : undefined,
      history: [{ role: store.role, name: store.currentUser.name, action: '送出', at: now.toISOString() }],
    })
    store.todos.unshift({
      id: `t-${now.getTime()}-${i}`,
      kind: '簽核',
      title: `PO ${poNo} ${g.vendor}`,
      refNo: poNo,
      due: ymd,
      forRoles: [route[0]!],
      forUserIds: ev.steps[0]?.candidateIds,
      approvalId,
      createdAt: now.toISOString(),
    })
    created.push(poNo)
  })
  /* 採購的「建立 PO」代辦完成 */
  store.todos = store.todos.filter((t) => !(t.kind === '下單' && t.refNo === s.soNo))
  const usedStock = groups.value.flatMap((g) => g.lines.filter((l) => l.useStock))
  ElMessage.success(`已建立 ${created.length} 張 PO（${created.join('、')}），送 ${routeFor(groupAmount(active[0]!), s.preOrder, snap.breach).join(' → ')} 核准${usedStock.length ? `；${usedStock.length} 項改用公司庫存` : ''}`)
  emit('created', created)
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog :model-value="modelValue" title="建立採購單（PO）" width="860px" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <el-form label-position="top">
      <el-form-item label="對應訂單或預下單商機">
        <el-select v-model="sourceKey" style="width: 100%" placeholder="選擇 SO">
          <el-option v-for="s in sources" :key="s.key" :value="s.key" :label="s.label" />
        </el-select>
        <span v-if="!sources.length" class="muted small">目前沒有待建 PO 的訂單。</span>
      </el-form-item>
    </el-form>

    <p v-if="source && !groups.length" class="muted">{{ source.quoteId ? '項次都是自有工程，沒有要向供應商採購的項次。' : '這個預下單商機還沒有報價單。' }}</p>

    <section v-for="g in groups" :key="g.vendor" class="po-group">
      <header class="po-head">
        <div><b>{{ g.vendor }}</b><span class="muted small">一張 PO</span></div>
        <div class="po-fields">
          <el-select v-model="g.terms" size="small" style="width: 150px">
            <el-option v-for="t in termsOptions" :key="t" :value="t" :label="t" />
          </el-select>
          <el-date-picker v-model="g.expectedAt" type="date" value-format="YYYY-MM-DD" size="small" placeholder="預計交期" style="width: 140px" />
        </div>
      </header>
      <table class="plain-table">
        <thead><tr><th>#</th><th>品名 / 對內 SKU</th><th>原廠 SKU</th><th class="num">數量</th><th class="num">單位成本</th><th class="num">小計</th><th>公司庫存</th></tr></thead>
        <tbody>
          <tr v-for="l in g.lines" :key="l.no" :class="{ off: l.useStock }">
            <td class="num">{{ l.no }}</td>
            <td>{{ l.extName }}<div class="muted small">{{ l.intSku }}</div></td>
            <td class="id">{{ l.vendorSku }}</td>
            <td class="num">{{ l.qty }}</td>
            <td class="num">
              <el-input-number v-model="l.unitCost" :min="0" :step="1000" :controls="false" size="small" class="cost" :class="{ missing: !l.unitCost, up: lineUp(l) }" placeholder="*" />
              <div v-if="lineUp(l)" class="muted small">預估 {{ money(l.estCost) }}</div>
            </td>
            <td class="num">{{ l.useStock ? '—' : money(l.qty * l.unitCost) }}</td>
            <td>
              <el-checkbox v-if="l.stockFree >= l.qty" v-model="l.useStock" size="small">改用庫存（可用 {{ l.stockFree }}）</el-checkbox>
              <span v-else class="muted small">{{ l.stockFree ? `可用 ${l.stockFree}，不足` : '無' }}</span>
            </td>
          </tr>
        </tbody>
        <tfoot><tr><td colspan="5" class="foot-label">PO 金額</td><td class="num total">{{ money(groupAmount(g)) }}</td><td></td></tr></tfoot>
      </table>
    </section>

    <div v-if="groups.length && revenue" class="margin-box" :class="{ up: costUp, breach: marginBreach }">
      <span>預估成本 <b>{{ money(estCost) }}</b>（毛利 {{ pctText(estMargin) }}）</span>
      <span>實際成本 <b>{{ money(actualCost) }}</b>（毛利 {{ pctText(actualMargin) }}）</span>
      <span v-if="marginBreach" class="tag red">{{ actualMargin < 0 ? '實際毛利變負' : '實際毛利低於門檻' }}</span>
      <span v-else-if="costUp" class="tag amber">成本高於預估 {{ money(actualCost - estCost) }}</span>
    </div>
    <p v-if="groups.length" class="muted small note">簽核進度：{{ routeNote }}</p>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!groups.length" @click="submit">建立 {{ groups.filter((g) => g.lines.some((l) => !l.useStock)).length || '' }} 張 PO 並送核准</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.margin-box {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  align-items: center;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  font-size: 13px;
  margin-bottom: 8px;
}

.margin-box.up {
  border-color: var(--amber);
}

.margin-box.breach {
  border-color: var(--red);
}

.margin-box b {
  margin: 0 2px;
}

.cost.up :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--amber) inset;
}

.cost {
  width: 110px;
}

.cost.missing :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--amber) inset;
}

.po-group {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}

.po-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.po-head b {
  margin-right: 8px;
}

.po-fields {
  display: flex;
  gap: 8px;
}

.off td {
  color: var(--muted);
  text-decoration: line-through;
}

.off td:last-child {
  text-decoration: none;
}

.foot-label {
  text-align: right;
  color: var(--muted);
}

.total {
  font-weight: 600;
}

.small {
  font-size: 12px;
}

.note {
  margin: 4px 0 0;
}
</style>
