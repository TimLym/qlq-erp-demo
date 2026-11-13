<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore, NOTIFY_CATS, type NotifyCat } from '../stores/app'
import { dateTime } from '../utils/format'

/* 通知中心：依類別分頁簽（和鈴鐺一致）加快速搜尋 */
const store = useAppStore()
const router = useRouter()
const kindTag: Record<string, string> = { 提及: 'teal', 下單完成: 'olive', 收款到帳: 'olive', 退回: 'red', 核准: 'teal', 系統: 'slate', 派工: 'amber' }
const tab = ref<NotifyCat>('全部')
const q = ref('')
const rows = computed(() => {
  const k = q.value.trim()
  return store.myNotifications.filter((n) => (tab.value === '全部' || store.notifyCat(n) === tab.value) && (!k || n.text.includes(k)))
})
const unreadIn = (c: NotifyCat) => store.myNotifications.filter((n) => !n.read && (c === '全部' || store.notifyCat(n) === c)).length
function open(id: string, to: string) {
  store.markRead(id)
  router.push(to)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>通知中心</h1>
      </div>
      <div class="actions">
        <el-input v-model="q" placeholder="搜尋通知內容" clearable style="width: 240px" />
        <el-button :disabled="!store.unreadCount" @click="store.markAllRead">全部標示已讀</el-button>
      </div>
    </div>

    <div class="cat-tabs">
      <button v-for="c in NOTIFY_CATS" :key="c" type="button" class="chip" :class="{ on: tab === c }" @click="tab = c">{{ c }}<span v-if="unreadIn(c)" class="count">{{ unreadIn(c) }}</span></button>
    </div>

    <section class="panel">
      <ul class="list">
        <li v-if="!rows.length" class="empty muted">沒有符合的通知</li>
        <li v-for="n in rows" :key="n.id" :class="{ unread: !n.read }">
          <span class="tag" :class="kindTag[n.kind]">{{ n.kind }}</span>
          <p class="go" @click="open(n.id, store.notifyLink(n))">{{ n.text }}</p>
          <span class="when muted num">{{ dateTime(n.at) }}</span>
          <button v-if="!n.read" type="button" class="read" @click="store.markRead(n.id)">標示已讀</button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.cat-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 12px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.chip.on {
  border-color: var(--teal);
  background: var(--teal-soft);
}

.chip .count {
  margin-left: 6px;
  color: var(--red);
}

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

.list li.empty {
  display: block;
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

.go {
  margin: 0;
  cursor: pointer;
}

.go:hover {
  color: var(--teal);
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
