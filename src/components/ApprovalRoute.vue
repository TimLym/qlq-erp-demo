<script setup lang="ts">
import type { Role } from '../mock/data'

defineProps<{
  route: Role[]
  /** 目前關卡索引；等於長度表示全部完成 */
  current: number
  status?: '待簽核' | '已核准' | '已退回' | '已收回'
  /** 用於預覽路由，不標示進度 */
  preview?: boolean
}>()
</script>

<template>
  <ol class="route" :class="{ preview }">
    <li
      v-for="(r, i) in route"
      :key="r + i"
      :class="{
        done: !preview && i < current && status !== '已退回' && status !== '已收回',
        now: !preview && i === current && status === '待簽核',
        rejected: !preview && i === current && status === '已退回',
        recalled: !preview && i === current && status === '已收回',
        ceo: r === '執行長',
      }"
    >
      <span class="step">{{ r }}</span>
      <span v-if="i < route.length - 1" class="arrow" aria-hidden="true"></span>
    </li>
  </ol>
</template>

<style scoped>
.route {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 0;
}

.route li {
  display: flex;
  align-items: center;
}

.step {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
}

li.done .step {
  border-color: var(--teal);
  background: var(--teal-soft);
  color: var(--teal-ink);
}

li.now .step {
  border-color: var(--amber);
  background: var(--amber-soft);
  color: var(--amber);
  font-weight: 500;
}

li.rejected .step {
  border-color: var(--red);
  background: var(--red-soft);
  color: var(--red);
}

li.recalled .step {
  border-style: dashed;
  color: var(--muted);
}

.preview .step {
  color: var(--ink);
}

.preview li.ceo .step {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-soft);
}

.arrow {
  width: 14px;
  height: 1px;
  background: var(--line-strong);
  margin: 0 3px;
}
</style>
