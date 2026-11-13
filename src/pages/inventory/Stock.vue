<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { stock, stockHolds, deals, HOLD_TODAY, addDays, type StockHold } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { money } from '../../utils/format'

const store = useAppStore()
/* 業務看得到數量，看不到成本 */
const q = ref('')
const showCost = computed(() => store.role !== '業務')

/* 從 SO 抽屜點批次號過來：捲到那一批並點亮（拆批後的 B-xxx-001 也算） */
const route = useRoute()
const router = useRouter()
const hl = ref<string | null>(null)
const isHl = (batch: string) => !!hl.value && (batch === hl.value || batch.startsWith(hl.value + '-'))
onMounted(async () => {
  const batch = route.query.batch as string | undefined
  if (!batch) return
  hl.value = batch
  router.replace({ query: {} })
  await nextTick()
  document.querySelector('tr.hl')?.scrollIntoView({ block: 'center' })
  setTimeout(() => (hl.value = null), 2500)
})
/* 預留貨：採購核准（可縮短天數）或退回；保留中可提前釋放 */
const canHandle = computed(() => ['採購', '採購主管'].includes(store.role))
const holds = computed(() => stockHolds.filter((h) => h.status === '待核准' || h.status === '保留中').sort((a, b) => (a.status === b.status ? a.requestedAt.localeCompare(b.requestedAt) : a.status === '待核准' ? -1 : 1)))
const customerOf = (h: StockHold) => deals.find((d) => d.id === h.dealId)?.customer ?? ''
const soon = (h: StockHold) => !!h.expiresAt && h.expiresAt <= addDays(HOLD_TODAY, 3)
const approveDays = ref<Record<string, number>>({})
const daysOf = (h: StockHold) => approveDays.value[h.id] ?? h.days
function approve(h: StockHold) {
  if (store.approveHold(h, daysOf(h))) ElMessage.success(`已核准，保留到 ${h.expiresAt}`)
  else ElMessage.warning('可用庫存不足，無法保留')
}
function reject(h: StockHold) {
  store.rejectHold(h, '')
  ElMessage.info('已退回')
}
function release(h: StockHold) {
  store.releaseHold(h, '採購提前釋放')
  ElMessage.info('已釋放')
}
const groups = computed(() => {
  const k = q.value.trim()
  const m = new Map<string, typeof stock>()
  stock.forEach((s) => {
    if (k && ![s.sku, s.name, s.batch].some((x) => x.includes(k))) return
    if (!m.has(s.sku)) m.set(s.sku, [])
    m.get(s.sku)!.push(s)
  })
  return [...m.entries()].map(([sku, rows]) => ({ sku, name: rows[0]!.name, rows: rows.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)) }))
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>庫存查詢</h1>
      </div>
      <div class="actions">
        <el-input v-model="q" placeholder="料號、品名、批次單號" clearable style="width: 260px" />
      </div>
    </div>
    <section v-if="holds.length" class="panel sku holds">
      <div class="panel-head"><h2>預留貨</h2></div>
      <table class="plain-table">
        <thead><tr><th>狀態</th><th>料號</th><th class="num">數量</th><th>商機</th><th>申請人</th><th>天數</th><th>保留到</th><th v-if="canHandle"></th></tr></thead>
        <tbody>
          <tr v-for="h in holds" :key="h.id">
            <td><span class="tag" :class="h.status === '待核准' ? 'amber' : 'olive'">{{ h.status }}</span></td>
            <td class="id">{{ h.sku }}</td>
            <td class="num">{{ h.qty }}</td>
            <td>{{ customerOf(h) }}<div class="muted small id">{{ h.dealNo }}</div></td>
            <td>{{ h.requester }}</td>
            <td>
              <el-select v-if="canHandle && h.status === '待核准'" :model-value="daysOf(h)" size="small" style="width: 92px" @change="(v: number) => (approveDays[h.id] = v)">
                <el-option v-for="d in [7, 15, 30].filter((x) => x <= h.days)" :key="d" :value="d" :label="`${d} 天`" />
              </el-select>
              <template v-else>{{ h.days }} 天</template>
            </td>
            <td class="id"><span v-if="h.expiresAt" :class="{ warn: soon(h) }">{{ h.expiresAt }}</span><span v-else class="muted">—</span></td>
            <td v-if="canHandle" class="acts">
              <template v-if="h.status === '待核准'">
                <el-button size="small" type="primary" @click="approve(h)">核准</el-button>
                <el-button size="small" @click="reject(h)">退回</el-button>
              </template>
              <el-button v-else size="small" text @click="release(h)">釋放</el-button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
    <section v-for="g in groups" :key="g.sku" class="panel sku">
      <div class="panel-head">
        <h2>{{ g.name }}<span class="muted sub num">{{ g.sku }}</span></h2>
      </div>
      <table class="plain-table">
        <thead><tr><th>單號</th><th>進貨日</th><th class="num">可用數量</th><th v-if="showCost" class="num">單位成本</th><th v-if="showCost" class="num">批次成本</th><th class="num">出庫順序</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in g.rows" :key="r.batch" :class="{ hl: isHl(r.batch) }">
            <td class="id">{{ r.batch }}</td>
            <td class="id">{{ r.receivedAt }}</td>
            <td class="num">{{ r.qty - r.reserved }}</td>
            <td v-if="showCost" class="num">{{ money(r.unitCost) }}</td>
            <td v-if="showCost" class="num">{{ money(r.qty * r.unitCost) }}</td>
            <td class="num">{{ i + 1 }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <p v-if="!groups.length" class="muted">沒有符合的庫存</p>
  </div>
</template>

<style scoped>
.sku {
  margin-bottom: 14px;
}

.sub {
  font-weight: 400;
  font-size: 13px;
  margin-left: 10px;
}

.totals {
  display: flex;
  gap: 16px;
  font-size: 13px;
}

.warn {
  color: var(--amber);
  font-weight: 600;
}

.acts {
  white-space: nowrap;
}

tr.hl td {
  background: color-mix(in srgb, var(--amber, #d49a1a) 14%, var(--surface));
  transition: background 0.4s;
}
</style>
