<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { orders, quotes, stock, purchaseOrders, type PurchaseOrder } from '../mock/data'
import { useAppStore } from '../stores/app'
import { money } from '../utils/format'

const props = defineProps<{ po: PurchaseOrder | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'received', po: PurchaseOrder): void }>()
const store = useAppStore()
const open = computed({ get: () => !!props.po, set: (v) => { if (!v) emit('close') } })

const STOCK = '公司庫存'
interface Alloc { target: string; qty: number }
interface LineForm { no: number; extName: string; intSku: string; unitCost: number; ordered: number; before: number; receiving: number; allocs: Alloc[] }
const lines = ref<LineForm[]>([])

/* 某張 SO 對某個料號還缺多少：報價版本需要量 − 已保留給它的庫存 */
function needOf(soNo: string, sku: string) {
  const o = orders.find((x) => x.soNo === soNo)
  const q = o?.quoteId ? quotes.find((x) => x.id === o.quoteId) : undefined
  const need = q ? q.lines.filter((l) => l.intSku === sku && l.vendor !== '自有工程').reduce((s, l) => s + l.qty, 0) : 0
  const held = stock.filter((s) => s.sku === sku && s.reservedFor === soNo).reduce((s, x) => s + x.reserved, 0)
  return Math.max(0, need - held)
}
/* 可分配的對象：這張 PO 的 SO、其他等貨中且需要這個料號的 SO、公司庫存 */
function targetsFor(sku: string) {
  const list: { value: string; label: string }[] = []
  orders
    .filter((o) => o.stageIndex <= 3)
    .forEach((o) => {
      const n = needOf(o.soNo, sku)
      if (n > 0 || o.soNo === props.po?.soNo) list.push({ value: o.soNo, label: `${o.soNo} ${o.customer}（缺 ${n}）` })
    })
  list.push({ value: STOCK, label: '公司庫存（不保留，先進先出）' })
  return list
}

watch(
  () => props.po,
  (po) => {
    if (!po) return
    lines.value = po.lines.map((l) => {
      const before = l.received ?? 0
      const receiving = l.qty - before
      const target = po.soNo.startsWith('SO-') ? po.soNo : STOCK
      return { no: l.no, extName: l.extName, intSku: l.intSku, unitCost: l.unitCost, ordered: l.qty, before, receiving, allocs: receiving > 0 ? [{ target, qty: receiving }] : [] }
    })
  },
  { immediate: true },
)

const allocSum = (l: LineForm) => l.allocs.reduce((s, a) => s + a.qty, 0)
const addAlloc = (l: LineForm) => l.allocs.push({ target: STOCK, qty: Math.max(0, l.receiving - allocSum(l)) })
/* 改到貨數量：只有一筆分配時跟著變；多筆時把差額調整到最後一筆 */
function syncAlloc(l: LineForm) {
  if (!l.allocs.length) {
    if (l.receiving > 0) l.allocs.push({ target: props.po?.soNo.startsWith('SO-') ? props.po.soNo : STOCK, qty: l.receiving })
    return
  }
  if (l.allocs.length === 1) l.allocs[0]!.qty = l.receiving
  else {
    const last = l.allocs[l.allocs.length - 1]!
    last.qty = Math.max(0, l.receiving - l.allocs.slice(0, -1).reduce((s, a) => s + a.qty, 0))
  }
}
const problems = computed(() =>
  lines.value.flatMap((l) => {
    const out: string[] = []
    if (l.receiving < 0 || l.receiving > l.ordered - l.before) out.push(`項次 ${l.no} 到貨數量超過未到量`)
    if (l.receiving > 0 && allocSum(l) !== l.receiving) out.push(`項次 ${l.no} 分配合計 ${allocSum(l)} ≠ 到貨 ${l.receiving}`)
    l.allocs.forEach((a) => {
      if (a.target !== STOCK && a.qty > needOf(a.target, l.intSku) && a.target !== props.po?.soNo) out.push(`項次 ${l.no} 分給 ${a.target} 超過它的缺量`)
    })
    return out
  }),
)

