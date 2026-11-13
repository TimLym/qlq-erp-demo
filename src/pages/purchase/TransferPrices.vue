<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { stock, quotes, purchaseOrders, transferPrices, transferChanges, type TransferChange } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { money, dateTime } from '../../utils/format'
import { evaluate } from '../../mock/routing'

const store = useAppStore()
const canEdit = computed(() => store.role === '採購' || store.role === '執行長')

/* 料號清單：庫存、報價單、PO 出現過的對內 SKU 聯集 */
const rows = computed(() => {
  const names = new Map<string, string>()
  stock.forEach((s) => names.set(s.sku, s.name))
  quotes.forEach((q) => q.lines.forEach((l) => l.intSku && !names.has(l.intSku) && l.vendor !== '自有工程' && names.set(l.intSku, l.extName)))
  purchaseOrders.forEach((p) => p.lines.forEach((l) => !names.has(l.intSku) && names.set(l.intSku, l.extName)))
  return [...names.entries()]
    .map(([sku, name]) => {
      const batches = stock.filter((s) => s.sku === sku).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
      const qty = batches.reduce((n, b) => n + b.qty, 0)
      const fifo = batches.find((b) => b.qty - b.reserved > 0)?.unitCost ?? batches[0]?.unitCost
      const avg = qty ? Math.round(batches.reduce((n, b) => n + b.qty * b.unitCost, 0) / qty) : undefined
      const lastPo = purchaseOrders
        .filter((p) => p.status !== '待核准' && p.lines.some((l) => l.intSku === sku))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      const lastPoCost = lastPo?.lines.find((l) => l.intSku === sku)?.unitCost
      const price = transferPrices[sku]
      const ref = fifo ?? lastPoCost
      const gap = price !== undefined && ref ? (price - ref) / ref : undefined
      const pending = transferChanges.find((c) => c.sku === sku && c.status === '待核准')
      const last = transferChanges.filter((c) => c.sku === sku && c.status === '已核准').sort((a, b) => b.at.localeCompare(a.at))[0]
      return { sku, name, price, fifo, avg, lastPoCost, gap, qty, pending, last }
    })
    .sort((a, b) => (a.price === undefined ? 1 : 0) - (b.price === undefined ? 1 : 0) || a.sku.localeCompare(b.sku))
})

