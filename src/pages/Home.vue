<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { shipments, isGuarantee, dueToRequest, overduePay } from '../mock/data'
import { YEAR, YEARS, depts, deptOf, repSummary, deptSummary, companySummary, type Dept, type Summary } from '../mock/performance'
import { money, pct, dateTime } from '../utils/format'
import KpiBars from '../components/KpiBars.vue'
import KpiCard from '../components/KpiCard.vue'

const store = useAppStore()

/*
 * 首頁版面（由上到下）：現在的四張卡 → 待辦與公告（固定高度）→ 業績詳情（逐月圖 + 群組卡）。
 * 第一列四張卡永遠是「現在」：業務與主管是自己、執行長是全公司，今年到本月。
 * 業績詳情可以切年度（Demo 存五年）；執行長還可以切事業部。群組卡放在圖的下面：主管看自己事業部的團隊，執行長看各事業部。
 * 數字和「業務 › 業績與獎金」頁同一份（src/mock/performance.ts）。
 */
const monthLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
const chartOf = (s: Summary) => ({
  actual: s.months.map((r) => (r.month <= s.lastMonth ? r.actual : null)),
  target: s.months.map((r) => r.target),
})
const ytdNote = (s: Summary) => `年初至今目標 ${money(s.ytdTarget)}，達 ${Math.round((s.ytdActual / s.ytdTarget) * 100)}%`
/** 今年叫「本月」，往年就是 12 月 */
const monthWord = (s: Summary) => (s.year === YEAR ? '本月' : ` ${s.lastMonth} 月`)

const isCeo = computed(() => store.role === '執行長')
const myDept = computed(() => deptOf(store.currentUserId))
const primary = computed<Summary | null>(() => (isCeo.value ? companySummary() : repSummary(store.currentUserId)))

const year = ref<number>(YEAR)
const scope = ref<'all' | Dept>('all')
const chartKey = ref<'me' | 'team'>('me')
/* 群組卡：主管看自己事業部的團隊；執行長看選的事業部，選全公司就每個事業部一組 */
const groups = computed(() => {
  if (store.role === '業務主管' && myDept.value) return [{ key: 'team', label: `${myDept.value}團隊`, s: deptSummary(myDept.value, year.value) }]
  if (isCeo.value) return (scope.value === 'all' ? [...depts] : [scope.value]).map((d) => ({ key: d, label: d, s: deptSummary(d, year.value) }))
  return []
})
/* 逐月圖：業務看自己；主管可切我的／團隊；執行長看選的範圍 */
const chartSummary = computed<Summary | null>(() => {
  if (isCeo.value) return scope.value === 'all' ? companySummary(year.value) : deptSummary(scope.value, year.value)
  if (chartKey.value === 'team' && groups.value[0]) return groups.value[0].s
  return repSummary(store.currentUserId, year.value)
})
/* 執行長：各事業部一列的表，事業部再多也只是多一列；點一列就把圖切到那個事業部 */
const rate = (a: number, t: number) => (t ? a / t : 0)
/* 事業部依年度達成率排序，全公司固定最後；選到的那一列移到第一列（TransitionGroup 做位移動畫） */
const deptRows = computed(() => {
  if (!isCeo.value) return []
  const rows = depts
    .map((d) => ({ key: d as string, label: d as string, s: deptSummary(d, year.value), company: false }))
    .sort((a, b) => rate(b.s.ytdActual, b.s.yearTarget) - rate(a.s.ytdActual, a.s.yearTarget))
  rows.push({ key: 'all', label: '全公司', s: companySummary(year.value), company: true })
  const i = rows.findIndex((r) => r.key === scope.value)
  if (i > 0) rows.unshift(...rows.splice(i, 1))
  return rows
})
const companyRow = computed(() => (isCeo.value ? companySummary(year.value) : null))
function pickRow(key: string) {
  scope.value = key === 'all' || scope.value === key ? 'all' : (key as Dept)
}
const rateClass = (r: number) => (r >= 1 ? 'hit' : r >= 0.8 ? 'near' : 'low')
/* 換示範身分時把選項歸零 */
watch(() => store.currentUserId, () => { year.value = YEAR; scope.value = 'all'; chartKey.value = 'me' })

