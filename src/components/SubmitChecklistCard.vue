<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheckFilled, WarningFilled, RemoveFilled } from '@element-plus/icons-vue'
import ApprovalRoute from './ApprovalRoute.vue'
import type { Approval, Order } from '../mock/data'
import type { QuoteSubmitState, SubmitChecklistItem } from '../composables/useQuoteSubmit'
import { dateTime } from '../utils/format'

/*
 * 上單條件卡：放在商機抽屜「基本資料」右邊，整個生命週期都看得到（客戶叫它「條件列表」）。
 * 只負責呈現與收送審理由；狀態、條件、blockers、送審動作都由 useQuoteSubmit 算好傳進來。
 */
const props = defineProps<{
  state: QuoteSubmitState
  quoteVersion?: number
  items: SubmitChecklistItem[]
  blockers: string[]
  reason: string
  approval?: Approval
  order?: Order
  canSubmit: boolean
  submitLabel: string
  /** 可以操作送審（負責業務、主管、執行長） */
  canAct: boolean
  returnNote?: string
  lostReason?: string
}>()
const emit = defineEmits<{
  (e: 'update:reason', v: string): void
  (e: 'submit'): void
  (e: 'open-quote'): void
  (e: 'open-approval', id: string): void
  (e: 'open-order', soNo: string): void
  /** 點未完成的條件：跳到該欄位所在的頁面並點亮 */
  (e: 'open-item', key: SubmitChecklistItem['key']): void
}>()

const LABEL: Record<QuoteSubmitState, [string, string]> = {
  'no-quote': ['尚無報價', 'slate'],
  draft: ['草稿中', 'amber'],
  ready: ['可送審', 'teal'],
  pending: ['簽核中', 'amber'],
  returned: ['退回待補件', 'red'],
  approved: ['已核准', 'olive'],
  'retry-ready': ['合約變更', 'amber'],
  'retry-pending': ['重審中', 'amber'],
  'retry-returned': ['重審退回', 'red'],
  lost: ['未成交', 'slate'],
}
const stateLabel = computed(() => LABEL[props.state][0])
const tone = computed(() => LABEL[props.state][1])
/** 可以填理由、按送審的狀態 */
const editable = computed(() => props.canAct && ['ready', 'returned', 'retry-ready', 'retry-returned'].includes(props.state))
const showRoute = computed(() => !!props.approval && ['pending', 'retry-pending', 'approved'].includes(props.state))
const subtitle = computed(() => {
  if (props.state === 'lost' || props.state === 'no-quote') return ''
  const v = props.quoteVersion ? `報價 v${props.quoteVersion}` : ''
  return props.state.startsWith('retry') ? `變更${v}` : v
})
const needReason = computed(() => props.blockers.some((b) => b.includes('送審理由')))
</script>

<template>
  <section class="card submit-card">
    <div class="card-head">
      <h4>上單條件<span class="tag" :class="tone">{{ stateLabel }}</span></h4>
      <span v-if="subtitle" class="muted small">{{ subtitle }}</span>
    </div>
    <div class="card-body">
      <p v-if="state === 'lost'" class="muted">商機已標記未成交{{ lostReason ? `：${lostReason}` : '' }}</p>
      <template v-else>
        <div v-if="(state === 'returned' || state === 'retry-returned') && returnNote" class="notice">退回原因：{{ returnNote }}</div>
        <ul class="checklist">
          <li v-for="it in items" :key="it.key" :class="it.status">
            <component :is="it.status === 'incomplete' ? 'button' : 'div'" :type="it.status === 'incomplete' ? 'button' : undefined" class="row" :title="it.status === 'incomplete' ? '前往補齊' : undefined" @click="it.status === 'incomplete' && emit('open-item', it.key)">
              <el-icon class="ico">
                <CircleCheckFilled v-if="it.status === 'complete'" />
                <WarningFilled v-else-if="it.status === 'incomplete'" />
                <RemoveFilled v-else />
              </el-icon>
              <span class="lbl">{{ it.label }}</span>
              <span class="detail">{{ it.detail }}</span>
            </component>
          </li>
        </ul>

        <template v-if="showRoute && approval">
          <ApprovalRoute :route="approval.route" :current="approval.currentStep" :status="approval.status" class="route" />
          <p class="muted small line">{{ approval.status === '待簽核' ? `目前關卡 ${approval.route[approval.currentStep]} · ` : '' }}送出 {{ dateTime(approval.submittedAt) }}{{ order ? ` · ${order.soNo}` : '' }}</p>
        </template>

        <el-input v-if="editable" :model-value="reason" type="textarea" :rows="2" :placeholder="needReason ? '負毛利須說明理由，例：為爭取後續案件' : '送審理由'" class="reason" @update:model-value="(v: string) => emit('update:reason', v)" />

        <div class="actions">
          <template v-if="state === 'no-quote'">
            <el-button type="primary" @click="emit('open-quote')">建立報價單</el-button>
          </template>
          <template v-else-if="state === 'draft'">
            <el-button type="primary" @click="emit('open-quote')">繼續編輯 v{{ quoteVersion }}</el-button>
          </template>
          <template v-else-if="editable">
            <el-button type="primary" :disabled="!canSubmit" @click="emit('submit')">{{ submitLabel }}</el-button>
            <el-button text @click="emit('open-quote')">前往報價單</el-button>
          </template>
          <template v-else-if="showRoute && approval">
            <el-button @click="emit('open-approval', approval.id)">開啟簽核單</el-button>
            <el-button v-if="order" text @click="emit('open-order', order.soNo)">查看 {{ order.soNo }}</el-button>
          </template>
          <template v-else>
            <el-button text @click="emit('open-quote')">前往報價單</el-button>
          </template>
        </div>
        <p v-if="editable && blockers.length" class="muted small blockers">{{ blockers.join('、') }}</p>
      </template>
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
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 14px;
}

.notice {
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 13px;
}

.checklist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checklist li .row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-height: 28px;
  margin: 0;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
}

/* 未完成的條件是按鈕：點了跳到該欄位 */
.checklist li.incomplete .row {
  cursor: pointer;
}

.checklist li.incomplete .row:hover {
  background: var(--amber-soft);
}

.checklist li.incomplete .lbl {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}

.checklist .ico {
  font-size: 16px;
}

.checklist li.complete .ico {
  color: var(--teal);
}

.checklist li.incomplete {
  color: var(--amber);
}

.checklist li.incomplete .ico {
  color: var(--amber);
}

.checklist li.na {
  color: var(--muted);
}

.checklist li.na .ico {
  color: var(--line-strong);
}

.detail {
  font-size: 12px;
  color: var(--muted);
  text-align: right;
  white-space: nowrap;
}

li.incomplete .detail {
  color: var(--amber);
}

.route {
  margin-top: 2px;
}

.line {
  margin: 0;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.actions .el-button + .el-button {
  margin-left: 0;
}

.blockers {
  margin: 0;
}

.small {
  font-size: 12px;
}

@media (max-width: 760px) {
  .checklist li .row {
    grid-template-columns: 18px minmax(0, 1fr);
  }

  .detail {
    grid-column: 2;
    text-align: left;
  }
}
</style>
