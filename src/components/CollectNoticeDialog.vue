<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { milestoneTaxes, type Order } from '../mock/data'
import { useAppStore } from '../stores/app'
import { money } from '../utils/format'

/* 通知會計收款／催收：只列已開票、還沒收款的期數；入帳仍由會計在應收頁做。訂單列表與訂單抽屜共用 */
const props = defineProps<{ order: Order | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useAppStore()

const open = computed({ get: () => !!props.order, set: (v) => { if (!v) emit('close') } })
const today = new Date().toISOString().slice(0, 10)
const msTax = computed(() => (props.order ? milestoneTaxes(props.order) : []))
const rows = computed(() => (props.order ? props.order.milestones.map((m, i) => ({ m, i, late: !!m.planPayAt && m.planPayAt < today })).filter((r) => r.m.status === '已開票') : []))
const picked = ref<number[]>([])
const note = ref('')
watch(
  () => props.order,
  () => {
    /* 預設只勾還沒通知過的；全部都通知過時才全勾（再次催收） */
    const fresh = rows.value.filter((r) => !r.m.collectRequestedAt).map((r) => r.i)
    picked.value = fresh.length ? fresh : rows.value.map((r) => r.i)
    note.value = ''
  },
  { immediate: true },
)
const mmdd = (d?: string) => (d ? d.slice(5).replace('-', '/') : '—')
function submit() {
  const o = props.order
  if (!o || !picked.value.length) return
  if (!store.requestCollect(o, picked.value, note.value)) return
  ElMessage.success(`已通知會計收款：${picked.value.map((i) => `第 ${i + 1} 期`).join('、')}`)
  emit('close')
}
</script>

<template>
  <el-dialog v-model="open" :title="order ? `通知會計收款｜${order.soNo}` : ''" width="640px" append-to-body>
    <template v-if="order && rows.length">
      <table class="plain-table">
        <thead><tr><th></th><th>期次 / 名稱</th><th>發票</th><th class="num">含稅</th><th>預計付款</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.i">
            <td><el-checkbox :model-value="picked.includes(r.i)" @update:model-value="(v: boolean | string | number) => (picked = v ? [...picked, r.i] : picked.filter((x) => x !== r.i))" /></td>
            <td>{{ r.i + 1 }}　{{ r.m.label }}<div v-if="r.m.collectRequestedAt" class="muted small">{{ mmdd(r.m.collectRequestedAt) }} 已通知過</div></td>
            <td class="id">{{ r.m.invoiceNo }}</td>
            <td class="num"><b>{{ money(msTax[r.i] ?? 0) }}</b></td>
            <td class="id" :class="{ late: r.late }">{{ mmdd(r.m.planPayAt) }}<span v-if="r.late">　逾期</span></td>
          </tr>
        </tbody>
      </table>
      <el-input v-model="note" type="textarea" :rows="2" maxlength="200" placeholder="給會計的備註（選填）：例如客戶說月底匯款、窗口換人" class="note" />
    </template>
    <p v-else class="muted small">沒有已開票、待收款的期數。</p>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="!picked.length" @click="submit">通知收款</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.note { margin-top: 12px; }
.late { color: var(--red); font-weight: 600; }
.small { font-size: 12px; }
</style>
