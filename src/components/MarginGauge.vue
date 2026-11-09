<script setup lang="ts">
import { computed } from 'vue'
import ApprovalRoute from './ApprovalRoute.vue'
import type { Role } from '../mock/data'
import { money, pct } from '../utils/format'

const props = defineProps<{
  revenue: number
  cost: number
  threshold: number
  /** 尚未填成本的項次數 */
  missing?: number
  /** 依目前毛利率算出的簽核進度（取代文字說明） */
  route?: Role[]
}>()

const margin = computed(() => (props.revenue > 0 ? (props.revenue - props.cost) / props.revenue : 0))
const profit = computed(() => props.revenue - props.cost)

/* 刻度範圍 -10% 到 30% */
const MIN = -0.1
const MAX = 0.3
function x(v: number) {
  const c = Math.min(MAX, Math.max(MIN, v))
  return ((c - MIN) / (MAX - MIN)) * 100
}
const zeroX = computed(() => x(0))
const thresholdX = computed(() => x(props.threshold))
const markerX = computed(() => x(margin.value))

const band = computed<'neg' | 'low' | 'ok'>(() => {
  if (margin.value < 0) return 'neg'
  if (margin.value < props.threshold) return 'low'
  return 'ok'
})

</script>

<template>
  <section class="gauge" :class="band" aria-live="polite">
    <div class="headline">
      <span class="label">整案毛利率</span>
      <span class="value num">{{ pct(margin) }}</span>
      <span class="profit num">{{ profit >= 0 ? '毛利' : '虧損' }} {{ money(Math.abs(profit)) }}</span>
    </div>

    <div class="track" role="img" :aria-label="`毛利率 ${pct(margin)}，門檻 ${pct(threshold, 0)}`">
      <div class="zone neg" :style="{ left: '0%', width: zeroX + '%' }"></div>
      <div class="zone low" :style="{ left: zeroX + '%', width: thresholdX - zeroX + '%' }"></div>
      <div class="zone ok" :style="{ left: thresholdX + '%', width: 100 - thresholdX + '%' }"></div>
      <div class="tick" :style="{ left: zeroX + '%' }"><span>0%</span></div>
      <div class="tick" :style="{ left: thresholdX + '%' }"><span>門檻 {{ pct(threshold, 0) }}</span></div>
      <div class="marker" :style="{ left: markerX + '%' }"></div>
    </div>

    <div class="foot">
      <div class="sums">
        <span>售價合計 <b class="num">{{ money(revenue) }}</b></span>
        <span>成本合計 <b class="num">{{ money(cost) }}</b></span>
      </div>
      <div class="route-wrap">
        <ApprovalRoute v-if="route?.length" :route="route" :current="0" preview />
        <span v-if="missing" class="missing">還有 {{ missing }} 項成本未填</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gauge {
  padding: 18px 20px 16px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--teal);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.gauge.low {
  border-left-color: var(--amber);
}

.gauge.neg {
  border-left-color: var(--red);
}

.headline {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.label {
  color: var(--muted);
}

.value {
  font-size: 40px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--teal-ink);
  transition: color 0.2s;
}

.low .value {
  color: var(--amber);
}

.neg .value {
  color: var(--red);
}

.profit {
  color: var(--muted);
}

.track {
  position: relative;
  height: 14px;
  margin: 22px 0 26px;
  border-radius: 3px;
  overflow: visible;
}

.zone {
  position: absolute;
  top: 0;
  height: 100%;
}

.zone.neg {
  background: var(--red-soft);
  border-radius: 3px 0 0 3px;
}

.zone.low {
  background: var(--amber-soft);
}

.zone.ok {
  background: var(--teal-soft);
  border-radius: 0 3px 3px 0;
}

.tick {
  position: absolute;
  top: -4px;
  height: 22px;
  width: 1px;
  background: var(--line-strong);
}

.tick span {
  position: absolute;
  top: 24px;
  left: 0;
  transform: translateX(-50%);
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.marker {
  position: absolute;
  top: -5px;
  width: 4px;
  height: 24px;
  margin-left: -2px;
  border-radius: 2px;
  background: var(--teal-ink);
  transition: left 0.25s ease;
}

.low .marker {
  background: var(--amber);
}

.neg .marker {
  background: var(--red);
}

.foot {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}

.sums {
  display: flex;
  gap: 18px;
  color: var(--muted);
  font-size: 13px;
}

.sums b {
  color: var(--ink);
  font-weight: 500;
}

.route-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.missing {
  font-size: 12px;
  color: var(--amber);
}

</style>
