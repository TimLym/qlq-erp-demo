<script setup lang="ts">
import { segmentClasses, type StageSize, type StageTone } from '../utils/stageTrack'

/* 分段軌道：已完成淡色、目前深色且微抬高、未到灰；樣式在 style.css 的 .stage-track，與列表 cell 的 HTML 版共用 */
const props = defineProps<{ total: number; current: number; tone?: StageTone; size?: StageSize }>()
</script>

<template>
  <span class="stage-track" :class="[`stage-track--${props.size ?? 'drawer'}`, `tone-${props.tone ?? 'normal'}`]" :style="{ '--stage-count': props.total }">
    <i v-for="(c, i) in segmentClasses(props.total, props.current, props.tone ?? 'normal')" :key="i" :class="c"></i>
  </span>
</template>
