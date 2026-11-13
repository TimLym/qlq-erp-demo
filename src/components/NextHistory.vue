<script setup lang="ts">
import { Clock } from '@element-plus/icons-vue'
import type { Deal } from '../mock/data'
import { dateTime } from '../utils/format'

/** 下一步的歷史：每次改下一步留一筆（時間、人、內容），點時鐘圖示看 */
defineProps<{ deal: Deal }>()
</script>

<template>
  <el-popover v-if="deal.nextHistory?.length" placement="bottom-start" :width="360" trigger="click">
    <template #reference>
      <button type="button" class="hist-btn" :title="`下一步歷史 ${deal.nextHistory.length} 筆`"><el-icon><Clock /></el-icon>{{ deal.nextHistory.length }}</button>
    </template>
    <ol class="hist">
      <li v-for="(h, i) in [...deal.nextHistory].reverse()" :key="i">
        <div class="muted small num">{{ dateTime(h.at) }} · {{ h.by }}</div>
        <div>{{ h.text || '（清空）' }}</div>
      </li>
    </ol>
  </el-popover>
</template>

<style scoped>
.hist-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 6px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  vertical-align: middle;
}

.hist-btn:hover {
  color: var(--teal);
}

.hist {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 280px;
  overflow: auto;
}

.hist li {
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}

.hist li:last-child {
  border-bottom: 0;
}
</style>
