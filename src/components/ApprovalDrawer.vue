<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app'
import { deals, quotes, orders, transferOf } from '../mock/data'
import { money, pct, dateTime } from '../utils/format'
import ApprovalRoute from './ApprovalRoute.vue'

const props = defineProps<{ approvalId: string | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'open-deal', id: string): void }>()
const store = useAppStore()

const open = computed({
  get: () => !!props.approvalId,
  set: (v) => {
    if (!v) emit('close')
  },
})

const a = computed(() => store.approvals.find((x) => x.id === props.approvalId))
const deal = computed(() => (a.value?.dealId ? deals.find((d) => d.id === a.value!.dealId) : undefined))
const order = computed(() => (a.value?.dealId ? orders.find((o) => o.dealId === a.value!.dealId) : undefined))
const showCompany = computed(() => store.role !== '業務')
const quote = computed(() => {
  if (!a.value?.dealId) return undefined
  return quotes.filter((q) => q.dealId === a.value!.dealId).sort((x, y) => y.version - x.version)[0]
})
/* 廠商還在議價的採購項次：採購稽核時要知道成本還會變 */
const bargainCount = computed(() => (a.value?.type === '上單' ? (quote.value?.lines ?? []).filter((l) => l.bargaining && !l.vendorQuoteFile).length : 0))

const canAct = computed(() => !!a.value && store.canActOn(a.value))
const isAuditStep = computed(() => canAct.value && store.role === '採購' && a.value?.type === '上單')

const margin = computed(() => (a.value && a.value.cost !== undefined && a.value.amount > 0 ? (a.value.amount - a.value.cost) / a.value.amount : null))

/* 送件人在第一關還沒回應前可以收回 */
const canRecall = computed(() => !!a.value && a.value.status === '待簽核' && a.value.currentStep === 0 && a.value.submitterId === store.currentUserId)
/* 駁回：回上一關；第一關沒有上一關，只能退回 */
const canSendBack = computed(() => canAct.value && (a.value?.currentStep ?? 0) > 0)

const note = ref('')
/** none＝核准模式；reject＝退回（整張重來）；back＝駁回（回上一關） */
const mode = ref<'none' | 'reject' | 'back'>('none')
watch(() => props.approvalId, () => {
  note.value = ''
  mode.value = 'none'
})

function doApprove() {
  if (!a.value) return
  store.approve(a.value.id, note.value || undefined)
  ElMessage.success(isAuditStep.value ? '稽核完成，已交給下一關' : '已核准，代辦已從清單移除')
  emit('close')
}

function doReject() {
  if (!a.value) return
  if (!note.value.trim()) {
    ElMessage.warning(mode.value === 'back' ? '駁回需填寫原因，上一關才知道要看什麼' : '退回需填寫原因，送件人才知道要改什麼')
    return
  }
  if (mode.value === 'back') {
    const prev = a.value.route[a.value.currentStep - 1]
    store.sendBack(a.value.id, note.value.trim())
    ElMessage.success(`已駁回，回到 ${prev} 重簽`)
  } else {
    store.reject(a.value.id, note.value.trim())
    ElMessage.success('已退回，送件人會收到代辦與通知')
  }
  emit('close')
}

function doRecall() {
  if (!a.value) return
  store.recall(a.value.id)
  ElMessage.success('已收回，單據已解鎖，修改後可重新送審')
  emit('close')
}

const typeTag: Record<string, string> = { 上單: 'teal', PO: 'slate', 預付: 'amber', 供應商建檔: 'olive' }
</script>

