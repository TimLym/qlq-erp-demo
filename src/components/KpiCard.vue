<script setup lang="ts">
import { computed } from 'vue'
import { money, pct } from '../utils/format'

/* 儀表板數字卡：大字是當前值，target 有給就在下面放目標與達成率進度條，兩個數字永遠並排 */
const props = defineProps<{
  label: string
  value: number
  target?: number
  targetLabel?: string
  hint?: string
  /** 進度條下面再補一行，例如年初至今的目標 */
  sub?: string
}>()
const rate = computed(() => (props.target ? props.value / props.target : null))
const width = computed(() => (rate.value === null ? 0 : Math.min(rate.value, 1) * 100))
const state = computed(() => (rate.value === null ? '' : rate.value >= 1 ? 'hit' : rate.value >= 0.8 ? 'near' : 'low'))
</script>

<template>
  <div class="kpi-card" :class="state">
    <div class="k-label">{{ label }}</div>
    <div class="k-value num">{{ money(value) }}</div>
    <template v-if="target !== undefined">
      <div class="k-bar" aria-hidden="true"><i :style="{ width: `${width}%` }"></i></div>
      <div class="k-foot">
        <span class="muted">{{ targetLabel ?? '目標' }} <b class="num">{{ money(target) }}</b></span>
        <span class="k-rate num">{{ rate === null ? '—' : pct(rate, 0) }}</span>
      </div>
    </template>
    <div v-else-if="hint" class="k-foot muted">{{ hint }}</div>
    <div v-if="sub" class="k-sub muted">{{ sub }}</div>
  </div>
</template>

<style scoped>
.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  min-width: 0;
}

.k-label {
  font-size: 13px;
  color: var(--muted);
}

.k-value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: var(--ink);
}

.k-bar {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: var(--surface-2);
  overflow: hidden;
  margin-top: 2px;
}

.k-bar i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 3px;
  background: var(--amber);
  transition: width 0.4s ease;
}

.kpi-card.hit .k-bar i {
  background: var(--teal);
}

.k-foot {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
}

.k-sub {
  font-size: 12px;
  margin-top: -2px;
}

.k-rate {
  font-weight: 700;
  color: var(--amber);
}

.kpi-card.hit .k-rate {
  color: var(--teal-ink, var(--teal));
}

.kpi-card.low .k-rate {
  color: var(--red);
}
</style>
