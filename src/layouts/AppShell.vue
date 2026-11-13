<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Bell, Star, StarFilled, Plus, ArrowDown, Fold, Expand, Setting, SwitchButton } from '@element-plus/icons-vue'
import { navForRole, phaseLabel, findNavItem, type NavItem } from '../nav'
import { useAppStore } from '../stores/app'
import { purchaseOrders } from '../mock/data'
import NotifyBell from '../components/NotifyBell.vue'
import ImportantCards from '../components/ImportantCards.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

/* 整個導航收進左上角的 QL 鈕；記在瀏覽器，窄螢幕預設收起 */
const collapsed = ref<boolean>(readRail())
/* 抽屜等傳送到 body 的元件要知道導覽欄收起了沒 */
watch(collapsed, (v) => document.body.classList.toggle('rail-collapsed', v), { immediate: true })
function readRail(): boolean {
  try {
    const v = localStorage.getItem('erp.railCollapsed')
    return v === null ? window.innerWidth < 900 : v === '1'
  } catch {
    return false
  }
}
function toggleRail() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem('erp.railCollapsed', collapsed.value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

const pendingCount = computed(() => store.pendingForMe.length)

/* 右上角帳號選單：通知中心、個人設定從這裡進；示範身分切換也收在裡面 */
const initials = computed(() => store.currentUser.name.slice(0, 1))
function onAccount(cmd: string) {
  if (cmd === 'notifications' || cmd === 'settings') router.push(cmd === 'notifications' ? '/notifications' : '/settings')
}

/* 只亮完全相符的那一頁，避免 /approvals 與 /approvals/mine 同時亮 */
function isActive(path: string) {
  return route.path === path
}

/* 群組收合：存瀏覽器；進到某頁時自動展開它所屬的群組 */
const collapsedGroups = ref<Record<string, boolean>>(readCollapsed())
function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('erp.navCollapsed') ?? '{}')
  } catch {
    return {}
  }
}
function toggleGroup(key: string) {
  collapsedGroups.value = { ...collapsedGroups.value, [key]: !collapsedGroups.value[key] }
  try {
    localStorage.setItem('erp.navCollapsed', JSON.stringify(collapsedGroups.value))
  } catch {
    /* ignore */
  }
}
watch(
  () => route.path,
  (p) => {
    const hit = findNavItem(p)
    if (hit && collapsedGroups.value[hit.group.key]) toggleGroup(hit.group.key)
  },
  { immediate: true },
)

/* 左欄依角色顯示：業務看不到採購內部、報表、系統管理等與自己無關的項目 */
const visibleGroups = computed(() => navForRole(store.role))
const visiblePaths = computed(() => new Set(visibleGroups.value.flatMap((g) => g.items.map((it) => it.path))))
const favoriteItems = computed(() => store.favorites.filter((p) => visiblePaths.value.has(p)).map((p) => findNavItem(p)?.item).filter((x): x is NavItem => !!x))

function toggleFav(e: Event, path: string) {
  e.preventDefault()
  e.stopPropagation()
  store.toggleFavorite(path)
}

/* 全域搜尋：快速動作 + 依單據類型分組的結果 */
/* 快速動作也依角色：業務看不到建立採購單，採購看不到新增商機 */
const quickActions = computed(() =>
  [
    { label: '新增商機', hint: '防撞檢核後取號', to: '/sales/pipeline?new=1', roles: ['業務', '業務主管', '執行長'] },
    { label: '建立採購單', hint: '對應 SO 或預下單', to: '/purchase/po', roles: ['採購', '執行長'] },
    { label: '待我簽核', hint: `${store.pendingForMe.length} 件`, to: '/approvals' },
  ].filter((a) => !a.roles || a.roles.includes(store.role)),
)
const q = ref('')
const focused = ref(false)
const results = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return []
  const hit = (v: string) => v.toLowerCase().includes(s)
  const out: { group: string; label: string; sub: string; to: string }[] = []
  quickActions.value.filter((a) => hit(a.label)).forEach((a) => out.push({ group: '動作', label: a.label, sub: a.hint, to: a.to }))
  store.scopedDeals.filter((d) => hit(d.dealNo) || hit(d.customer) || hit(d.product)).forEach((d) =>
    out.push({ group: '商機', label: `${d.customer}（${d.customerDept}）`, sub: `${d.dealNo} · ${d.stage}`, to: `/sales/pipeline?deal=${d.id}` }),
  )
  store.scopedOrders.filter((o) => hit(o.soNo) || hit(o.customer)).forEach((o) =>
    out.push({ group: '訂單', label: o.customer, sub: o.soNo, to: '/sales/orders' }),
  )
  purchaseOrders.filter((p) => hit(p.poNo) || hit(p.vendor) || hit(p.customer)).forEach((p) =>
    out.push({ group: '採購單', label: p.vendor, sub: `${p.poNo} · ${p.customer}`, to: '/purchase/po' }),
  )
  visibleGroups.value.flatMap((g) => g.items).filter((it) => hit(it.label)).forEach((it) =>
    out.push({ group: '頁面', label: it.label, sub: it.ready ? '' : '規劃中', to: it.path }),
  )
  return out.slice(0, 9)
})
const showActions = computed(() => focused.value && !q.value.trim())
const open = computed(() => showActions.value || results.value.length > 0)
function go(to: string) {
  q.value = ''
  focused.value = false
  router.push(to)
}
function onBlur() {
  setTimeout(() => (focused.value = false), 150)
}
</script>

