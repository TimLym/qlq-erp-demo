<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useAppStore } from '../stores/app'
import { money, pct } from '../utils/format'

echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

/*
 * 業績 vs 目標長條圖：每個類別一根「目標」淺色外框柱，裡面疊一根「業績」實心柱，
 * 達標的實心柱會填滿外框，沒達標一眼看得出差距。actual 為 null 代表還沒到的月份，只畫目標。
 */
const props = withDefaults(
  defineProps<{
    categories: string[]
    actual: (number | null)[]
    target: number[]
    height?: number
    actualLabel?: string
    targetLabel?: string
    /** 要強調的類別索引（例如本月） */
    highlight?: number
    /** 柱上直接標達成率 */
    showRate?: boolean
  }>(),
  { height: 240, actualLabel: '業績', targetLabel: '目標', highlight: -1, showRate: false },
)

const store = useAppStore()
const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n))

function render() {
  if (!chart) return
  const teal = cssVar('--teal')
  const soft = cssVar('--teal-soft')
  const amber = cssVar('--amber')
  const ink = cssVar('--ink')
  const muted = cssVar('--muted')
  const line = cssVar('--line')
  const strong = cssVar('--line-strong')
  chart.setOption(
    {
      animationDuration: 400,
      grid: { left: 8, right: 8, top: 34, bottom: 4, containLabel: true },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 16,
        itemHeight: 11,
        textStyle: { color: muted, fontSize: 12 },
        /* 目標的圖例和柱子一樣：淺色填滿、同色虛線外框 */
        data: [
          { name: props.targetLabel, icon: 'roundRect', itemStyle: { color: soft, borderColor: strong, borderWidth: 1, borderType: [3, 2] } },
          { name: props.actualLabel, icon: 'roundRect' },
        ],
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: cssVar('--surface'),
        borderColor: line,
        textStyle: { color: ink, fontSize: 12 },
        formatter: (ps: { dataIndex: number }[]) => {
          const i = ps[0]?.dataIndex ?? 0
          const a = props.actual[i]
          const t = props.target[i] ?? 0
          const lines = [`<b>${props.categories[i]}</b>`, `${props.targetLabel}　${money(t)}`]
          if (a === null || a === undefined) lines.push('<span style="opacity:.7">尚未到期</span>')
          else lines.push(`${props.actualLabel}　<b>${money(a)}</b>`, `達成率　${t ? pct(a / t, 0) : '—'}`)
          return lines.join('<br>')
        },
      },
      xAxis: {
        type: 'category',
        data: props.categories,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: line } },
        axisLabel: {
          color: muted,
          fontSize: 12,
          interval: 0,
          formatter: (v: string, i: number) => (i === props.highlight ? `{hl|${v}}` : v),
          rich: { hl: { color: ink, fontWeight: 700 } },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: muted, fontSize: 11, formatter: (v: number) => short(v) },
        splitLine: { lineStyle: { color: line } },
      },
      series: [
        {
          name: props.targetLabel,
          type: 'bar',
          data: props.target,
          barWidth: '62%',
          itemStyle: { color: soft, borderColor: strong, borderWidth: 1, borderType: [3, 2], borderRadius: [3, 3, 0, 0] },
          emphasis: { itemStyle: { color: soft } },
          z: 1,
        },
        {
          name: props.actualLabel,
          type: 'bar',
          data: props.actual.map((a, i) => ({
            value: a,
            itemStyle: { color: a !== null && a >= (props.target[i] ?? 0) ? teal : amber, borderRadius: [3, 3, 0, 0] },
          })),
          itemStyle: { color: teal, borderRadius: [3, 3, 0, 0] },
          barWidth: '38%',
          barGap: '-80%',
          label: props.showRate
            ? {
                show: true,
                position: 'top',
                color: ink,
                fontSize: 11,
                formatter: (p: { dataIndex: number; value: number | null }) => {
                  const t = props.target[p.dataIndex] ?? 0
                  return p.value === null || !t ? '' : pct(p.value / t, 0)
                },
              }
            : { show: false },
          z: 2,
        },
      ],
    },
    true,
  )
}

onMounted(() => {
  if (!el.value) return
  chart = echarts.init(el.value, undefined, { renderer: 'canvas' })
  render()
  ro = new ResizeObserver(() => chart?.resize())
  ro.observe(el.value)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  chart?.dispose()
  chart = null
})
watch(() => [props.categories, props.actual, props.target, props.highlight, store.theme], render, { deep: true })
</script>

<template>
  <div ref="el" class="kpi-bars" :style="{ height: `${height}px` }" role="img" :aria-label="`${actualLabel}與${targetLabel}對照圖`"></div>
</template>

<style scoped>
.kpi-bars {
  width: 100%;
  min-width: 0;
}
</style>
