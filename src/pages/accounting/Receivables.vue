<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isGuarantee, isOrderClosed, milestoneTaxes, type Milestone, type Order } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { useJump } from '../../composables/useJump'
import { money, localToday } from '../../utils/format'

/*
 * 應收／開票：會計、財務主管的工作頁（執行長檢視）。
 * 資料是 SO 的請款期別，只存一份；業務在 SO「通知開票」後出現在「待開票」，
 * 開立發票、收款入帳、退回請款都在這裡做，結果回寫 SO。
 */
const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { goSo, canSo } = useJump()
const canEdit = computed(() => store.can('/accounting/ar', 'edit'))
const today = localToday()

type Row = { o: Order; i: number; m: Milestone; tax: number; overdue: boolean }
const all = computed<Row[]>(() =>
  store.scopedOrders
    .filter((o) => !isGuarantee(o) && !o.voidedAt)
    .flatMap((o) => {
      const taxes = milestoneTaxes(o)
      return o.milestones.map((m, i) => ({ o, i, m, tax: taxes[i] ?? 0, overdue: m.status === '已開票' && !!m.planPayAt && m.planPayAt < today }))
    }),
)
const VIEWS = ['待開票', '已開票未收', '逾期未收', '已收款', '尚未請款'] as const
type View = (typeof VIEWS)[number]
const match = (r: Row, v: View) =>
  v === '待開票' ? r.m.status === '已申請' : v === '已開票未收' ? r.m.status === '已開票' : v === '逾期未收' ? r.overdue : v === '已收款' ? r.m.status === '已收款' : r.m.status === '待請款'
const view = ref<View>('待開票')
const soFilter = ref('')
/* 從 SO 抽屜「到應收處理」、首頁收件匣進來：?so= 只看那一張、?view= 切頁簽；已在這頁時再點也要生效 */
watch(
  () => [route.query.so, route.query.view],
  ([so, v]) => {
    if (typeof v === 'string' && (VIEWS as readonly string[]).includes(v)) view.value = v as View
    if (typeof so === 'string') {
      soFilter.value = so
      const first = all.value.find((r) => r.o.soNo === so && (r.m.status === '已申請' || r.m.status === '已開票'))
      if (first) view.value = first.m.status === '已申請' ? '待開票' : first.overdue ? '逾期未收' : '已開票未收'
    }
    if (so || v) router.replace({ query: {} })
  },
  { immediate: true },
)
const q = ref('')
const rows = computed(() =>
  all.value
    .filter((r) => match(r, view.value))
    .filter((r) => !soFilter.value || r.o.soNo === soFilter.value)
    .filter((r) => {
      const k = q.value.trim()
      return !k || [r.o.customer, r.o.soNo, r.o.owner, r.m.label, r.m.invoiceNo ?? ''].some((x) => x.includes(k))
    })
    .sort((a, b) => (view.value === '待開票' ? (a.m.requestedAt ?? '').localeCompare(b.m.requestedAt ?? '') : (a.m.planPayAt ?? '').localeCompare(b.m.planPayAt ?? ''))),
)
const sumTax = computed(() => rows.value.reduce((n, r) => n + r.tax, 0))
const mmdd = (d?: string) => (d ? d.slice(5).replace('-', '/') : '—')
const daysLate = (d?: string) => (d ? Math.max(0, Math.round((new Date(today).getTime() - new Date(d).getTime()) / 86400000)) : 0)