/* ---------- 待辦：像收件匣一列一類，數字加上最急的一件，點整列到對應頁 ---------- */
const TODAY = new Date('2026-10-08')
const scopedSo = computed(() => new Set(store.scopedOrders.map((o) => o.soNo)))
const waitingShipments = computed(() =>
  shipments
    .filter((s) => s.status === '已出貨' && scopedSo.value.has(s.soNo))
    .map((s) => ({ s, days: Math.round((TODAY.getTime() - new Date(s.at).getTime()) / 86400000) }))
    .sort((a, b) => b.days - a.days),
)
const expiring = computed(() => store.myExpiring)
/* 預留貨 3 天內到期（到期自動釋放） */
const holdsSoon = computed(() => store.myHoldsExpiring)
/* 待送開票：到了預計開票日、還沒通知財務開票的期數（業務常口頭講沒送系統） */
const toBill = computed(() =>
  ['業務', '業務主管', '執行長'].includes(store.role)
    ? store.scopedOrders.filter((o) => !isGuarantee(o)).flatMap((o) => dueToRequest(o, TODAY.toISOString().slice(0, 10)).map((m) => ({ o, m, i: o.milestones.indexOf(m) }))).sort((a, b) => (a.m.planInvoiceAt ?? '').localeCompare(b.m.planInvoiceAt ?? ''))
    : [],
)
/* 逾期未收：過了預計付款日還沒收款的期數（業務追款、財務對帳） */
const overdue = computed(() =>
  ['業務', '業務主管', '執行長', '財務主管', '會計'].includes(store.role)
    ? store.scopedOrders.filter((o) => !isGuarantee(o) && store.canSeeOrderMoney(o)).flatMap((o) => overduePay(o, TODAY.toISOString().slice(0, 10)).map((m) => ({ o, m }))).sort((a, b) => (a.m.planPayAt ?? '').localeCompare(b.m.planPayAt ?? ''))
    : [],
)
const inbox = computed<{ key: string; label: string; n: number; to: string; preview: string; urgent?: boolean }[]>(() => {
  const pending = store.pendingForMe
  const waiting = store.waitingOnOthers
  const ship = waitingShipments.value[0]
  const exp = expiring.value[0]
  const md = store.unreadMentionDeals[0]
  const mention = { key: 'mention', label: '提及我', n: store.unreadMentionTotal, to: md ? `/sales/pipeline?deal=${md.id}&tab=comments` : '/sales/pipeline', preview: md ? `${md.customer} ${md.product}，${store.unreadMentions(md.id).length} 則` : '' }
  const dispatch = store.myTodos.filter((t) => t.kind === '派工')
  /* 工程師當組長時也會收到派工代辦，一併算在工程支援 */
  const engJobs = store.myTodos.filter((t) => t.kind === '工程' || (store.role === '工程師' && t.kind === '派工'))
  if (store.role === '工程主管' || store.role === '工程師') {
    return [
      { key: 'dispatch', label: store.role === '工程主管' ? '待派工' : '工程支援', n: (store.role === '工程主管' ? dispatch : engJobs).length, to: '/sales/pipeline', preview: (store.role === '工程主管' ? dispatch : engJobs)[0]?.title ?? '', urgent: dispatch.some((t) => t.title.includes('急件')) },
      mention,
      { key: 'pending', label: '我待簽核', n: pending.length, to: '/approvals', preview: pending[0] ? `${pending[0].type}・${pending[0].title}` : '' },
      { key: 'waiting', label: '等待他人', n: waiting.length, to: '/approvals/mine', preview: waiting[0] ? `${waiting[0].title}，在${waiting[0].route[waiting[0].currentStep]}手上` : '' },
    ]
  }
  return [
    { key: 'pending', label: '我待簽核', n: pending.length, to: '/approvals', preview: pending[0] ? `${pending[0].type}・${pending[0].title}` : '' },
    { key: 'waiting', label: '等待他人', n: waiting.length, to: '/approvals/mine', preview: waiting[0] ? `${waiting[0].title}，在${waiting[0].route[waiting[0].currentStep]}手上` : '' },
    mention,
    { key: 'signoff', label: '等待簽收', n: waitingShipments.value.length, to: '/approvals/signoff', preview: ship ? `${ship.s.customer} 已等 ${ship.days} 天` : '', urgent: !!ship && ship.days > 14 },
    ...(toBill.value.length || ['業務', '業務主管', '執行長'].includes(store.role) ? [{ key: 'bill', label: '待送開票', n: toBill.value.length, to: toBill.value.length === 1 ? `/sales/orders?so=${toBill.value[0]!.o.soNo}` : '/sales/orders', preview: toBill.value[0] ? `${toBill.value[0].o.customer} 第 ${toBill.value[0].i + 1} 期 ${toBill.value[0].m.label}，預計 ${(toBill.value[0].m.planInvoiceAt ?? '').slice(5).replace('-', '/')}` : '', urgent: toBill.value.length > 0 }] : []),
    ...(holdsSoon.value.length ? [{ key: 'hold', label: '預留貨將到期', n: holdsSoon.value.length, to: '/inventory', preview: `${holdsSoon.value[0]!.sku} × ${holdsSoon.value[0]!.qty}，${holdsSoon.value[0]!.expiresAt!.slice(5).replace('-', '/')} 到期釋放`, urgent: true }] : []),
    ...(overdue.value.length ? [{ key: 'overdue', label: '逾期未收', n: overdue.value.length, to: overdue.value.length === 1 ? `/sales/orders?so=${overdue.value[0]!.o.soNo}` : '/sales/orders?fin=逾期未收', preview: `${overdue.value[0]!.o.customer} ${overdue.value[0]!.m.label}，${overdue.value[0]!.m.planPayAt!.slice(5).replace('-', '/')} 應收`, urgent: true }] : []),
    { key: 'expiry', label: '到期', n: expiring.value.length, to: expiring.value.length === 1 && exp ? `/inventory/licenses?lic=${exp.l.id}` : '/inventory/licenses', preview: exp ? `${exp.o.customer} ${exp.l.name}，${exp.l.expires.slice(5).replace('-', '/')} 到期` : '', urgent: !!exp && exp.left < 0 },
  ]
})