/* 提出變更 */
const editing = ref<(typeof rows.value)[number] | null>(null)
const form = ref({ price: 0, reason: '', promoUntil: '' })
function startEdit(r: (typeof rows.value)[number]) {
  editing.value = r
  form.value = { price: r.price ?? r.fifo ?? r.lastPoCost ?? 0, reason: '', promoUntil: '' }
}
function submit() {
  const r = editing.value
  if (!r) return
  if (form.value.price <= 0 || !form.value.reason.trim()) {
    ElMessage.warning('品項參考成本要大於 0，原因必填')
    return
  }
  const now = new Date()
  const id = `tp-${now.getTime()}`
  const approvalId = `a-${now.getTime()}-tp`
  const ev = evaluate('品項參考成本', { applicantId: store.currentUserId, facts: { amount: form.value.price, changePct: r.price ? (Math.abs(form.value.price - r.price) / r.price) * 100 : 0 } })
  const change: TransferChange = {
    id,
    sku: r.sku,
    name: r.name,
    from: r.price,
    to: form.value.price,
    reason: form.value.reason.trim(),
    promoUntil: form.value.promoUntil || undefined,
    requestedBy: store.currentUser.name,
    at: now.toISOString(),
    status: '待核准',
    approvalId,
  }
  transferChanges.unshift(change)
  store.approvals.unshift({
    id: approvalId,
    type: '品項參考成本',
    title: `品項參考成本：${r.name}（${r.sku}）${r.price !== undefined ? `${money(r.price)} → ` : ''}${money(form.value.price)}${form.value.promoUntil ? `，促銷至 ${form.value.promoUntil}` : ''}`,
    refNo: r.sku,
    submitterId: store.currentUserId,
    submitter: store.currentUser.name,
    submittedAt: now.toISOString(),
    amount: form.value.price,
    route: ev.route,
    steps: ev.steps,
    flags: r.price && Math.abs(form.value.price - r.price) / r.price >= 0.1 ? ['異動逾 10%'] : undefined,
    currentStep: 0,
    status: '待簽核',
    reason: change.reason,
    diff: [
      { field: '品項參考成本', before: r.price !== undefined ? money(r.price) : '（未設定）', after: money(form.value.price) },
      ...(r.fifo !== undefined ? [{ field: '目前先進先出批次成本', before: money(r.fifo), after: money(r.fifo) }] : []),
      ...(r.lastPoCost !== undefined ? [{ field: '最近 PO 成本', before: money(r.lastPoCost), after: money(r.lastPoCost) }] : []),
    ],
    history: [{ role: store.role, name: store.currentUser.name, action: '送出', at: now.toISOString() }],
  })
  store.todos.unshift({ id: `t-${now.getTime()}-tp`, kind: '簽核', title: `品項參考成本：${r.name} ${money(form.value.price)}`, refNo: r.sku, forRoles: [ev.route[0]!], forUserIds: ev.steps[0]?.candidateIds, approvalId, createdAt: now.toISOString() })
  editing.value = null
  ElMessage.success('已送財務主管核准；核准前送審的案仍用舊價，核准後新送審的案才用新價')
}
const gapClass = (g: number | undefined) => (g === undefined ? '' : Math.abs(g) >= 0.1 ? 'gap-big' : '')
const history = computed(() => [...transferChanges].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10))
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>料號與品項參考成本</h1>
      </div>
    </div>

    <section class="panel">
      <table class="plain-table">
        <thead><tr><th>料號</th><th class="num">品項參考成本</th><th class="num">先進先出批次成本</th><th class="num">加權平均</th><th class="num">最近 PO 成本</th><th class="num">差異</th><th class="num">庫存</th><th>最後更新</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.sku">
            <td><b>{{ r.name }}</b><div class="muted small">{{ r.sku }}</div></td>
            <td class="num"><b v-if="r.price !== undefined">{{ money(r.price) }}</b><span v-else class="tag amber">未設定</span><div v-if="r.pending" class="muted small">待核准 → {{ money(r.pending.to) }}</div></td>
            <td class="num">{{ r.fifo !== undefined ? money(r.fifo) : '—' }}</td>
            <td class="num">{{ r.avg !== undefined ? money(r.avg) : '—' }}</td>
            <td class="num">{{ r.lastPoCost !== undefined ? money(r.lastPoCost) : '—' }}</td>
            <td class="num" :class="gapClass(r.gap)">{{ r.gap === undefined ? '—' : `${r.gap >= 0 ? '+' : ''}${(r.gap * 100).toFixed(1)}%` }}</td>
            <td class="num">{{ r.qty || '—' }}</td>
            <td class="small">
              <template v-if="r.last">{{ r.last.requestedBy }} · {{ dateTime(r.last.at) }}<div class="muted">{{ r.last.reason }}</div></template>
              <span v-else class="muted">—</span>
            </td>
            <td><el-button v-if="canEdit" size="small" :disabled="!!r.pending" @click="startEdit(r)">{{ r.price === undefined ? '設定' : '調整' }}</el-button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>異動紀錄</h2></div>
      <table class="plain-table">
        <thead><tr><th>時間</th><th>料號</th><th class="num">原價</th><th class="num">新價</th><th>原因</th><th>提出</th><th>狀態</th></tr></thead>
        <tbody>
          <tr v-for="c in history" :key="c.id">
            <td class="id">{{ c.at.slice(0, 10) }}</td>
            <td>{{ c.name }}<div class="muted small">{{ c.sku }}</div></td>
            <td class="num">{{ c.from !== undefined ? money(c.from) : '—' }}</td>
            <td class="num">{{ money(c.to) }}{{ c.promoUntil ? `（促銷至 ${c.promoUntil}）` : '' }}</td>
            <td>{{ c.reason }}</td>
            <td>{{ c.requestedBy }}</td>
            <td><span class="tag" :class="c.status === '已核准' ? 'olive' : c.status === '已退回' ? 'red' : 'amber'">{{ c.status }}</span></td>
          </tr>
          <tr v-if="!history.length"><td colspan="7" class="muted">還沒有異動</td></tr>
        </tbody>
      </table>
    </section>

    <el-dialog :model-value="!!editing" :title="editing ? `${editing.price === undefined ? '設定' : '調整'}品項參考成本：${editing.name}` : ''" width="520px" @update:model-value="(v: boolean) => { if (!v) editing = null }">
      <template v-if="editing">
        <dl class="ref">
          <dt>目前品項參考成本</dt><dd class="num">{{ editing.price !== undefined ? money(editing.price) : '未設定' }}</dd>
          <dt>先進先出批次成本</dt><dd class="num">{{ editing.fifo !== undefined ? money(editing.fifo) : '—' }}</dd>
          <dt>最近 PO 成本</dt><dd class="num">{{ editing.lastPoCost !== undefined ? money(editing.lastPoCost) : '—' }}</dd>
        </dl>
        <el-form label-position="top">
          <el-form-item label="新品項參考成本" required><el-input-number v-model="form.price" :min="0" :step="1000" style="width: 100%" /></el-form-item>
          <el-form-item label="原因" required><el-input v-model="form.reason" placeholder="例：原廠 11 月牌價調整；出清 2026-03 批次" /></el-form-item>
          <el-form-item label="促銷有效期（到期自動回復）"><el-date-picker v-model="form.promoUntil" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="editing = null">取消</el-button>
        <el-button type="primary" @click="submit">送財務主管核准</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.panel {
  margin-bottom: 14px;
}

.gap-big {
  color: var(--amber);
  font-weight: 600;
}

.foot {
  margin: 10px 0 0;
}

.ref {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  margin: 0 0 12px;
  font-size: 13px;
}

.ref dt {
  color: var(--muted);
}

.ref dd {
  margin: 0;
}

.small {
  font-size: 12px;
}
</style>