async function issue(r: Row) {
  const { value } = await ElMessageBox.prompt('發票號碼', `開立發票｜${r.o.soNo} 第 ${r.i + 1} 期 ${r.m.label}`, { inputValue: 'AB-', inputPlaceholder: '例：AB-12345678', confirmButtonText: '已開立', cancelButtonText: '取消', inputValidator: (v) => /^[A-Z]{2}-\d{8}$/.test(v.trim()) || '格式：兩碼英文加 8 碼數字' }).catch(() => ({ value: '' }))
  if (!value) return
  store.issueInvoice(r.o, r.i, value.trim())
  ElMessage.success(`第 ${r.i + 1} 期發票已開立，業務會收到通知`)
}
async function paid(r: Row) {
  const ok = await ElMessageBox.confirm(`確認 ${r.o.soNo} 第 ${r.i + 1} 期 ${r.m.label} 已收款 ${money(r.tax)}（含稅）？`, '收款入帳', { confirmButtonText: '已收款', cancelButtonText: '取消' }).then(() => true, () => false)
  if (!ok) return
  store.confirmPaid(r.o, r.i)
  ElMessage.success(isOrderClosed(r.o) ? '已收款，訂單結案' : '已收款，業務會收到通知')
}
async function sendBack(r: Row) {
  const { value } = await ElMessageBox.prompt('退回原因（業務會收到通知，改好期別再重新通知開票）', `退回請款｜${r.o.soNo} 第 ${r.i + 1} 期`, { confirmButtonText: '退回', cancelButtonText: '取消', inputValidator: (v) => !!v.trim() || '請填退回原因' }).catch(() => ({ value: '' }))
  if (!value) return
  if (store.returnBilling(r.o, r.i, value)) ElMessage.success('已退回業務')
}
/* 改預計收款日：客戶付款條件變動時由會計更新，逾期判斷跟著變 */
async function editPayAt(r: Row) {
  const { value } = await ElMessageBox.prompt('預計收款日（YYYY-MM-DD）', `${r.o.soNo} 第 ${r.i + 1} 期`, { inputValue: r.m.planPayAt ?? '', confirmButtonText: '更新', cancelButtonText: '取消', inputValidator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) || '格式：YYYY-MM-DD' }).catch(() => ({ value: '' }))
  if (!value) return
  r.m.planPayAt = value.trim()
  ElMessage.success('預計收款日已更新')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>應收／開票</h1>
      </div>
      <div class="actions">
        <el-input v-model="q" placeholder="客戶、SO、業務、發票號碼" clearable style="width: 260px" />
      </div>
    </div>
    <div class="chips">
      <button v-for="v in VIEWS" :key="v" type="button" class="chip" :class="{ on: view === v, hot: v === '逾期未收' }" @click="view = v">{{ v }}<span class="count">{{ all.filter((r) => match(r, v)).length }}</span></button>
      <span v-if="soFilter" class="tag slate so-filter">只看 {{ soFilter }} <a class="link" @click="soFilter = ''">清除</a></span>
    </div>
    <section class="panel">
      <table class="plain-table ar">
        <thead>
          <tr>
            <th>客戶 / SO</th><th>期別</th><th class="num">未稅</th><th class="num">含稅</th>
            <th>{{ view === '待開票' ? '通知開票' : '預計開票' }}</th><th>預計收款</th><th>發票</th><th>業務</th><th v-if="canEdit"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.o.id + '-' + r.i">
            <td><b>{{ r.o.customer }}</b><div class="muted small"><a v-if="canSo" class="link id" @click="goSo(r.o.soNo)">{{ r.o.soNo }}</a><span v-else class="id">{{ r.o.soNo }}</span></div></td>
            <td>第 {{ r.i + 1 }} 期<div class="muted small">{{ r.m.label }}</div></td>
            <td class="num">{{ money(r.m.amount) }}</td>
            <td class="num"><b>{{ money(r.tax) }}</b></td>
            <td class="id">{{ view === '待開票' ? mmdd(r.m.requestedAt) : mmdd(r.m.planInvoiceAt) }}</td>
            <td class="id" :class="{ over: r.overdue }">{{ mmdd(r.m.planPayAt) }}<div v-if="r.overdue" class="small over">逾期 {{ daysLate(r.m.planPayAt) }} 天</div></td>
            <td class="id">{{ r.m.invoiceNo ?? '—' }}<div v-if="r.m.paidAt" class="muted small">收款 {{ mmdd(r.m.paidAt) }}</div></td>
            <td>{{ r.o.owner }}</td>
            <td v-if="canEdit" class="acts">
              <template v-if="r.m.status === '已申請'">
                <el-button size="small" type="primary" @click="issue(r)">開立發票</el-button>
                <el-button size="small" text @click="sendBack(r)">退回</el-button>
              </template>
              <template v-else-if="r.m.status === '已開票'">
                <el-button size="small" type="primary" @click="paid(r)">收款入帳</el-button>
                <el-button size="small" text @click="editPayAt(r)">改收款日</el-button>
              </template>
            </td>
          </tr>
          <tr v-if="!rows.length"><td :colspan="canEdit ? 9 : 8" class="muted">沒有符合的期別</td></tr>
        </tbody>
        <tfoot v-if="rows.length">
          <tr><td colspan="3" class="muted">共 {{ rows.length }} 期</td><td class="num"><b>{{ money(sumTax) }}</b></td><td :colspan="canEdit ? 5 : 4"></td></tr>
        </tfoot>
      </table>
    </section>
  </div>
</template>

<style scoped>
.so-filter {
  margin-left: 8px;
}

.ar td.acts {
  white-space: nowrap;
  text-align: right;
}

.over {
  color: var(--red);
}
</style>