const expandedAnn = ref<string | null>(null)
</script>

<template>
  <div class="page home">
    <div class="page-head">
      <div>
        <h1>{{ store.currentUser.name }}，早安</h1>
      </div>
    </div>

    <div v-if="primary" class="cards four">
      <KpiCard :label="isCeo ? '公司本月業績' : '本月業績'" :value="primary.month.actual" :target="primary.month.target" target-label="本月 KPI" />
      <KpiCard :label="isCeo ? '公司年度業績' : '年度業績'" :value="primary.ytdActual" :target="primary.yearTarget" target-label="年度 KPI" :sub="ytdNote(primary)" />
      <KpiCard label="已發放獎金" :value="primary.bonusPaid" />
      <KpiCard label="預估年度獎金" :value="primary.bonusEstimate" />
    </div>

    <!-- 待辦收件匣與公告並排，高度固定，公告多了在面板內捲 -->
    <div class="bottom">
      <section class="panel inbox-panel">
        <div class="panel-head"><h2>待辦</h2></div>
        <ul class="inbox">
          <li v-for="r in inbox" :key="r.key">
            <RouterLink :to="r.to" class="row" :class="{ zero: !r.n }">
              <span class="r-count num" :class="{ urgent: r.urgent }">{{ r.n }}</span>
              <span class="r-label">{{ r.label }}</span>
              <span class="r-preview muted">{{ r.n ? r.preview : '目前沒有' }}</span>
              <el-icon class="r-chev"><ArrowRight /></el-icon>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section class="panel ann-panel">
        <div class="panel-head">
          <h2>公司公告</h2>
        </div>
        <ul class="anns">
          <li v-for="a in store.myAnnouncements" :key="a.id">
            <div class="ann-row">
              <button type="button" class="ann-title" @click="expandedAnn = expandedAnn === a.id ? null : a.id">
                <span v-if="a.pinned" class="tag amber">置頂</span>
                <span class="ann-text">{{ a.title }}</span>
              </button>
              <span class="ann-meta muted small">{{ a.author }} · {{ dateTime(a.at) }}</span>
            </div>
            <div v-if="expandedAnn === a.id" class="ann-body">
              <p>{{ a.body }}</p>
            </div>
          </li>
          <li v-if="!store.myAnnouncements.length" class="muted small">目前沒有公告。</li>
        </ul>
      </section>
    </div>

    <!-- 業績詳情：年度（執行長加事業部）在面板標題列，逐月圖在上，群組卡在圖下面 -->
    <section v-if="primary && chartSummary" class="panel detail">
      <div class="panel-head">
        <h2>業績詳情</h2>
        <div class="tools">
          <el-radio-group v-if="!isCeo && groups.length" v-model="chartKey" size="small">
            <el-radio-button value="me">我的</el-radio-button>
            <el-radio-button value="team">團隊</el-radio-button>
          </el-radio-group>
          <el-select v-if="isCeo" v-model="scope" size="small" style="width: 130px" aria-label="事業部">
            <el-option value="all" label="全公司" />
            <el-option v-for="d in depts" :key="d" :value="d" :label="d" />
          </el-select>
          <el-select v-model="year" size="small" style="width: 100px" aria-label="年度">
            <el-option v-for="y in YEARS" :key="y" :value="y" :label="`${y} 年`" />
          </el-select>
        </div>
      </div>
      <div class="panel-body chart-body">
        <KpiBars :categories="monthLabels" v-bind="chartOf(chartSummary)" :highlight="chartSummary.year === YEAR ? chartSummary.lastMonth - 1 : -1" show-rate :height="250" />
      </div>
      <div v-if="!isCeo && groups.length" class="group-cards two">
        <template v-for="g in groups" :key="g.key">
          <KpiCard :label="`${g.label}${monthWord(g.s)}業績`" :value="g.s.month.actual" :target="g.s.month.target" :target-label="`${monthWord(g.s).trim()} KPI`" />
          <KpiCard :label="`${g.label}年度業績`" :value="g.s.ytdActual" :target="g.s.yearTarget" target-label="年度 KPI" :sub="ytdNote(g.s)" />
        </template>
      </div>
      <table v-if="isCeo && companyRow" class="plain-table dept-table">
        <thead>
          <tr><th>事業部</th><th class="num">{{ monthWord(companyRow).trim() }}業績</th><th class="num">{{ monthWord(companyRow).trim() }} KPI</th><th class="bar">達成率</th><th class="num">年度業績</th><th class="num">年度 KPI</th><th class="bar">達成率</th></tr>
        </thead>
        <TransitionGroup tag="tbody" name="rows">
          <tr v-for="r in deptRows" :key="r.key" class="dept-row" :class="{ on: scope === r.key, company: r.company }" @click="pickRow(r.key)">
            <td><b>{{ r.label }}</b></td>
            <td class="num">{{ money(r.s.month.actual) }}</td>
            <td class="num muted">{{ money(r.s.month.target) }}</td>
            <td class="bar"><span class="track" :class="rateClass(rate(r.s.month.actual, r.s.month.target))"><i :style="{ width: `${Math.min(rate(r.s.month.actual, r.s.month.target), 1) * 100}%` }"></i></span><span class="pct num" :class="rateClass(rate(r.s.month.actual, r.s.month.target))">{{ pct(rate(r.s.month.actual, r.s.month.target), 0) }}</span></td>
            <td class="num">{{ money(r.s.ytdActual) }}</td>
            <td class="num muted">{{ money(r.s.yearTarget) }}</td>
            <td class="bar"><span class="track" :class="rateClass(rate(r.s.ytdActual, r.s.yearTarget))"><i :style="{ width: `${Math.min(rate(r.s.ytdActual, r.s.yearTarget), 1) * 100}%` }"></i></span><span class="pct num" :class="rateClass(rate(r.s.ytdActual, r.s.yearTarget))">{{ pct(rate(r.s.ytdActual, r.s.yearTarget), 0) }}</span></td>
          </tr>
        </TransitionGroup>
      </table>
    </section>
  </div>
