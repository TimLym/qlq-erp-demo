<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { expiryKinds, type Order, type License } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import LicenseDrawer from '../../components/LicenseDrawer.vue'

/** 到期項目：授權、維護、保固、服務合約依到期日排序；點一筆開抽屜（到期日在抽屜裡改）；續約從結案 SO 的「續約」走 */
const store = useAppStore()
const route = useRoute()
const router = useRouter()
const q = ref('')
const kind = ref('')
const all = computed(() => store.scopedOrders.flatMap((o) => o.licenses.map((l) => ({ o, l, left: store.licenseStatus(o, l).left }))))
const rows = computed(() =>
  all.value
    .filter((r) => !kind.value || r.l.kind === kind.value)
    .filter((r) => {
      const k = q.value.trim()
      return !k || [r.o.customer, r.o.soNo, r.l.sku, r.l.name].some((x) => x.includes(k))
    })
    .sort((a, b) => a.left - b.left),
)
const kindLabel = (key: string) => expiryKinds.find((k) => k.key === key)?.label ?? key
const detail = ref<{ o: Order; l: License } | null>(null)
onMounted(() => {
  const id = route.query.lic as string | undefined
  if (!id) return
  for (const o of store.scopedOrders) {
    const l = o.licenses.find((x) => x.id === id)
    if (l) detail.value = { o, l }
  }
  router.replace({ query: {} })
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>到期項目</h1>
      </div>
      <div class="actions">
        <el-input v-model="q" placeholder="客戶、SO、SKU、品名" clearable style="width: 260px" />
      </div>
    </div>
    <div class="chips">
      <button type="button" class="chip" :class="{ on: kind === '' }" @click="kind = ''">全部<span class="count">{{ all.length }}</span></button>
      <button v-for="k in expiryKinds" :key="k.key" type="button" class="chip" :class="{ on: kind === k.key }" @click="kind = k.key">{{ k.label }}<span class="count">{{ all.filter((r) => r.l.kind === k.key).length }}</span></button>
    </div>
    <section class="panel">
      <table class="plain-table fixed">
        <colgroup><col class="c-cust" /><col class="c-kind" /><col /><col class="c-date" /><col class="c-left" /></colgroup>
        <thead><tr><th>客戶 / SO</th><th>類型</th><th>項目</th><th>到期日</th><th class="num">剩餘天數</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.l.id" class="row" @click="detail = { o: r.o, l: r.l }">
            <td><b>{{ r.o.customer }}</b><div class="muted small"><a v-if="store.can('/sales/orders', 'link')" class="link" @click.stop="router.push({ path: '/sales/orders', query: { so: r.o.soNo } })">{{ r.o.soNo }}</a><template v-else>{{ r.o.soNo }}</template> · {{ r.o.owner }}</div></td>
            <td><span class="tag teal">{{ kindLabel(r.l.kind) }}</span></td>
            <td>{{ r.l.name }} × {{ r.l.qty }}<div class="muted small id">{{ r.l.sku }}</div></td>
            <td class="id">{{ r.l.expires }}</td>
            <td class="num" :class="{ warn: r.left <= store.remindDaysOf(r.l.kind) && r.left >= 0, over: r.left < 0 }"><span v-if="!Number.isFinite(r.left)" class="tag amber">待起算</span><template v-else>{{ r.left }}</template></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="5" class="muted">沒有符合的項目</td></tr>
        </tbody>
      </table>
    </section>
    <LicenseDrawer :order="detail?.o ?? null" :license="detail?.l ?? null" @close="detail = null" />
  </div>
</template>

<style scoped>
.chips { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.chip { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 4px 12px; font-size: 13px; cursor: pointer; }
.chip.on { border-color: var(--teal); color: var(--teal); font-weight: 600; }
.chip .count { margin-left: 6px; color: var(--muted); font-size: 12px; }
.fixed { table-layout: fixed; }
.c-cust { width: 26%; }
.c-kind { width: 11%; }
.c-date { width: 14%; }
.c-left { width: 11%; }
.row { cursor: pointer; }
.row:hover td { background: var(--surface-2); }
.warn { color: var(--amber); font-weight: 600; }
.over { color: var(--red); font-weight: 600; }
.small { font-size: 12px; }
</style>
