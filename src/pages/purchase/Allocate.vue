<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../../stores/app'
import { useJump } from '../../composables/useJump'
import { orders, quotes, stock, purchaseOrders, type StockItem } from '../../mock/data'
import { warehouseShortOf } from '../../utils/execProgress'
import { money } from '../../utils/format'

/* 等貨中的訂單：還沒驗收的訂單，逐料號列需要量、已保留、在途（PO 已下單未到）、缺量 */
const store = useAppStore()
const { goSo } = useJump()
const waiting = computed(() =>
  orders
    .filter((o) => !o.acceptedAt && !o.voidedAt)
    .map((o) => {
      const q = quotes.find((x) => x.id === o.quoteId)
      const items = (q?.lines ?? [])
        .filter((l) => l.vendor !== '自有工程')
        .map((l) => {
          const held = stock.filter((s) => s.sku === l.intSku && s.reservedFor === o.soNo).reduce((s, x) => s + x.reserved, 0)
          const short = warehouseShortOf(o, l.intSku)
          const inTransit = purchaseOrders
            .filter((p) => p.soNo === o.soNo && p.status === '已下單')
            .flatMap((p) => p.lines.filter((x) => x.intSku === l.intSku && x.route !== '直送').map((x) => x.qty - (x.received ?? 0)))
            .reduce((s, n) => s + n, 0)
          return { sku: l.intSku, name: l.extName, need: l.qty, held, inTransit, short }
        })
      return { order: o, items, ready: items.every((i) => i.short === 0) }
    })
    /* 只列還要進公司倉的訂單 */
    .filter((w) => w.items.some((i) => i.short > 0 || i.held > 0)),
)

/* 可分配的批次：還有未保留數量的庫存 */
const free = computed(() => stock.filter((s) => s.qty - s.reserved > 0).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)))
const held = computed(() => stock.filter((s) => s.reserved > 0 && s.reservedFor))

