<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

/* 簽核路由畫布上的一個節點：起點、終點或角色 */
defineProps<{
  id: string
  data: { kind: 'start' | 'end' | 'role'; role?: string; sub?: string; hit?: boolean; editable?: boolean }
}>()
defineEmits<{ remove: [] }>()
</script>

<template>
  <div class="rn" :class="[data.kind, { hit: data.hit, ceo: data.role === '執行長' }]">
    <Handle v-if="data.kind !== 'start'" type="target" :position="Position.Left" />
    <span class="lbl">{{ data.kind === 'start' ? '送審' : data.kind === 'end' ? '核准' : data.role }}</span>
    <span v-if="data.sub" class="sub">{{ data.sub }}</span>
    <button v-if="data.kind === 'role' && data.editable" type="button" class="rm" title="移除這一關" @click.stop="$emit('remove')">×</button>
    <Handle v-if="data.kind !== 'end'" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.rn {
  position: relative;
  min-width: 96px;
  padding: 7px 14px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
  line-height: 18px;
  text-align: center;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.rn .sub {
  display: block;
  font-size: 11px;
  line-height: 14px;
  color: var(--muted);
  margin-top: 1px;
}

.rn.ceo .sub,
.rn.hit .sub {
  color: inherit;
  opacity: 0.8;
}

.rn.start,
.rn.end {
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted);
  min-width: 64px;
  padding: 6px 14px;
}

.rn.ceo {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-soft);
}

.rn.hit {
  border-color: var(--teal);
  background: var(--teal-soft);
  color: var(--teal-ink);
  box-shadow: 0 0 0 2px var(--teal-soft);
}

.rn.hit.ceo {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-soft);
  box-shadow: 0 0 0 2px var(--red-soft);
}

.rm {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: none;
}

.rn:hover .rm {
  display: block;
}

.rm:hover {
  background: var(--red-soft);
  color: var(--red);
  border-color: var(--red);
}

.rn :deep(.vue-flow__handle) {
  width: 10px;
  height: 10px;
  background: var(--surface);
  border: 2px solid var(--line-strong);
}

.rn :deep(.vue-flow__handle-right) {
  right: -6px;
}

.rn :deep(.vue-flow__handle-left) {
  left: -6px;
}

.rn:hover :deep(.vue-flow__handle) {
  border-color: var(--teal);
}
</style>
