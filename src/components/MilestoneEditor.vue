<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { computed } from 'vue'
import { Plus, Close } from '@element-plus/icons-vue'
import { milestoneTemplates, milestonesFromTemplate, type Milestone } from '../mock/data'
import { money } from '../utils/format'

/* 請款條件編輯：上單送審頁與訂單展開列共用。已請款、已收款的期數鎖定，合計要等於訂單金額 */
const props = defineProps<{ modelValue: Milestone[]; total: number }>()
const emit = defineEmits<{ 'update:modelValue': [Milestone[]] }>()

const rows = computed(() => props.modelValue)
const allOpen = computed(() => rows.value.every((m) => m.status === '待請款'))
const sum = computed(() => rows.value.reduce((s, m) => s + m.amount, 0))
const diff = computed(() => props.total - sum.value)
const locked = (m: Milestone) => m.status !== '待請款'

/* 目前的期數剛好等於某個模板就亮該模板，否則是自訂 */
const currentTemplate = computed(() => {
  const t = milestoneTemplates.find((t) => {
    const ms = milestonesFromTemplate(t.key, props.total)
    return ms.length === rows.value.length && ms.every((m, i) => m.label === rows.value[i]!.label && m.amount === rows.value[i]!.amount)
  })
  return t?.key ?? 'custom'
})

function applyTemplate(key: string) {
  if (!allOpen.value || key === 'custom') return
  emit('update:modelValue', milestonesFromTemplate(key, props.total))
}
function update(i: number, patch: Partial<Milestone>) {
  emit('update:modelValue', rows.value.map((m, j) => (j === i ? { ...m, ...patch } : m)))
}
function add() {
  emit('update:modelValue', [...rows.value, { label: '', amount: Math.max(diff.value, 0), status: '待請款' }])
}
async function remove(i: number) {
  const ok = await ElMessageBox.confirm(`移除第 ${i + 1} 期「${rows.value[i]?.label || '未命名'}」？`, '移除請款期數', { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' }).then(() => true, () => false)
  if (!ok) return
  emit('update:modelValue', rows.value.filter((_, j) => j !== i))
}
const statusTag: Record<string, string> = { 待請款: 'slate', 已申請: 'amber', 已開票: 'teal', 已收款: 'olive' }
</script>

<template>
  <div class="ms">
    <div class="tpl">
      <span class="muted small">模板</span>
      <el-radio-group :model-value="currentTemplate" size="small" :disabled="!allOpen" @change="(v: string | number | boolean | undefined) => applyTemplate(String(v))">
        <el-radio-button v-for="t in milestoneTemplates" :key="t.key" :value="t.key">{{ t.label }}</el-radio-button>
        <el-radio-button value="custom">自訂</el-radio-button>
      </el-radio-group>
    </div>
    <table class="plain-table rows">
      <thead>
        <tr><th>#</th><th>期數名稱</th><th class="num">金額</th><th>狀態</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="(m, i) in rows" :key="i" :class="{ locked: locked(m) }">
          <td class="num">{{ i + 1 }}</td>
          <td><el-input :model-value="m.label" size="small" :disabled="locked(m)" placeholder="例：驗收後 70%" @update:model-value="(v: string | number) => update(i, { label: String(v) })" /></td>
          <td class="num"><el-input-number :model-value="m.amount" size="small" :min="0" :step="10000" :controls="false" :disabled="locked(m)" class="amt" @update:model-value="(v: number | undefined) => update(i, { amount: Number(v ?? 0) })" /></td>
          <td><span class="tag" :class="statusTag[m.status]">{{ m.status }}</span></td>
          <td class="rm"><el-button v-if="!locked(m)" size="small" text :icon="Close" title="移除這一期" @click="remove(i)" /></td>
        </tr>
      </tbody>
    </table>
    <div class="foot">
      <el-button size="small" :icon="Plus" @click="add">加一期</el-button>
      <span class="sum" :class="diff === 0 ? 'ok' : 'bad'">
        合計 <b class="num">{{ money(sum) }}</b> ／ 訂單金額 <b class="num">{{ money(total) }}</b>
        <template v-if="diff !== 0">，差 {{ money(Math.abs(diff)) }}{{ diff > 0 ? '未分配' : '超出' }}</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.ms {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tpl {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.small {
  font-size: 12px;
}

.rows td {
  vertical-align: middle;
}

.rows tr.locked td {
  color: var(--muted);
}

.amt {
  width: 140px;
}

.rm {
  width: 36px;
  text-align: right;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
}

.sum b {
  margin: 0 2px;
}

.sum.ok {
  color: var(--teal-ink, var(--teal));
}

.sum.bad {
  color: var(--red);
}
</style>
