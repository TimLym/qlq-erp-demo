<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell } from '@element-plus/icons-vue'
import { useAppStore, NOTIFY_CATS, type NotifyCat } from '../stores/app'
import type { Notification } from '../mock/data'
import { dateTime } from '../utils/format'

/** 頂欄鈴鐺：未讀數，下拉依類別分頁簽，點一筆標已讀並前往 */
const store = useAppStore()
const router = useRouter()
const open = ref(false)
const tab = ref<NotifyCat>('全部')
const list = computed(() => store.myNotifications.filter((n) => tab.value === '全部' || store.notifyCat(n) === tab.value).slice(0, 8))
const unreadIn = (c: NotifyCat) => store.myNotifications.filter((n) => !n.read && (c === '全部' || store.notifyCat(n) === c)).length
function go(n: Notification) {
  store.markRead(n.id)
  open.value = false
  router.push(store.notifyLink(n))
}
function all() {
  open.value = false
  router.push('/notifications')
}
</script>

<template>
  <el-popover v-model:visible="open" placement="bottom-end" :width="420" trigger="click" popper-class="bell-pop">
    <template #reference>
      <button type="button" class="bell" :aria-label="`通知，未讀 ${store.unreadCount}`">
        <el-icon><Bell /></el-icon>
        <span v-if="store.unreadCount" class="badge">{{ store.unreadCount > 99 ? '99+' : store.unreadCount }}</span>
      </button>
    </template>
    <div class="bell-tabs">
      <button v-for="c in NOTIFY_CATS" :key="c" type="button" :class="{ on: tab === c }" @click="tab = c">{{ c }}<span v-if="unreadIn(c)" class="n">{{ unreadIn(c) }}</span></button>
    </div>
    <ul class="bell-list">
      <li v-for="n in list" :key="n.id" :class="{ unread: !n.read }" @click="go(n)">
        <p>{{ n.text }}</p>
        <span class="muted small num">{{ dateTime(n.at) }}</span>
      </li>
      <li v-if="!list.length" class="empty muted small">沒有通知</li>
    </ul>
    <div class="bell-foot">
      <button type="button" class="link" :disabled="!store.unreadCount" @click="store.markAllRead">全部標示已讀</button>
      <button type="button" class="link" @click="all">通知中心</button>
    </div>
  </el-popover>
</template>

<style scoped>
.bell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--ink);
  font-size: 17px;
  cursor: pointer;
}

.bell:hover {
  border-color: var(--teal);
  color: var(--teal);
}

.badge {
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--red);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.bell-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.bell-tabs button {
  border: 0;
  border-radius: 4px;
  padding: 3px 8px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.bell-tabs button.on {
  background: var(--teal-soft);
  color: var(--ink);
  font-weight: 600;
}

.bell-tabs .n {
  margin-left: 4px;
  color: var(--red);
  font-size: 12px;
}

.bell-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow: auto;
}

.bell-list li {
  padding: 8px 4px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
}

.bell-list li:hover {
  background: var(--paper);
}

.bell-list li p {
  margin: 0 0 2px;
  font-size: 13px;
  color: var(--muted);
}

.bell-list li.unread p {
  color: var(--ink);
  font-weight: 500;
}

.bell-list li.empty {
  cursor: default;
  padding: 16px 4px;
}

.bell-foot {
  display: flex;
  justify-content: space-between;
  padding-top: 8px;
}

.link {
  border: 0;
  background: none;
  color: var(--teal);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.link:disabled {
  color: var(--muted);
  cursor: default;
}
</style>
