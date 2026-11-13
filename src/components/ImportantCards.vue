<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAppStore, type ImportantItem } from '../stores/app'

/**
 * 重要通知卡（1113 決定）：輪到我簽、被退回、被提及，右下角不自動消失，
 * 按「去處理」或「知道了」才消失；一次最多疊三張，其餘到通知中心看。
 */
const store = useAppStore()
const router = useRouter()
function handle(x: ImportantItem) {
  store.dismissImportant(x.key)
  router.push(x.to)
}
</script>

<template>
  <div v-if="store.importantItems.length" class="cards" role="region" aria-label="重要通知">
    <TransitionGroup name="card">
      <article v-for="x in store.importantItems.slice(0, 3)" :key="x.key" class="card" :class="x.tone">
        <header><span class="tag" :class="x.tone">{{ x.label }}</span></header>
        <p>{{ x.text }}</p>
        <footer>
          <el-button size="small" @click="store.dismissImportant(x.key)">知道了</el-button>
          <el-button size="small" type="primary" @click="handle(x)">去處理</el-button>
        </footer>
      </article>
    </TransitionGroup>
    <button v-if="store.importantItems.length > 3" type="button" class="more" @click="router.push('/notifications')">還有 {{ store.importantItems.length - 3 }} 則</button>
  </div>
</template>

<style scoped>
.cards {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1900;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  width: min(340px, calc(100vw - 32px));
}

.card {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--teal);
  border-radius: 6px;
  background: var(--surface);
  box-shadow: 0 6px 20px rgb(0 0 0 / 14%);
}

.card.red {
  border-left-color: var(--red);
}

.card.amber {
  border-left-color: var(--amber);
}

.card p {
  margin: 6px 0 8px;
  font-size: 13px;
  line-height: 1.5;
}

.card footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.more {
  align-self: flex-end;
  border: 0;
  background: none;
  color: var(--teal);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.card-enter-active,
.card-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

@media (prefers-reduced-motion: reduce) {
  .card-enter-active,
  .card-leave-active {
    transition: none;
  }
}
</style>