<template>
  <el-drawer v-model="open" size="720px" :with-header="false" destroy-on-close>
    <div v-if="a" class="drawer">
      <header class="head">
        <div>
          <div class="eyebrow">
            <span class="tag" :class="typeTag[a.type]">{{ a.type }}</span>
            <span class="num">{{ a.refNo }}</span>
            <span v-if="a.postHoc" class="tag red">事後追認</span><span v-for="f in a.flags ?? []" :key="f" class="tag amber">{{ f }}</span><span v-if="bargainCount" class="tag amber">{{ bargainCount }} 項議價中</span>
            <span v-if="a.diff && a.type === '上單'" class="tag amber">重審</span>
            <span v-if="a.diff && a.type === 'PO'" class="tag red">成本異動</span>
          </div>
          <h2>{{ a.title }}</h2>
          <p class="muted">{{ a.submitter }} 送出 · {{ dateTime(a.submittedAt) }}</p>
        </div>
        <el-button @click="emit('close')">關閉</el-button>
      </header>

      <div class="body">
        <section class="block">
          <h3>簽核進度</h3>
          <ApprovalRoute :route="a.route" :current="a.currentStep" :status="a.status" />
          <p v-if="a.status === '待簽核' && a.steps?.[a.currentStep]" class="muted small">目前關卡：{{ a.steps[a.currentStep]!.label }}</p>
          <p v-if="a.postHoc" class="notice red">此案已先向原廠下單，事後追認。</p>
        </section>

        <section class="block">
          <h3>金額與毛利</h3>
          <dl class="kv">
            <dt>{{ a.type === '預付' ? '預付金額' : a.type === '品項參考成本' ? '新品項參考成本' : a.type === '申請' ? '申請金額' : a.type === '供應商建檔' ? '金額' : '售價合計' }}</dt>
            <dd class="num">{{ money(a.amount) }}</dd>
            <template v-if="a.cost !== undefined">
              <dt>成本合計</dt>
              <dd class="num">{{ money(a.cost) }}</dd>
              <dt>{{ a.type === '上單' ? '業務毛利' : '毛利率' }}</dt>
              <dd class="num" :class="{ neg: (margin ?? 0) < 0, low: (margin ?? 1) >= 0 && (margin ?? 1) < 0.05 }">
                {{ pct(margin) }}
                <span v-if="(margin ?? 0) < 0" class="tag red">負毛利</span>
                <span v-else-if="(margin ?? 1) < 0.05" class="tag amber">低於門檻</span>
              </dd>
              <template v-if="a.type === '上單' && showCompany && order?.actualCost !== undefined">
                <dt>公司毛利</dt>
                <dd class="num">{{ pct((a.amount - order.actualCost) / a.amount) }}<span class="muted small">公司成本 {{ money(order.actualCost) }}（PO 實際＋庫存批次）</span></dd>
              </template>
            </template>
            <dt>送審理由</dt>
            <dd>{{ a.reason ?? '—' }}</dd>
          </dl>
        </section>

        <section v-if="a.diff" class="block">
          <h3>{{ a.type === 'PO' ? '成本異動（送審預估 → PO 實際）' : a.type === '品項參考成本' ? '品項參考成本異動（參考成本一併列出）' : '與上一版的差異' }}</h3>
          <table class="plain-table diff">
            <thead><tr><th>欄位</th><th>{{ a.type === 'PO' ? '預估' : a.type === '品項參考成本' ? '目前' : '上一版' }}</th><th>{{ a.type === 'PO' ? '實際' : a.type === '品項參考成本' ? '新' : '本版' }}</th></tr></thead>
            <tbody>
              <tr v-for="d in a.diff" :key="d.field">
                <td>{{ d.field }}</td>
                <td class="before num">{{ d.before }}</td>
                <td class="after num">{{ d.after }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-if="quote" class="block">
          <h3>
            報價明細 v{{ quote.version }}
            <button v-if="deal" type="button" class="link" @click="emit('open-deal', deal.id)">開啟商機</button>
          </h3>
          <table class="plain-table">
            <thead>
              <tr>
                <th>#</th><th>品名</th><th>對內 SKU</th><th class="num">數量</th><th class="num">單價</th>
                <th class="num">{{ isAuditStep ? '業務填成本' : '小計 / 成本' }}</th>
                <th v-if="isAuditStep" class="num">採購回填</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="i in quote.items" :key="i.no">
                <tr class="ext-row">
                  <td class="num">{{ i.no }}</td>
                  <td><b>{{ i.custName }}</b><span v-if="i.custSku" class="muted small"> {{ i.custSku }}</span></td>
                  <td></td>
                  <td class="num">{{ i.qty }}</td>
                  <td class="num">{{ money(i.unitPrice) }}</td>
                  <td class="num muted">{{ money(i.qty * i.unitPrice) }}</td>
                  <td v-if="isAuditStep"></td>
                </tr>
                <tr v-for="(l, k) in quote.lines.filter((x) => x.itemNo === i.no)" :key="l.no" class="int-row">
                  <td class="num muted">{{ i.no }}.{{ k + 1 }}</td>
                  <td class="muted">{{ l.extName }}<span class="small"> · {{ l.vendor }}</span><span v-if="l.bargaining && !l.vendorQuoteFile" class="tag amber">議價中</span></td>
                  <td class="muted">{{ l.intSku }}</td>
                  <td class="num">{{ l.qty }}</td>
                  <td></td>
                  <td class="num">
                    <template v-if="l.stockQty && l.stockQty >= l.qty">{{ money(transferOf(l.intSku) ?? 0) }}<div class="muted small">用庫存 · 品項參考成本</div></template>
                    <template v-else-if="l.stockQty">{{ l.unitCost === null ? '—' : money(l.unitCost) }}<div class="muted small">庫存 {{ l.stockQty }} 台用品項參考成本 {{ money(transferOf(l.intSku) ?? 0) }}</div></template>
                    <template v-else>{{ l.unitCost === null ? '—' : money(l.unitCost) }}<div v-if="l.insistReason" class="muted small">庫存夠仍採購：{{ l.insistReason }}</div></template>
                  </td>
                  <td v-if="isAuditStep" class="num"><el-input size="small" :model-value="l.unitCost ?? ''" class="cost-input" /></td>
                </tr>
              </template>
            </tbody>
          </table>
        </section>

        <section class="block">
          <h3>簽核歷程</h3>
          <ol class="history">
            <li v-for="(h, i) in a.history" :key="i">
              <span class="h-when num">{{ dateTime(h.at) }}</span>
              <span class="h-who">{{ h.name }}<span class="muted">（{{ h.role }}）</span></span>
              <span class="h-action" :class="{ reject: h.action === '退回' || h.action === '收回', back: h.action === '駁回' }">{{ h.action }}</span>
              <span v-if="h.note" class="h-note muted">{{ h.note }}</span>
            </li>
          </ol>
        </section>
      </div>

      <footer v-if="canAct" class="foot">
        <el-input v-model="note" type="textarea" :rows="2" :placeholder="mode === 'reject' ? '退回原因 *' : mode === 'back' ? '駁回原因 *' : '意見'" />
        <div class="foot-actions">
          <template v-if="mode === 'none'">
            <el-button v-if="canRecall" @click="doRecall">收回</el-button>
            <el-button @click="mode = 'reject'">退回</el-button>
            <el-button v-if="canSendBack" @click="mode = 'back'">駁回</el-button>
            <el-button type="primary" @click="doApprove">{{ isAuditStep ? '稽核完成，送下一關' : '核准' }}</el-button>
          </template>
          <template v-else>
            <el-button @click="mode = 'none'">取消</el-button>
            <el-button type="danger" @click="doReject">{{ mode === 'back' ? '確認駁回' : '確認退回' }}</el-button>
          </template>
        </div>
      </footer>
      <footer v-else-if="canRecall" class="foot">
        <div class="foot-actions">
          <el-button @click="doRecall">收回</el-button>
        </div>
      </footer>
      <footer v-else class="foot muted">
        <span v-if="a.status === '待簽核'">目前關卡為 {{ a.route[a.currentStep] }}。</span>
        <span v-else>此單已{{ a.status === '已核准' ? '核准' : a.status === '已收回' ? '由送件人收回' : '退回' }}。</span>
      </footer>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 6px;
}

