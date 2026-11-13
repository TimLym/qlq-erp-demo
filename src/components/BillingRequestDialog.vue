<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { milestoneTaxes, type Order } from '../mock/data'
import { useAppStore } from '../stores/app'
import { money } from '../utils/format'

/* 通知財務開票：任何階段都可以按，業務選要開哪一期；SO 抽屜與 SO 列表共用 */
const props = defineProps<{ order: Order | null; index?: number }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useAppStore()

const open = computed({
  get: () => !!props.order,
  set: (v) => {
    if (!v) emit('close')
  },
})
const msTax = computed(() => (props.order ? milestoneTaxes(props.order) : []))
const rows = computed(() => (props.order ? props.order.milestones.map((m, i) => ({ m, i, ok: !!m.planInvoiceAt && !!m.planPayAt })).filter((r) => r.m.status === '待請款') : []))
const pick = ref<number | null>(null)
watch(
  () => props.order,
  () => {
    const want = rows.value.find((r) => r.i === props.index && r.ok) ?? rows.value.find((r) => r.ok)
    pick.value = want?.i ?? null
  },
  { immediate: true },
)
const mmdd = (d?: string) => (d ? d.slice(5).replace('-', '/') : '—')
function submit() {
  const o = props.order
  if (!o || pick.value === null) return
  const m = o.milestones[pick.value]
  store.requestBilling(o, pick.value)
  ElMessage.success(`已通知財務開立第 ${pick.value + 1} 期「${m?.label ?? ''}」發票`)
  emit('close')
}
</script>

<template>
  <el-dialog v-model="open" :title="order ? `通知財務開票｜${order.soNo}` : ''" width="620px" append-to-body>
    <table v-if="order && rows.length" class="plain-table">
      <thead><tr><th></th><th>期次 / 名稱</th><th class="num">未稅</th><th class="num">含稅</th><th>預計開票</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.i" class="pick-row" :class="{ on: pick === r.i, off: !r.ok }" @click="r.ok && (pick = r.i)">
          <td><el-radio :model-value="pick" :value="r.i" :disabled="!r.ok" @change="pick = r.i" /></td>
          <td>{{ r.i + 1 }}　{{ r.m.label }}</td>
          <td class="num">{{ money(r.m.amount) }}</td>
          <td class="num"><b>{{ money(msTax[r.i] ?? 0) }}</b></td>
          <td class="id">{{ r.ok ? mmdd(r.m.planInvoiceAt) : '未填預計日期' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="muted small">沒有待開票的期數。</p>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="pick === null" @click="submit">通知開票</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.pick-row {
  cursor: pointer;
}

.pick-row.off td {
  color: var(--muted);
  cursor: not-allowed;
}

.pick-row.on td {
  background: var(--teal-soft);
}

.small {
  font-size: 12px;
}
</style>
