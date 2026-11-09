<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '../../stores/app'
import { orders } from '../../mock/data'
import { YEAR, YEARS, BONUS_RATE, lastMonthOf, repsFor, repSummary, repsSummary, repMonths, historyFor, monthKey, monthOfSo, yearOfSo, type SalesRep } from '../../mock/performance'
import { money, pct } from '../../utils/format'

/*
 * 業績與獎金：和首頁儀表板同一份資料（src/mock/performance.ts）。
 * 業績以 SO 成立月份認列，Demo 只建了幾張 SO，其餘月份是舊 ERP 轉入的接單紀錄；獎金依業務毛利 × 8%，收款後才發放。
 */
const store = useAppStore()
const year = ref<number>(YEAR)
const lastMonth = computed(() => lastMonthOf(year.value))
const reps = computed(() => repsFor(store.currentUserId, store.role))
const salesOnly = computed(() => store.role === '業務')

/* 依業務彙總：每人一列，多於一人時加合計列，數字和首頁的卡片一樣 */
const byRep = computed(() => reps.value.map((r) => ({ rep: r, s: repSummary(r.id, year.value)! })))
const total = computed(() => (reps.value.length > 1 ? repsSummary(reps.value, year.value) : null))

/* 逐月：選一個人（業務固定是自己），看每個月的 KPI、業績、毛利與獎金 */
const monthlyRepId = ref(reps.value[0]?.id ?? '')
watch(reps, (list) => { if (!list.some((r) => r.id === monthlyRepId.value)) monthlyRepId.value = list[0]?.id ?? '' })
const monthlyRep = computed<SalesRep | undefined>(() => reps.value.find((r) => r.id === monthlyRepId.value))
const monthly = computed(() => (monthlyRep.value ? repMonths(monthlyRep.value, year.value).filter((m) => m.month <= lastMonth.value) : []))
const monthlyTotal = computed(() => (monthlyRep.value ? repSummary(monthlyRep.value.id, year.value) : null))

