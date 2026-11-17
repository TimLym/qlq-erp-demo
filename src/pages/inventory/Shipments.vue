<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { shipments, type Shipment } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import ShipmentDetailDrawer from '../../components/ShipmentDetailDrawer.vue'
import { useJump } from '../../composables/useJump'

/** 出貨單一覽：點列開明細抽屜；簽收從 SO 抽屜或簽核中心的等待簽收走 */
const store = useAppStore()
const q = ref('')
const list = computed(() => {
  const mine = new Set(store.scopedOrders.map((o) => o.soNo))
  const k = q.value.trim()
  return shipments
    .filter((s) => mine.has(s.soNo))
    .filter((s) => !k || [s.shipNo, s.customer, s.soNo, ...s.lines.map((l) => l.name)].some((x) => x.includes(k)))
    .sort((a, b) => b.at.localeCompare(a.at))
})
/* 點列開明細抽屜；帶 ?ship= 進來就直接開那一張 */
const detail = ref<Shipment | null>(null)
const route = useRoute()
const router = useRouter()
const { goSo, canSo } = useJump()
onMounted(() => {
  const ship = route.query.ship as string | undefined
  if (!ship) return
  detail.value = shipments.find((x) => x.shipNo === ship) ?? null
  router.replace({ query: {} })
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>出貨單</h1>
      </div>
      <div class="actions">
        <el-input v-model="q" placeholder="單號、客戶、SO、品項" clearable style="width: 260px" />
      </div>
    </div>
    <section class="panel">
      <table class="plain-table">
        <thead><tr><th>單號</th><th>客戶 / SO</th><th>品項</th><th>出貨日</th></tr></thead>
        <tbody>
          <tr v-for="s in list" :key="s.id" class="row" @click="detail = s">
            <td class="id">{{ s.shipNo }}</td>
            <td><b>{{ s.customer }}</b><div class="muted small"><a v-if="canSo" class="link" @click.stop="goSo(s.soNo)">{{ s.soNo }}</a><template v-else>{{ s.soNo }}</template></div></td>
            <td>{{ s.lines.map((l) => `${l.name} × ${l.qty}`).join('、') }}</td>
            <td class="id">{{ s.at }}</td>
          </tr>
          <tr v-if="!list.length"><td colspan="4" class="muted">沒有符合的出貨單</td></tr>
        </tbody>
      </table>
    </section>
    <ShipmentDetailDrawer :shipment="detail" @close="detail = null" />
  </div>
</template>

<style scoped>
.row { cursor: pointer; }
.detail td { background: var(--surface); padding: 12px 18px; }
.inner { font-size: 13px; }
.small { font-size: 12px; }
</style>
