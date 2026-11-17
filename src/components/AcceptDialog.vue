<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { Order } from '../mock/data'
import { useAppStore } from '../stores/app'
import { canAccept, supplyProgress, engProgress, pctText } from '../utils/execProgress'

/* 整案驗收：貨都到客戶、工程 100% 才能送；填驗收日、上傳客戶驗收單（必填）。訂單列表與訂單抽屜共用 */
const props = defineProps<{ order: Order | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useAppStore()

const open = computed({ get: () => !!props.order, set: (v) => { if (!v) emit('close') } })
const date = ref('')
const file = ref('')
watch(
  () => props.order,
  () => {
    date.value = new Date().toISOString().slice(0, 10)
    file.value = ''
  },
  { immediate: true },
)
const check = computed(() => (props.order ? canAccept(props.order) : { ok: false, reason: '' }))
const supply = computed(() => (props.order ? supplyProgress(props.order) : null))
const eng = computed(() => (props.order ? engProgress(props.order) : null))
/* Demo：選檔只記檔名 */
function pickFile() {
  if (!props.order) return
  file.value = `${props.order.customer}-驗收單-${date.value}.pdf`
}
function submit() {
  const o = props.order
  if (!o || !file.value) return
  if (!store.acceptOrder(o, date.value, file.value)) {
    ElMessage.error('不能驗收：請確認條件與權限')
    return
  }
  ElMessage.success(`${o.soNo} 已完成整案驗收`)
  emit('close')
}
</script>

<template>
  <el-dialog v-model="open" :title="order ? `整案驗收｜${order.soNo}` : ''" width="560px" append-to-body>
    <template v-if="order">
      <dl class="kv">
        <dt>採購（到客戶）</dt><dd :class="{ ok: supply?.delivered === null || supply?.delivered === 1 }">{{ supply?.delivered === null ? '沒有要交貨的項次' : pctText(supply?.delivered ?? 0) }}</dd>
        <dt>工程</dt><dd :class="{ ok: !eng || eng.pct === 1 }">{{ eng ? pctText(eng.pct) : '沒有工程' }}</dd>
      </dl>
      <p v-if="!check.ok" class="problem">{{ check.reason }}</p>
      <el-form label-position="top" class="form">
        <el-form-item required label="驗收日">
          <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :clearable="false" :disabled="!check.ok" />
        </el-form-item>
        <el-form-item required label="客戶驗收單">
          <div class="file">
            <el-button size="small" :disabled="!check.ok" @click="pickFile">選擇檔案</el-button>
            <span v-if="file" class="id">{{ file }}</span>
            <span v-else class="muted small">尚未上傳</span>
          </div>
        </el-form-item>
      </el-form>
      <p class="muted small">保固、維護與服務合約從驗收日起算；授權由工程確認起算日。</p>
    </template>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="!check.ok || !file || !date" @click="submit">確認驗收</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.kv { display: grid; grid-template-columns: 120px 1fr; gap: 6px 12px; margin: 0 0 8px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; font-weight: 600; color: var(--amber); }
.kv dd.ok { color: var(--olive, var(--teal)); }
.problem { color: var(--red); font-size: 13px; margin: 0 0 8px; }
.form { margin-top: 8px; }
.file { display: flex; gap: 10px; align-items: center; }
.small { font-size: 12px; }
</style>