<template>
  <div class="shell" :class="{ collapsed }">
    <aside class="rail" :class="{ hidden: collapsed }" :aria-hidden="collapsed" :inert="collapsed || undefined" aria-label="模組導航">
      <div class="brand">
        <RouterLink to="/" class="wordmark" aria-label="回首頁" title="回首頁"><span class="w1">QLQ</span><span class="w2">info</span></RouterLink>
        <button type="button" class="toggle" aria-label="收合導航" title="收合導航" @click="toggleRail">
          <el-icon class="toggle-ic"><Fold /></el-icon>
        </button>
      </div>
      <nav class="groups">
        <div v-if="favoriteItems.length" class="group personal" :class="{ closed: collapsedGroups.favorites }">
          <button type="button" class="group-label" :aria-expanded="!collapsedGroups.favorites" @click="toggleGroup('favorites')">
            <span>我的最愛</span>
            <el-icon class="chev"><ArrowDown /></el-icon>
          </button>
          <template v-if="!collapsedGroups.favorites">
            <RouterLink v-for="it in favoriteItems" :key="'f' + it.path" :to="it.path" class="item" :class="{ active: isActive(it.path) }">
              <el-icon class="star on"><StarFilled /></el-icon>
              <span class="item-label">{{ it.label }}</span>
            </RouterLink>
          </template>
        </div>

        <template v-for="g in visibleGroups" :key="g.key">
        <RouterLink v-if="g.single" :to="g.base" class="group-label single" :class="{ active: isActive(g.base) }">
          <span>{{ g.label }}</span>
        </RouterLink>
        <div v-else class="group" :class="[`phase-${g.phase}`, { closed: collapsedGroups[g.key] }]">
          <button type="button" class="group-label" :aria-expanded="!collapsedGroups[g.key]" @click="toggleGroup(g.key)">
            <span>{{ g.label }}</span>
            <span class="label-right">
              <span v-if="g.phase !== 1 && g.phase !== 'tbd'" class="phase">{{ phaseLabel[g.phase] }}</span>
              <span v-if="collapsedGroups[g.key] && g.items.some((it) => isActive(it.path))" class="now-dot" aria-hidden="true"></span>
              <el-icon class="chev"><ArrowDown /></el-icon>
            </span>
          </button>
          <RouterLink
            v-for="it in g.items.filter(() => !collapsedGroups[g.key])"
            :key="it.path"
            :to="it.path"
            class="item"
            :class="{ active: isActive(it.path), planned: !it.ready }"
          >
            <span class="item-label">{{ it.label }}</span>
            <span v-if="it.path === '/approvals' && pendingCount" class="count hot">{{ pendingCount }}</span>
            <button
              type="button"
              class="fav"
              :class="{ on: store.isFavorite(it.path) }"
              :aria-label="store.isFavorite(it.path) ? `從我的最愛移除 ${it.label}` : `加入我的最愛 ${it.label}`"
              @click="toggleFav($event, it.path)"
            >
              <el-icon><StarFilled v-if="store.isFavorite(it.path)" /><Star v-else /></el-icon>
            </button>
          </RouterLink>
        </div>
        </template>
      </nav>
    </aside>

    <div class="body">
      <header class="topbar">
        <Transition name="fade">
          <div v-if="collapsed" class="topbar-brand">
            <RouterLink to="/" class="wordmark" aria-label="回首頁" title="回首頁"><span class="w1">QLQ</span><span class="w2">info</span></RouterLink>
            <button type="button" class="toggle" aria-label="展開導航" title="展開導航" @click="toggleRail">
              <el-icon class="toggle-ic"><Expand /></el-icon>
            </button>
          </div>
        </Transition>
        <div class="search" :class="{ open }">
          <el-input
            v-model="q"
            placeholder="搜尋商機、訂單、採購單、客戶，或輸入動作"
            clearable
            :prefix-icon="Search"
            @focus="focused = true"
            @blur="onBlur"
            @keydown.enter="!$event.isComposing && results[0] && go(results[0].to)"
          />
          <div v-if="open" class="search-results" role="listbox">
            <template v-if="showActions">
              <p class="sr-label">快速動作</p>
              <button v-for="a in quickActions" :key="a.to" type="button" class="result" @mousedown.prevent="go(a.to)">
                <span class="tag teal act"><el-icon><Plus /></el-icon>{{ a.label }}</span>
                <span class="result-label"></span>
                <span class="muted">{{ a.hint }}</span>
              </button>
            </template>
            <button v-for="r in results" :key="r.to + r.label" type="button" class="result" @mousedown.prevent="go(r.to)">
              <span class="tag" :class="r.group === '動作' ? 'teal' : 'slate'">{{ r.group }}</span>
              <span class="result-label">{{ r.label }}</span>
              <span class="muted">{{ r.sub }}</span>
            </button>
          </div>
        </div>
        <div class="topbar-right">
          <NotifyBell />
          <el-dropdown trigger="click" placement="bottom-end" @command="onAccount">
            <button type="button" class="account" aria-label="帳號選單">
              <span class="avatar" aria-hidden="true">{{ initials }}</span>
              <span class="who">
                <span class="who-name">{{ store.currentUser.name }}</span>
                <span class="who-role">{{ store.role }}</span>
              </span>
              <el-icon class="chev"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu class="account-menu">
                <el-dropdown-item command="notifications" :icon="Bell">
                  通知中心<span v-if="store.unreadCount" class="menu-count">{{ store.unreadCount }}</span>
                </el-dropdown-item>
                <el-dropdown-item command="settings" :icon="Setting">個人設定</el-dropdown-item>
                <el-dropdown-item divided disabled :icon="SwitchButton">切換示範身分</el-dropdown-item>
                <el-dropdown-item v-for="u in store.users" :key="u.id" class="persona-item" :class="{ on: u.id === store.currentUserId }" @click="store.switchUser(u.id)">
                  {{ u.name }}<span class="muted">{{ u.role }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <main class="content">
        <RouterView />
      </main>
      <ImportantCards />
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--rail-w) 1fr;
  min-height: 100vh;
  overflow-x: clip;
  transition: grid-template-columns 0.25s ease;
}

