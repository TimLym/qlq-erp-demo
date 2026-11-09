<script setup lang="ts">
defineProps<{
  stages: readonly string[]
  current: number
  compact?: boolean
}>()
</script>

<template>
  <ol class="strip" :class="{ compact }" :aria-label="`進度：${stages[current]}`">
    <li
      v-for="(s, i) in stages"
      :key="s"
      :class="{ done: i < current, now: i === current }"
    >
      <span class="bar" aria-hidden="true"></span>
      <span v-if="!compact || i === current" class="label">{{ s }}</span>
    </li>
  </ol>
</template>

<style scoped>
.strip {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 4px;
}

.strip li {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bar {
  height: 6px;
  border-radius: 2px;
  background: var(--surface-2);
}

li.done .bar {
  background: var(--teal);
  opacity: 0.48;
}

/* 目前格微抬高 2px：色覺辨識弱也認得出目前階段 */
li.now .bar {
  background: var(--teal);
  height: 8px;
  margin-top: -2px;
}

.label {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

li.now .label {
  color: var(--teal-ink);
  font-weight: 500;
}

.compact {
  gap: 2px;
  align-items: flex-end;
}

.compact .bar {
  height: 4px;
}

.compact li {
  flex: 0 0 14px;
}

.compact li.now {
  flex: 0 0 auto;
}

.compact .label {
  font-size: 12px;
}
</style>
