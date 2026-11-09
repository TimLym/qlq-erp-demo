<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { findNavItem, phaseLabel } from '../nav'

const route = useRoute()
const hit = computed(() => findNavItem(route.path))
</script>

<template>
  <div class="page">
    <template v-if="hit">
      <div class="page-head">
        <div>
          <h1>{{ hit.item.label }}<span v-if="hit.group.phase !== 'tbd'" class="tag" :class="hit.group.phase === 1 ? 'teal' : hit.group.phase === 2 ? 'amber' : 'olive'">{{ phaseLabel[hit.group.phase] }}</span></h1>
          <p v-if="hit.group.phase === 'tbd'">{{ hit.group.label }}。這類功能在客戶現行系統已有，但不在一期訪談範圍。放在這裡是為了確認：要納入新系統，還是沿用現行系統。</p>
          <p v-else>{{ hit.group.label }}模組。此畫面尚未納入本次 Demo，以下是需求訪談整理的功能範圍。</p>
        </div>
      </div>
      <section class="panel">
        <div class="panel-head"><h2>{{ hit.group.phase === 'tbd' ? '現行系統的做法與待決事項' : '規劃內容' }}</h2></div>
        <ul class="notes">
          <li v-for="n in hit.item.notes ?? []" :key="n">{{ n }}</li>
        </ul>
      </section>
    </template>
    <template v-else>
      <div class="page-head">
        <div>
          <h1>找不到這個頁面</h1>
          <p>請從左側導航選擇模組。</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
h1 .tag {
  margin-left: 10px;
  vertical-align: middle;
}

.notes {
  margin: 0;
  padding: 10px 16px 14px 34px;
}

.notes li {
  padding: 4px 0;
}
</style>