.head h2 {
  font-size: 19px;
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 24px 24px;
}

.block {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.block:last-child {
  border-bottom: none;
}

.block h3 {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.link {
  border: none;
  background: none;
  color: var(--teal);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.notice {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 13px;
}

.neg {
  color: var(--red);
  font-weight: 600;
}

.low {
  color: var(--amber);
  font-weight: 600;
}

.diff .before {
  color: var(--muted);
  text-decoration: line-through;
}

.diff .after {
  font-weight: 600;
  background: var(--amber-soft);
}

.cost-input {
  width: 110px;
}

.small {
  font-size: 12px;
  margin-top: 8px;
}

.history {
  list-style: none;
  margin: 0;
  padding: 0;
}

.history li {
  display: grid;
  grid-template-columns: 150px 150px auto;
  gap: 4px 12px;
  padding: 6px 0;
  font-size: 13px;
  align-items: baseline;
}

.h-when {
  color: var(--muted);
}

.h-action {
  font-weight: 500;
  color: var(--teal-ink);
}

.h-action.back {
  color: var(--amber);
}

.hint {
  flex: 1;
}

.h-action.reject {
  color: var(--red);
}

.h-note {
  grid-column: 3;
}

.foot {
  padding: 14px 24px;
  border-top: 1px solid var(--line);
  background: var(--paper);
}

.foot-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>