</template>

<style scoped>
.cards {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
}

.cards.four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

/* ---------- 待辦與公告：固定高度，不往下長 ---------- */
.bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.bottom .panel {
  display: flex;
  flex-direction: column;
  height: 248px;
  margin: 0;
  min-height: 0;
}

.bottom .panel-head {
  flex: none;
  padding: 10px 16px;
}

.inbox {
  list-style: none;
  margin: 0;
  padding: 4px 8px 6px;
  /* 待辦列數多於面板高度時在面板內捲動，不壓到下面的業績詳情 */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.row {
  display: grid;
  grid-template-columns: 34px 64px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--ink);
  text-decoration: none;
  transition: background 0.15s ease;
}

.row:hover,
.row:focus-visible {
  background: var(--paper);
}

.r-count {
  justify-self: center;
  min-width: 30px;
  padding: 1px 7px;
  border-radius: 12px;
  background: var(--teal-soft);
  color: var(--teal-ink, var(--teal));
  font-size: 14px;
  font-weight: 700;
  text-align: center;
}

.r-count.urgent {
  background: var(--red-soft, #fde8e8);
  color: var(--red);
}

.row.zero .r-count {
  background: var(--surface-2);
  color: var(--muted);
}

.r-label {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.row.zero .r-label {
  font-weight: 500;
  color: var(--muted);
}

.r-preview {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.r-chev {
  color: var(--muted);
}

.row:hover .r-chev {
  color: var(--teal);
}

.anns {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0 16px 6px;
}

.anns li {
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
}

.anns li:last-child {
  border-bottom: none;
}

.ann-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ann-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.ann-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ann-meta {
  white-space: nowrap;
}

.ann-body {
  margin-top: 8px;
  font-size: 13px;
}

.ann-body p {
  margin: 0;
  white-space: pre-line;
}

/* ---------- 業績詳情 ---------- */
.detail {
  margin: 0;
}

.detail .panel-head {
  padding: 10px 16px;
}

.sub {
  font-weight: 400;
  font-size: 12px;
  margin-left: 10px;
}

.tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-body {
  padding: 8px 12px 6px;
}

.group-cards {
  display: grid;
  gap: 12px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--line);
  background: var(--paper);
  border-radius: 0 0 var(--radius-m) var(--radius-m);
}

.group-cards.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dept-table {
  border-top: 1px solid var(--line);
}

.dept-table th.bar,
.dept-table td.bar {
  width: 180px;
}

.dept-row {
  cursor: pointer;
}

.dept-row:hover td {
  background: var(--paper);
}

.dept-row.on td {
  background: var(--teal-soft);
}

.dept-row.on td:first-child {
  box-shadow: inset 3px 0 0 var(--teal);
}

.dept-row.company td {
  font-weight: 600;
}

.rows-move {
  transition: transform 0.4s ease;
}

.bar {
  white-space: nowrap;
}

.track {
  display: inline-block;
  vertical-align: middle;
  width: 110px;
  height: 6px;
  margin-right: 8px;
  border-radius: 3px;
  background: var(--surface-2);
  overflow: hidden;
}

.track i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--amber);
}

.track.hit i {
  background: var(--teal);
}

.pct {
  display: inline-block;
  vertical-align: middle;
  min-width: 36px;
  font-weight: 700;
  color: var(--amber);
}

.pct.hit {
  color: var(--teal-ink, var(--teal));
}

.pct.low {
  color: var(--red);
}

.small {
  font-size: 12px;
}

@media (max-width: 1100px) {
  .cards.four {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bottom {
    grid-template-columns: 1fr;
  }
}
</style>