/* 逐案明細：系統內的 SO 一張一列；舊 ERP 轉入的接單按人、按月一列，兩種加起來才等於上面的彙總 */
const detail = computed(() => {
  const names = new Map(reps.value.map((r) => [r.name, r]))
  const ids = new Set(reps.value.map((r) => r.id))
  const soRows = orders
    .filter((o) => names.has(o.owner) && yearOfSo(o.soNo) === year.value)
    .map((o) => {
      const received = o.milestones.filter((m) => m.status === '已收款').reduce((s, m) => s + m.amount, 0)
      const margin = o.amount - o.cost
      const collected = received >= o.amount
      return { key: o.id, month: monthKey(monthOfSo(o.soNo), year.value), source: 'SO' as const, title: o.customer, sub: `${o.soNo} · ${o.product}`, owner: o.owner, amount: o.amount, margin, received, collected }
    })
  const histRows = reps.value
    .flatMap((r) => historyFor(r.id, year.value))
    .filter((e) => ids.has(e.userId))
    .map((e, i) => ({ key: `h-${i}`, month: e.month, source: '轉入' as const, title: '舊 ERP 轉入接單', sub: '該月彙總', owner: reps.value.find((r) => r.id === e.userId)?.name ?? '', amount: e.amount, margin: e.margin, received: e.collected ? e.amount : 0, collected: e.collected }))
  return [...soRows, ...histRows].sort((a, b) => b.month.localeCompare(a.month) || a.owner.localeCompare(b.owner))
})
const bonusOf = (margin: number) => Math.round(margin * BONUS_RATE)
/** 達成率顏色：和首頁的卡片一致，達標綠、八成以上黃、不到八成紅 */
const rateClass = (rate: number) => (rate >= 1 ? 'ok' : rate >= 0.8 ? 'warn' : 'low')
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>業績與獎金</h1>
      </div>
      <div class="actions">
        <el-select v-model="year" style="width: 110px" aria-label="年度">
          <el-option v-for="y in YEARS" :key="y" :value="y" :label="`${y} 年`" />
        </el-select>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>{{ salesOnly ? '我的彙總' : '依業務彙總' }}</h2></div>
      <table class="plain-table">
        <thead><tr><th>業務</th><th v-if="!salesOnly">事業部</th><th class="num">{{ year === YEAR ? '本月' : `${lastMonth} 月` }}業績 / KPI</th><th class="num">年度業績</th><th class="num">年度 KPI</th><th class="num">達成率</th><th class="num">業務毛利</th><th class="num">毛利率</th><th class="num">已發放獎金</th><th class="num">待收款獎金</th><th class="num">預估年度獎金</th></tr></thead>
        <tbody>
          <tr v-for="{ rep, s } in byRep" :key="rep.id">
            <td><b>{{ rep.name }}</b><span v-if="rep.role === '業務主管'" class="muted small"> 主管</span></td>
            <td v-if="!salesOnly">{{ rep.dept }}</td>
            <td class="num">{{ money(s.month.actual) }}<div class="muted small">/ {{ money(s.month.target) }}</div></td>
            <td class="num">{{ money(s.ytdActual) }}</td>
            <td class="num">{{ money(s.yearTarget) }}</td>
            <td class="num" :class="rateClass(s.ytdActual / s.yearTarget)">{{ pct(s.ytdActual / s.yearTarget, 0) }}</td>
            <td class="num">{{ money(s.margin) }}</td>
            <td class="num">{{ pct(s.ytdActual ? s.margin / s.ytdActual : 0) }}</td>
            <td class="num ok">{{ money(s.bonusPaid) }}</td>
            <td class="num muted">{{ money(s.bonusPending) }}</td>
            <td class="num">{{ money(s.bonusEstimate) }}</td>
          </tr>
          <tr v-if="total" class="total">
            <td><b>合計</b></td>
            <td></td>
            <td class="num">{{ money(total.month.actual) }}<div class="muted small">/ {{ money(total.month.target) }}</div></td>
            <td class="num">{{ money(total.ytdActual) }}</td>
            <td class="num">{{ money(total.yearTarget) }}</td>
            <td class="num" :class="rateClass(total.ytdActual / total.yearTarget)">{{ pct(total.ytdActual / total.yearTarget, 0) }}</td>
            <td class="num">{{ money(total.margin) }}</td>
            <td class="num">{{ pct(total.ytdActual ? total.margin / total.ytdActual : 0) }}</td>
            <td class="num ok">{{ money(total.bonusPaid) }}</td>
            <td class="num muted">{{ money(total.bonusPending) }}</td>
            <td class="num">{{ money(total.bonusEstimate) }}</td>
          </tr>
          <tr v-if="!byRep.length"><td colspan="11" class="muted">沒有業績責任額的人員</td></tr>
        </tbody>
      </table>
    </section>

    <section v-if="monthlyRep && monthlyTotal" class="panel">
      <div class="panel-head">
        <h2>{{ salesOnly ? '我的逐月' : `${monthlyRep.name} 逐月` }}</h2>
        <el-select v-if="!salesOnly" v-model="monthlyRepId" size="small" style="width: 160px" aria-label="選擇業務">
          <el-option v-for="r in reps" :key="r.id" :value="r.id" :label="`${r.name}（${r.dept}）`" />
        </el-select>
      </div>
      <table class="plain-table">
        <thead><tr><th>月份</th><th class="num">KPI</th><th class="num">業績</th><th class="num">達成率</th><th class="num">業務毛利</th><th class="num">已收款毛利</th><th class="num">已發放獎金</th><th class="num">待收款獎金</th></tr></thead>
        <tbody>
          <tr v-for="m in monthly" :key="m.month" :class="{ now: year === YEAR && m.month === lastMonth }">
            <td class="id">{{ year }}-{{ String(m.month).padStart(2, '0') }}<span v-if="year === YEAR && m.month === lastMonth" class="tag teal">本月</span></td>
            <td class="num">{{ money(m.target) }}</td>
            <td class="num">{{ money(m.actual) }}</td>
            <td class="num" :class="rateClass(m.target ? m.actual / m.target : 0)">{{ m.target ? pct(m.actual / m.target, 0) : '—' }}</td>
            <td class="num">{{ money(m.margin) }}</td>
            <td class="num">{{ money(m.collectedMargin) }}</td>
            <td class="num ok">{{ money(bonusOf(m.collectedMargin)) }}</td>
            <td class="num muted">{{ money(bonusOf(m.margin - m.collectedMargin)) }}</td>
          </tr>
          <tr class="total">
            <td><b>年初至今</b></td>
            <td class="num">{{ money(monthlyTotal.ytdTarget) }}</td>
            <td class="num">{{ money(monthlyTotal.ytdActual) }}</td>
            <td class="num" :class="rateClass(monthlyTotal.ytdActual / monthlyTotal.ytdTarget)">{{ pct(monthlyTotal.ytdActual / monthlyTotal.ytdTarget, 0) }}</td>
            <td class="num">{{ money(monthlyTotal.margin) }}</td>
            <td class="num">{{ money(monthlyTotal.collectedMargin) }}</td>
            <td class="num ok">{{ money(monthlyTotal.bonusPaid) }}</td>
            <td class="num muted">{{ money(monthlyTotal.bonusPending) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>逐案明細</h2></div>
      <table class="plain-table">
        <thead><tr><th>月份</th><th>來源</th><th>SO / 客戶</th><th v-if="!salesOnly">業務</th><th class="num">金額</th><th class="num">業務毛利</th><th>收款</th><th class="num">獎金</th></tr></thead>
        <tbody>
          <tr v-for="r in detail" :key="r.key">
            <td class="id">{{ r.month }}</td>
            <td><span class="tag" :class="r.source === 'SO' ? 'teal' : 'slate'">{{ r.source }}</span></td>
            <td><b>{{ r.title }}</b><div class="muted small">{{ r.sub }}</div></td>
            <td v-if="!salesOnly">{{ r.owner }}</td>
            <td class="num">{{ money(r.amount) }}</td>
            <td class="num">{{ money(r.margin) }}<div class="muted small">{{ pct(r.margin / r.amount) }}</div></td>
            <td><span class="tag" :class="r.collected ? 'olive' : r.received ? 'amber' : 'slate'">{{ r.collected ? '已收款' : r.received ? `部分 ${money(r.received)}` : '待收款' }}</span></td>
            <td class="num" :class="r.collected ? 'ok' : 'muted'">{{ money(bonusOf(r.margin)) }}{{ r.collected ? '' : '（待收款）' }}</td>
          </tr>
          <tr v-if="!detail.length"><td colspan="8" class="muted">這一年沒有接單</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.panel { margin-bottom: 14px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; }
.ok { color: var(--olive); font-weight: 600; }
.warn { color: var(--amber); font-weight: 600; }
.low { color: var(--red); font-weight: 600; }
.foot { padding: 10px 16px; margin: 0; }
.small { font-size: 12px; }
.total td { border-top: 2px solid var(--line-strong); background: var(--paper); }
.now td { background: var(--teal-soft); }
.id .tag { margin-left: 6px; }
</style>
