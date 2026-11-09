<script setup lang="ts">
import type { Milestone } from '../mock/data'
import { money } from '../utils/format'

/* 請款條件摘要：基本資料頁簽用，永遠唯讀；送審前由「編輯請款條件」開彈窗改 */
defineProps<{
  milestones: Milestone[]
  total: number
  editable: boolean
  /** 不能編輯時的說明，例如「已隨 v2 送審鎖定」 */
  note?: string
}>()
const emit = defineEmits<{ (e: 'edit'): void }>()
const statusTag: Record<string, string> = { 待請款: 'slate', 已申請: 'amber', 已開票: 'teal', 已收款: 'olive' }
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h4>請款條件<span class="muted small sub">合計 {{ money(total) }}</span></h4>
      <el-button v-if="editable" size="small" @click="emit('edit')">編輯請款條件</el-button>
      <span v-else-if="note" class="muted small">{{ note }}</span>
    </div>
    <div class="card-body">
      <div v-if="milestones.length" class="wrap">
        <table class="plain-table">
          <thead><tr><th>#</th><th>期數名稱</th><th class="num">金額</th><th>狀態</th></tr></thead>
          <tbody>
            <tr v-for="(m, i) in milestones" :key="i"><td class="num">{{ i + 1 }}</td><td>{{ m.label }}</td><td class="num">{{ money(m.amount) }}</td><td><span class="tag" :class="statusTag[m.status]">{{ m.status }}</span></td></tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted small empty">尚未設定請款條件。</p>
    </div>
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}

.card-head h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
}

.card-body {
  padding: 4px 14px 10px;
}

/* 期數多時表格在卡內捲，標題與按鈕固定可見 */
.wrap {
  max-height: 184px;
  overflow: auto;
}

.empty {
  margin: 10px 0 4px;
}

.small {
  font-size: 12px;
}

.sub {
  font-weight: 400;
}
</style>
