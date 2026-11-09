<script setup lang="ts">
import { useAppStore } from '../stores/app'
import { dateTime } from '../utils/format'

const store = useAppStore()
const kindTag: Record<string, string> = { 提及: 'teal', 下單完成: 'olive', 收款到帳: 'olive', 退回: 'red', 核准: 'teal', 系統: 'slate' }
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>通知中心</h1>
      </div>
      <div class="actions">
        <el-button :disabled="!store.unreadCount" @click="store.markAllRead">全部標示已讀</el-button>
      </div>
    </div>

    <section class="panel">
      <ul class="list">
        <li v-for="n in store.myNotifications" :key="n.id" :class="{ unread: !n.read }">
          <span class="tag" :class="kindTag[n.kind]">{{ n.kind }}</span>
          <p>{{ n.text }}</p>
          <span class="when muted num">{{ dateTime(n.at) }}</span>
          <button v-if="!n.read" type="button" class="read" @click="store.markRead(n.id)">標示已讀</button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.list li {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 14px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}

.list li:last-child {
  border-bottom: none;
}

.list li.unread {
  background: var(--surface);
}

.list li.unread p {
  font-weight: 500;
}

.list li:not(.unread) p {
  color: var(--muted);
}

.when {
  font-size: 13px;
}

.read {
  border: none;
  background: none;
  color: var(--teal);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
</style>
