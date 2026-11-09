<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { shipments, orders, type Shipment } from '../mock/data'
import { useAppStore } from '../stores/app'
import ShipmentDrawer from './ShipmentDrawer.vue'

/* 等待簽收：已出貨、還沒拿到客戶簽收的出貨單。簽收完成訂單進到「驗收」，這裡就消失（簽核中心的頁簽） */
const store = useAppStore()
const TODAY = new Date('2026-10-08')
const list = computed(() => {
  const mine = new Set(store.scopedOrders.map((o) => o.soNo))
  return shipments
    .filter((s) => s.status === '已出貨' && mine.has(s.soNo))
    .map((s) => ({ s, days: Math.round((TODAY.getTime() - new Date(s.at).getTime()) / 86400000) }))
    .sort((a, b) => b.days - a.days)
})
const signing = ref<(typeof orders)[number] | null>(null)
function sign(s: Shipment) {
  const o = orders.find((x) => x.id === s.orderId)
  if (o) signing.value = o
}
function onSigned(orderId: string, method: string, file: string) {
  const o = orders.find((x) => x.id === orderId)
  if (!o) return
  store.signOff(o, method, undefined, file)
  ElMessage.success(`${o.customer} 已簽收（${method}），訂單進到「驗收」`)
}
</script>

<template>
  <section class="panel">
    <table class="plain-table">
      <thead><tr><th>類型</th><th>單號</th><th>客戶／廠商</th><th>日期</th><th>已等待</th><th>負責業務</th><th></th></tr></thead>
      <tbody>
        <tr v-for="{ s, days } in list" :key="s.id">
          <td><span class="tag teal">{{ s.direct ? '原廠直送簽收' : '出貨簽收' }}</span></td>
          <td class="id">{{ s.shipNo }}</td>
          <td><b>{{ s.customer }}</b><div class="muted small">{{ s.soNo }}</div></td>
          <td class="id">{{ s.at }}</td>
          <td><span class="tag" :class="days > 14 ? 'red' : days > 7 ? 'amber' : 'slate'">{{ days }} 天</span></td>
          <td>{{ orders.find((o) => o.id === s.orderId)?.owner ?? '—' }}</td>
          <td class="right"><el-button v-if="store.role !== '採購'" size="small" type="primary" @click="sign(s)">簽收</el-button></td>
        </tr>
        <tr v-if="!list.length"><td colspan="7" class="empty">沒有等待簽收的出貨單。</td></tr>
      </tbody>
    </table>
  </section>
  <ShipmentDrawer :order="signing" @close="signing = null" @signed="onSigned" />
</template>

<style scoped>
.small { font-size: 12px; }
.right { text-align: right; }
.empty { padding: 28px 16px; color: var(--muted); }
</style>