/* 分配對話框 */
const assigning = ref<StockItem | null>(null)
const target = ref('')
const qty = ref(1)
const targetOptions = computed(() => {
  if (!assigning.value) return []
  const sku = assigning.value.sku
  return waiting.value
    .map((w) => ({ w, item: w.items.find((i) => i.sku === sku) }))
    .filter((x) => x.item && x.item.short > 0)
    .map((x) => ({ value: x.w.order.soNo, label: `${x.w.order.soNo} ${x.w.order.customer}（缺 ${x.item!.short}）`, short: x.item!.short }))
})
function startAssign(s: StockItem) {
  assigning.value = s
  target.value = targetOptions.value[0]?.value ?? ''
  qty.value = Math.min(s.qty - s.reserved, targetOptions.value[0]?.short ?? 1)
}
function assign() {
  const s = assigning.value
  const t = targetOptions.value.find((x) => x.value === target.value)
  if (!s || !t) return
  const freeQty = s.qty - s.reserved
  if (qty.value <= 0 || qty.value > freeQty || qty.value > t.short) {
    ElMessage.warning(`數量要在 1 到 ${Math.min(freeQty, t.short)} 之間`)
    return
  }
  if (s.reserved === 0 && qty.value === s.qty) {
    s.reserved = qty.value
    s.reservedFor = t.value
  } else {
    s.qty -= qty.value
    stock.push({ ...s, batch: `${s.batch}-${t.value.slice(-3)}`, qty: qty.value, reserved: qty.value, reservedFor: t.value })
  }
  const w = waiting.value.find((x) => x.order.soNo === t.value)
  if (w) store.logOrder(w.order, '執行', `保留批次 ${s.batch} ${qty.value} 台${w.ready ? '，料齊' : ''}`)
  ElMessage.success(`已保留 ${qty.value} 台給 ${t.value}${w?.ready ? '，料齊可出貨' : ''}`)
  assigning.value = null
}
function release(s: StockItem) {
  const so = s.reservedFor
  s.reserved = 0
  s.reservedFor = undefined
  const o = orders.find((x) => x.soNo === so)
  if (o) store.logOrder(o, '執行', `釋放批次 ${s.batch} 回公司庫存`)
  ElMessage.info(`${s.batch} 已釋放回公司庫存`)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>PO 分配</h1>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>等貨中的訂單</h2></div>
      <table class="plain-table">
        <thead><tr><th>SO</th><th>客戶</th><th>料號</th><th class="num">需要</th><th class="num">已保留</th><th class="num">在途</th><th class="num">缺</th><th>狀態</th></tr></thead>
        <tbody>
          <template v-for="w in waiting" :key="w.order.id">
            <tr v-for="(it, i) in w.items" :key="it.sku">
              <td v-if="i === 0" class="id" :rowspan="w.items.length"><a class="link" @click="goSo(w.order.soNo)">{{ w.order.soNo }}</a></td>
              <td v-if="i === 0" :rowspan="w.items.length">{{ w.order.customer }}<div class="muted small">{{ w.order.product }}</div></td>
              <td>{{ it.name }}<div class="muted small">{{ it.sku }}</div></td>
              <td class="num">{{ it.need }}</td>
              <td class="num">{{ it.held }}</td>
              <td class="num">{{ it.inTransit || '—' }}</td>
              <td class="num" :class="{ short: it.short }">{{ it.short || '—' }}</td>
              <td v-if="i === 0" :rowspan="w.items.length"><span class="tag" :class="w.ready ? 'olive' : 'amber'">{{ w.ready ? '料齊' : '等貨' }}</span></td>
            </tr>
            <tr v-if="!w.items.length"><td class="id"><a class="link" @click="goSo(w.order.soNo)">{{ w.order.soNo }}</a></td><td>{{ w.order.customer }}</td><td colspan="6" class="muted">全部是自有工程，不需要貨</td></tr>
          </template>
          <tr v-if="!waiting.length"><td colspan="8" class="muted">目前沒有等貨中的訂單</td></tr>
        </tbody>
      </table>
    </section>

    <div class="two">
      <section class="panel">
        <div class="panel-head"><h2>可分配的庫存</h2></div>
        <table class="plain-table">
          <thead><tr><th>料號</th><th>批次</th><th>進貨日</th><th class="num">可用</th><th class="num">批次成本</th><th></th></tr></thead>
          <tbody>
            <tr v-for="s in free" :key="s.batch">
              <td>{{ s.name }}<div class="muted small">{{ s.sku }}</div></td>
              <td class="id">{{ s.batch }}<div v-if="s.poNo" class="muted small">PO {{ s.poNo }}</div></td>
              <td class="id">{{ s.receivedAt }}</td>
              <td class="num">{{ s.qty - s.reserved }}</td>
              <td class="num">{{ money(s.unitCost) }}</td>
              <td><el-button v-if="store.can('/purchase/allocate', 'edit')" size="small" @click="startAssign(s)">分配給 SO</el-button></td>
            </tr>
            <tr v-if="!free.length"><td colspan="6" class="muted">沒有可分配的庫存</td></tr>
          </tbody>
        </table>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>已保留給 SO 的批次</h2></div>
        <table class="plain-table">
          <thead><tr><th>料號</th><th>批次</th><th class="num">保留</th><th>保留給</th><th></th></tr></thead>
          <tbody>
            <tr v-for="s in held" :key="s.batch">
              <td>{{ s.name }}<div class="muted small">{{ s.sku }}</div></td>
              <td class="id">{{ s.batch }}</td>
              <td class="num">{{ s.reserved }}</td>
              <td class="id">{{ s.reservedFor }}</td>
              <td><el-button v-if="store.can('/purchase/allocate', 'edit')" size="small" text @click="release(s)">釋放回庫存</el-button></td>
            </tr>
            <tr v-if="!held.length"><td colspan="5" class="muted">目前沒有保留中的批次</td></tr>
          </tbody>
        </table>
      </section>
    </div>

    <el-dialog :model-value="!!assigning" title="分配給 SO" width="520px" @update:model-value="(v: boolean) => { if (!v) assigning = null }">
      <template v-if="assigning">
        <p class="muted small">{{ assigning.name }} · {{ assigning.batch }} · 可用 {{ assigning.qty - assigning.reserved }}</p>
        <el-form label-position="top">
          <el-form-item label="保留給">
            <el-select v-model="target" style="width: 100%" placeholder="沒有訂單需要這個料號">
              <el-option v-for="t in targetOptions" :key="t.value" :value="t.value" :label="t.label" />
            </el-select>
          </el-form-item>
          <el-form-item label="數量">
            <el-input-number v-model="qty" :min="1" :max="assigning.qty - assigning.reserved" />
          </el-form-item>
        </el-form>
        <p v-if="!targetOptions.length" class="muted small">目前沒有等貨中的訂單需要這個料號。</p>
      </template>
      <template #footer>
        <el-button @click="assigning = null">取消</el-button>
        <el-button type="primary" :disabled="!target" @click="assign">保留</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.panel {
  margin-bottom: 14px;
}

.sub {
  font-weight: 400;
  font-size: 13px;
  margin-left: 10px;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.short {
  color: var(--red);
  font-weight: 600;
}

.small {
  font-size: 12px;
}

@media (max-width: 1100px) {
  .two {
    grid-template-columns: 1fr;
  }
}
</style>