function confirm() {
  const po = props.po
  if (!po || problems.value.length) return
  const ymd = new Date().toISOString().slice(0, 10)
  const touched = new Set<string>()
  const batchesOf = new Map<string, string[]>()
  let batches = 0
  lines.value.forEach((l) => {
    if (l.receiving <= 0) return
    const poLine = po.lines.find((x) => x.no === l.no)!
    l.allocs.forEach((a) => {
      if (a.qty <= 0) return
      batches += 1
      const suffix = String(stock.filter((s) => s.receivedAt === ymd).length + 1).padStart(2, '0')
      const batchNo = `B-${ymd.slice(0, 4)}-${ymd.slice(5, 7)}${ymd.slice(8, 10)}-${suffix}`
      stock.push({
        sku: l.intSku,
        name: l.extName,
        batch: batchNo,
        qty: a.qty,
        unitCost: l.unitCost,
        location: '內湖倉',
        receivedAt: ymd,
        reserved: a.target === STOCK ? 0 : a.qty,
        reservedFor: a.target === STOCK ? undefined : a.target,
        poNo: po.poNo,
      })
      poLine.allocations = [...(poLine.allocations ?? []), { target: a.target, qty: a.qty, at: ymd }]
      if (a.target !== STOCK) {
        touched.add(a.target)
        batchesOf.set(a.target, [...(batchesOf.get(a.target) ?? []), batchNo])
      }
    })
    poLine.received = l.before + l.receiving
  })
  const complete = po.lines.every((l) => (l.received ?? 0) >= l.qty)
  /* 料沒到齊仍是「已下單」，到齊才「已到貨」 */
  po.status = complete ? '已到貨' : '已下單'
  po.receivedAt = ymd
  /* 收到貨的 SO：先「進貨」，料齊了就「已入庫」 */
  const ready: string[] = []
  const batchText = (soNo: string) => `，批次 ${(batchesOf.get(soNo) ?? []).join('、')}`
  touched.forEach((soNo) => {
    const o = orders.find((x) => x.soNo === soNo)
    const q = o?.quoteId ? quotes.find((x) => x.id === o.quoteId) : undefined
    if (!o || !q) return
    const allHeld = q.lines.filter((l) => l.vendor !== '自有工程').every((l) => needOf(soNo, l.intSku) === 0)
    if (allHeld && o.stageIndex < 3) {
      o.stageIndex = 3
      ready.push(soNo)
      store.logOrder(o, '執行', `PO ${po.poNo} 到貨入庫${batchText(soNo)}，進入「已入庫」階段`)
    } else if (!allHeld && o.stageIndex < 2) {
      o.stageIndex = 2
      store.logOrder(o, '執行', `PO ${po.poNo} 部分到貨${batchText(soNo)}，進入「進貨」階段`)
    } else store.logOrder(o, '執行', `PO ${po.poNo} 到貨${batchText(soNo)}`)
  })
  store.notifications.unshift({
    id: `n-${Date.now()}`,
    kind: '系統',
    text: `PO ${po.poNo} ${complete ? '已到貨' : '部分到貨'}，${batches} 批進入內湖倉${ready.length ? `；${ready.join('、')} 料齊，可安排出貨` : ''}`,
    at: new Date().toISOString(),
    read: false,
    forRoles: ['業務', '業務主管', '採購'],
  })
  ElMessage.success(`${complete ? '已到貨' : '部分到貨'}：${batches} 批進庫存${ready.length ? `，${ready.join('、')} 進到「到貨」階段` : ''}`)
  emit('received', po)
  emit('close')
}
const siblingNote = computed(() => (props.po ? purchaseOrders.filter((p) => p.soNo === props.po!.soNo && p.id !== props.po!.id).length : 0))
</script>

<template>
  <el-dialog v-model="open" title="到貨入庫與分配" width="900px">
    <template v-if="po">
      <p class="muted small head-note">
        PO {{ po.poNo }} · {{ po.vendor }} · 對應 {{ po.soNo }}{{ siblingNote ? `（同一張 SO 另有 ${siblingNote} 張 PO）` : '' }}
      </p>
      <section v-for="l in lines" :key="l.no" class="line">
        <header class="line-head">
          <div><b>{{ l.no }}. {{ l.extName }}</b><span class="muted small">{{ l.intSku }} · 單位成本 {{ money(l.unitCost) }}</span></div>
          <div class="qty">
            <span class="muted small">訂購 {{ l.ordered }}{{ l.before ? `，已到 ${l.before}` : '' }}</span>
            <span>本次到貨</span>
            <el-input-number v-model="l.receiving" :min="0" :max="l.ordered - l.before" :controls="false" size="small" class="n" @change="syncAlloc(l)" />
          </div>
        </header>
        <table v-if="l.receiving > 0" class="plain-table inner">
          <thead><tr><th>分配給</th><th class="num">數量</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(a, i) in l.allocs" :key="i">
              <td>
                <el-select v-model="a.target" size="small" style="width: 360px">
                  <el-option v-for="t in targetsFor(l.intSku)" :key="t.value" :value="t.value" :label="t.label" />
                </el-select>
              </td>
              <td class="num"><el-input-number v-model="a.qty" :min="0" :controls="false" size="small" class="n" /></td>
              <td><el-button size="small" text :icon="Delete" :disabled="l.allocs.length === 1" @click="l.allocs.splice(i, 1)" /></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td><el-button size="small" text :icon="Plus" @click="addAlloc(l)">再分一筆</el-button></td>
              <td class="num" :class="{ bad: allocSum(l) !== l.receiving }">{{ allocSum(l) }} / {{ l.receiving }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <p v-else class="muted small">本次不到貨</p>
      </section>
      <p v-if="problems.length" class="problems">{{ problems.join('；') }}</p>
    </template>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="problems.length > 0 || !lines.some((l) => l.receiving > 0)" @click="confirm">確認到貨並入庫</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.head-note {
  margin: 0 0 12px;
}

.line {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 10px;
}

.line-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.line-head b {
  margin-right: 8px;
}

.qty {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.n {
  width: 90px;
}

.inner {
  font-size: 13px;
}

.bad {
  color: var(--red);
  font-weight: 600;
}

.problems {
  color: var(--red);
  font-size: 13px;
  margin: 4px 0 0;
}

.small {
  font-size: 12px;
}
</style>