.shell.collapsed {
  grid-template-columns: 0 1fr;
}

.rail {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  width: var(--rail-w);
  background: var(--rail-bg);
  color: var(--rail-text);
  overflow: hidden;
  transform: translateX(0);
  transition: transform 0.25s ease;
}

.rail.hidden {
  transform: translateX(-100%);
  pointer-events: none;
}

.brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: var(--topbar-h);
  padding: 0 10px 0 12px;
  border-bottom: 1px solid var(--rail-line);
  flex: none;
}

.wordmark {
  font-family: 'IBM Plex Sans', 'Noto Sans TC', sans-serif;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.01em;
  line-height: 1;
  text-decoration: none;
  padding: 6px 4px;
  border-radius: 4px;
}

.wordmark:hover {
  background: var(--rail-hover);
}

.topbar-brand .wordmark:hover {
  background: var(--paper);
}

.brand .w1 {
  color: #ffffff;
}

.brand .w2 {
  color: #4cc9d4;
}

.topbar-brand .w1 {
  color: var(--ink);
}

.topbar-brand .w2 {
  color: #1aa3b0;
}

.toggle {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--rail-muted);
  cursor: pointer;
}

.toggle:hover {
  background: var(--rail-hover);
  color: var(--rail-text);
}

.toggle-ic {
  font-size: 22px;
}

