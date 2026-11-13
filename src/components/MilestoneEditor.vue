<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { computed, ref } from 'vue'
import { Plus, Close } from '@element-plus/icons-vue'
import { milestoneTemplates, milestonesFromTemplate, milestoneRoundings, splitByPct, addDays, TAX_RATE, type Milestone, type MilestoneRounding } from '../mock/data'
import { money } from '../utils/format'

/* 請款條件編輯：上單送審頁與訂單展開列共用。已請款、已收款的期數鎖定，合計要等於訂單金額 */
/* withDates：SO 上編輯時每期加預計開票日與預計付款日（必填） */
const props = defineProps<{ modelValue: Milestone[]; total: number; withDates?: boolean; /** 客戶月結天數：填預計開票日時帶預計付款日 */ payDays?: number }>()
const emit = defineEmits<{ 'update:modelValue': [Milestone[]] }>()

const rows = computed(() => props.modelValue)
const allOpen = computed(() => rows.value.every((m) => m.status === '待請款'))
const sum = computed(() => rows.value.reduce((s, m) => s + m.amount, 0))
const diff = computed(() => props.total - sum.value)
const locked = (m: Milestone) => m.status !== '待請款'

/* 輸入方式（未稅金額／含稅金額／比例）與零頭處理（1112 會議 #11）；存的一律是未稅金額 */
const inputMode = ref<'未稅' | '含稅' | '比例'>('未稅')
const rounding = ref<MilestoneRounding>('last')
const taxOf = (n: number) => Math.round(n * (1 + TAX_RATE))
const pctOf = (m: Milestone) => (props.total ? Math.round((m.amount / props.total) * 1000) / 10 : 0)
/* 比例模式：改一期的比例，全部期數依零頭規則重拆（最後一期吃差額） */
function setPct(i: number, pct: number) {
  const pcts = rows.value.map((m, j) => (j === i ? pct : pctOf(m)))
  const amounts = splitByPct(props.total, pcts, rounding.value)
  emit('update:modelValue', rows.value.map((m, j) => ({ ...m, amount: amounts[j]! })))
}
function setRounding(r: MilestoneRounding) {
  rounding.value = r
  if (!allOpen.value || !rows.value.length) return
  const amounts = splitByPct(props.total, rows.value.map(pctOf), r)
  emit('update:modelValue', rows.value.map((m, j) => ({ ...m, amount: amounts[j]! })))
}
/* 目前的期數剛好等於某個模板就亮該模板，否則是自訂 */
const currentTemplate = computed(() => {
  const t = milestoneTemplates.find((t) => {
    const ms = milestonesFromTemplate(t.key, props.total, rounding.value)
    return ms.length === rows.value.length && ms.every((m, i) => m.label === rows.value[i]!.label && m.amount === rows.value[i]!.amount)
  })
  return t?.key ?? 'custom'
})

function applyTemplate(key: string) {
  if (!allOpen.value || key === 'custom') return
  emit('update:modelValue', milestonesFromTemplate(key, props.total, rounding.value))
}
/* 預計開票日：預計付款日還沒填就依月結天數帶入 */
function setInvoiceAt(i: number, v: string | undefined) {
  const m = rows.value[i]!
  const patch: Partial<Milestone> = { planInvoiceAt: v || undefined }
  /* 付款日沒填，或是上次依月結自動帶入的值，就跟著開票日更新；手動改過的保留 */
  const auto = !!m.planInvoiceAt && !!props.payDays && m.planPayAt === addDays(m.planInvoiceAt, props.payDays)
  if (v && props.payDays && (!m.planPayAt || auto)) patch.planPayAt = addDays(v, props.payDays)
  update(i, patch)
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
    <div class="tpl">
      <span class="muted small">輸入</span>
      <el-radio-group v-model="inputMode" size="small">
        <el-radio-button value="未稅">未稅金額</el-radio-button>
        <el-radio-button value="含稅">含稅金額</el-radio-button>
        <el-radio-button value="比例" :disabled="!allOpen">比例</el-radio-button>
      </el-radio-group>
      <span class="muted small">零頭</span>
      <el-select :model-value="rounding" size="small" style="width: 160px" :disabled="!allOpen" @change="(v: MilestoneRounding) => setRounding(v)">
        <el-option v-for="r in milestoneRoundings" :key="r.key" :value="r.key" :label="r.label" />
      </el-select>
    </div>
    <table class="plain-table rows">
      <thead>
        <tr><th>#</th><th>期數名稱</th><th class="num">{{ inputMode === '比例' ? '比例 %' : inputMode === '含稅' ? '金額（含稅）' : '金額（未稅）' }}</th><th class="num">{{ inputMode === '未稅' ? '含稅' : '未稅' }}</th><template v-if="withDates"><th>預計開票<span class="req">*</span></th><th>預計付款<span class="req">*</span><span v-if="payDays" class="muted small">（月結 {{ payDays }} 天）</span></th></template><th>狀態</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="(m, i) in rows" :key="i" :class="{ locked: locked(m) }">
          <td class="num">{{ i + 1 }}</td>
          <td><el-input :model-value="m.label" size="small" :disabled="locked(m)" placeholder="例：驗收後 70%" @update:model-value="(v: string | number) => update(i, { label: String(v) })" /></td>
          <td class="num">
            <el-input-number v-if="inputMode === '比例'" :model-value="pctOf(m)" size="small" :min="0" :max="100" :precision="1" :controls="false" :disabled="locked(m)" class="amt" @update:model-value="(v: number | undefined) => setPct(i, Number(v ?? 0))" />
            <el-input-number v-else-if="inputMode === '含稅'" :model-value="taxOf(m.amount)" size="small" :min="0" :step="10000" :precision="0" :controls="false" :disabled="locked(m)" class="amt" @update:model-value="(v: number | undefined) => update(i, { amount: Math.round(Number(v ?? 0) / (1 + TAX_RATE)) })" />
            <el-input-number v-else :model-value="m.amount" size="small" :min="0" :step="10000" :precision="0" :controls="false" :disabled="locked(m)" class="amt" @update:model-value="(v: number | undefined) => update(i, { amount: Number(v ?? 0) })" />
          </td>
          <td class="num muted">{{ inputMode === '未稅' ? money(taxOf(m.amount)) : money(m.amount) }}</td>
          <template v-if="withDates">
            <td><el-date-picker :model-value="m.planInvoiceAt" type="date" value-format="YYYY-MM-DD" size="small" class="date" :disabled="m.status === '已收款'" @update:model-value="(v: string) => setInvoiceAt(i, v)" /></td>
            <td><el-date-picker :model-value="m.planPayAt" type="date" value-format="YYYY-MM-DD" size="small" class="date" :disabled="m.status === '已收款'" @update:model-value="(v: string) => update(i, { planPayAt: v || undefined })" /></td>
          </template>
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

.date {
  width: 136px !important;
}

.req {
  color: var(--red);
  margin-left: 2px;
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
