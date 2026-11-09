<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { stock } from '../../mock/data'
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

tr.hl td {
  background: color-mix(in srgb, var(--amber, #d49a1a) 14%, var(--surface));
  transition: background 0.4s;
}
</style>