.topbar-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
}

.topbar-brand .toggle {
  color: var(--muted);
}

.topbar-brand .toggle:hover {
  background: var(--paper);
  color: var(--ink);
}

.groups {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 12px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.group {
  padding: 8px 8px 4px;
}

.group.personal {
  border-bottom: 1px solid var(--rail-line);
  padding-bottom: 8px;
}

.group-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: var(--rail-muted);
  cursor: pointer;
  text-align: left;
}

.group-label:hover {
  background: var(--rail-hover);
  color: var(--rail-text);
}

/* 首頁：單一連結，長得像項目、不能收合 */
.group-label.single {
  width: auto;
  margin: 8px 8px 4px;
  padding: 6px 8px;
  font-size: 14px;
  color: var(--rail-text);
  text-decoration: none;
}

.group-label.single.active {
  background: var(--rail-active-bg);
  color: var(--rail-active-text);
  font-weight: 500;
}

.label-right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.chev {
  font-size: 12px;
  transition: transform 0.15s;
}

.closed .chev {
  transform: rotate(-90deg);
}

.now-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--amber);
}

.phase {
  font-size: 11px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--rail-line);
}

.phase-2 .phase {
  background: rgba(180, 115, 28, 0.45);
  color: #f6e9d2;
}

.phase-3 .phase {
  background: rgba(92, 110, 54, 0.6);
  color: #e6ecd8;
}

.item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 28px 6px 8px;
  border-radius: 4px;
  color: var(--rail-text);
  text-decoration: none;
  font-size: 14px;
  line-height: 1.4;
}

.item:hover {
  background: var(--rail-hover);
}

.item.active {
  background: var(--rail-active-bg);
  color: var(--rail-active-text);
  font-weight: 500;
}

.item.planned {
  color: var(--rail-planned);
}

.item.active.planned {
  color: var(--rail-active-text);
}

.item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.star {
  flex: none;
  font-size: 14px;
  color: var(--amber);
}

.fav {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--rail-muted);
  cursor: pointer;
  opacity: 0;
  font-size: 14px;
}

.item:hover .fav,
.fav.on,
.fav:focus-visible {
  opacity: 1;
}

.fav.on {
  color: var(--amber);
}

.item.active .fav {
  color: var(--rail-active-text);
}

.item.active .fav.on {
  color: var(--amber);
}

.body {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--topbar-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 28px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  transition: padding-left 0.25s ease;
}

.collapsed .topbar {
  padding-left: 16px;
}

/* 收起時頂欄字標淡入；展開時直接消失，不淡出 */
.fade-enter-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from {
  opacity: 0;
}

.fade-leave-active {
  transition: none;
}

.search {
  position: relative;
  width: min(480px, 50vw);
}

.search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  box-shadow: 0 8px 24px rgba(22, 33, 27, 0.12);
  padding: 6px;
  display: flex;
  flex-direction: column;
}

.sr-label {
  font-size: 12px;
  color: var(--muted);
  padding: 4px 8px 2px;
}

.result {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 7px 8px;
  border: none;
  background: transparent;
  text-align: left;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--ink);
}

.result:hover {
  background: var(--paper);
}

.result-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.act {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.account {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 4px 4px;
  border: 1px solid transparent;
  border-radius: 24px;
  background: none;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.account:hover,
.account:focus-visible {
  background: var(--paper);
  border-color: var(--line);
}

.avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--teal);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

.who {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.15;
}

.who-name {
  font-size: 13px;
  font-weight: 600;
}

.who-role {
  font-size: 11px;
  color: var(--muted);
}

.account .chev {
  color: var(--muted);
  font-size: 12px;
}

.menu-count {
  display: inline-block;
  min-width: 18px;
  margin-left: 8px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--red);
  color: #fff;
  font-size: 11px;
  text-align: center;
  line-height: 18px;
}

.badge {
  position: absolute;
  top: 0;
  left: 26px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--amber);
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}


.content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 900px) {
  .shell:not(.collapsed) {
    grid-template-columns: 1fr;
  }

  .shell:not(.collapsed) .rail {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 30;
    width: var(--rail-w);
    box-shadow: 0 0 0 100vw rgba(0, 0, 0, 0.35);
  }

  .topbar {
    padding: 0 16px;
  }

  .who {
    display: none;
  }
}
</style>
