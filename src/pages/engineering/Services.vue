<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orders, engGroups, hasExpiryDate, isOrderClosed, type Deal, type EngRequest, type License, type Order } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { useJump } from '../../composables/useJump'
import EngSupportCard from '../../components/EngSupportCard.vue'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import { localToday } from '../../utils/format'

/*
 * 工程服務：工程主管、工程師的工作頁（執行長檢視）。
 * 以「案件」為單位：商機階段或已成立 SO 都是同一個案件，底下是它的服務單。
 * 授權待起算、待結案是案件的狀態；派工、回報、起算、結案都在案件抽屜裡做。
 * 服務單存在商機上、起算與結案存在 SO 上（同一份資料），商機與 SO 抽屜裡做的也會同步。
 */
const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { goSo, goDealNo, canSo, canDeal } = useJump()
const canEdit = computed(() => store.can('/engineering/services', 'edit'))

/* 工程師只看派給自己的服務單；組長另看派給本組的（由組長再派人）；工程主管、執行長看全部 */
const mine = (t: EngRequest) => store.canSeeTicket(t)
const DONE = ['已完成', '已取消']
type Case = { d: Deal; o?: Order; tickets: EngRequest[]; all: EngRequest[]; pendingStart: License[]; toClose: boolean; closed: boolean }
const cases = computed<Case[]>(() =>
  store.scopedDeals
    .map((d) => {
      const all = d.engRequests ?? []
      const tickets = all.filter(mine)
      const o = orders.find((x) => x.dealId === d.id && !x.voidedAt)
      return {
        d,
        o,
        tickets,
        all,
        pendingStart: o ? o.licenses.filter((l) => !hasExpiryDate(l) && !!l.months) : [],
        toClose: !!o && !o.engClosedAt && all.length > 0 && all.every((t) => DONE.includes(t.status)),
        closed: !!o?.engClosedAt,
      }
    })
    .filter((c) => c.tickets.length > 0),
)
const VIEWS = ['待派工', '待接受', '進行中', '待起算', '待結案', '已結案', '全部'] as const
type View = (typeof VIEWS)[number]
const match = (c: Case, v: View) =>
  v === '全部'
    ? true
    : v === '待起算'
      ? c.pendingStart.length > 0
      : v === '待結案'
        ? c.toClose
        : v === '已結案'
          ? c.closed
          : c.tickets.some((t) => t.status === (v === '進行中' ? '已派工' : v))
const count = (v: View) => cases.value.filter((c) => match(c, v)).length
const view = ref<View>(store.role === '工程師' ? (count('待接受') ? '待接受' : '進行中') : '待派工')
const q = ref('')
const rows = computed(() =>
  cases.value
    .filter((c) => match(c, view.value))
    .filter((c) => {
      const k = q.value.trim()
      return !k || [c.d.customer, c.d.dealNo, c.o?.soNo ?? '', ...c.tickets.map((t) => `${t.requestNo} ${t.title}`)].some((x) => x.includes(k))
    })
    .sort((a, b) => Number(b.tickets.some((t) => t.urgent)) - Number(a.tickets.some((t) => t.urgent)) || nextDue(a).localeCompare(nextDue(b))),
)
function nextDue(c: Case) {
  return c.tickets.filter((t) => !DONE.includes(t.status)).map((t) => t.dueDate).sort()[0] ?? '9999'
}
const nameOf = (id: string) => store.users.find((u) => u.id === id)?.name ?? id
const groupOf = (id?: string) => engGroups.find((g) => g.id === id)?.name
const statusTag = (s: string) => (s === '已完成' ? 'teal' : s === '待派工' || s === '待接受' ? 'amber' : s === '已退回' ? 'red' : 'slate')

/* 展開／收合：預設全部展開 */
const collapsed = ref<Set<string>>(new Set())
function toggle(id: string) {
  const s = new Set(collapsed.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  collapsed.value = s
}

/* 案件抽屜 */
const openDealId = ref<string | null>(null)
const openCase = computed(() => cases.value.find((c) => c.d.id === openDealId.value) ?? null)
const drawerOpen = computed({ get: () => !!openCase.value, set: (v: boolean) => { if (!v) openDealId.value = null } })
/* 從通知、待辦進來：?deal= 直接開那個案件（已在這頁時再點也要生效） */
watch(
  () => route.query.deal,
  (id) => {
    if (typeof id !== 'string') return
    if (cases.value.some((c) => c.d.id === id)) openDealId.value = id
    router.replace({ query: {} })
  },
  { immediate: true },
)
/* 從抽屜跳去商機、SO：先關掉這頁的抽屜，避免兩層 */
function jumpDeal(no: string) {
  openDealId.value = null
  goDealNo(no)
}
function jumpSo(no: string) {
  openDealId.value = null
  goSo(no)
}
const openCount = (c: Case) => c.all.filter((t) => !DONE.includes(t.status)).length

const startDlg = ref<{ open: boolean; o: Order | null; l: License | null; date: string }>({ open: false, o: null, l: null, date: '' })
function openStart(o: Order, l: License) {
  startDlg.value = { open: true, o, l, date: localToday() }
}
function confirmStart() {
  const { o, l, date } = startDlg.value
  if (!o || !l || !date) return
  store.setLicenseStart(o, l, date)
  startDlg.value.open = false
  ElMessage.success(`${l.name} 起算 ${date}，到期 ${l.expires}`)
}
async function engClose(o: Order) {
  const ok = await ElMessageBox.confirm(`${o.soNo} 工程結案？`, '工程結案', { confirmButtonText: '結案', cancelButtonText: '取消' }).then(() => true, () => false)
  if (!ok) return
  if (!store.closeEngineering(o)) {
    ElMessage.warning('還有服務單沒完成，不能工程結案')
    return
  }
  ElMessage.success(isOrderClosed(o) ? '工程已結案，訂單結案' : '工程已結案')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>工程服務</h1>
      </div>
      <div class="actions">
        <el-input v-model="q" placeholder="客戶、商機、SO、服務單" clearable style="width: 260px" />
      </div>
    </div>
    <div class="chips">
      <button v-for="v in VIEWS" :key="v" type="button" class="chip" :class="{ on: view === v }" :aria-pressed="view === v" @click="view = v">{{ v }}<span class="count">{{ count(v) }}</span></button>
    </div>
    <section class="panel cases">
      <div v-for="c in rows" :key="c.d.id" class="case">
        <div class="case-head" role="button" tabindex="0" @click="openDealId = c.d.id" @keydown.enter="openDealId = c.d.id">
          <button type="button" class="chev" :aria-label="collapsed.has(c.d.id) ? '展開' : '收合'" :aria-expanded="!collapsed.has(c.d.id)" @click.stop="toggle(c.d.id)"><el-icon :size="18"><ArrowRight v-if="collapsed.has(c.d.id)" /><ArrowDown v-else /></el-icon></button>
          <div class="who">
            <b>{{ c.d.customer }}</b> <span class="muted">{{ c.d.customerDept }}</span>
            <div class="muted small">
              <a v-if="canDeal" class="link id" @click.stop="goDealNo(c.d.dealNo)">{{ c.d.dealNo }}</a><span v-else class="id">{{ c.d.dealNo }}</span>
              <template v-if="c.o"> · <a v-if="canSo" class="link id" @click.stop="goSo(c.o.soNo)">{{ c.o.soNo }}</a><span v-else class="id">{{ c.o.soNo }}</span></template>
              <template v-else>（商機階段）</template>
              · {{ c.d.product }}
            </div>
          </div>
          <div class="flags">
            <span v-if="c.tickets.some((t) => t.urgent && !DONE.includes(t.status))" class="tag red mini">急件</span>
            <span v-if="c.pendingStart.length" class="tag amber mini">授權待起算 {{ c.pendingStart.length }}</span>
            <span v-if="c.toClose" class="tag slate mini">待結案</span>
            <span v-if="c.closed" class="tag teal mini">已結案</span>
          </div>
        </div>
        <table v-if="!collapsed.has(c.d.id)" class="plain-table tickets">
          <tbody>
            <tr v-for="t in c.tickets" :key="t.id" class="row" @click="openDealId = c.d.id">
              <td class="t-no id">{{ t.requestNo.slice(-3) }}</td>
              <td>{{ t.type }}<span v-if="t.urgent" class="tag red mini">急件</span><div class="muted small">{{ t.title }}</div></td>
              <td class="id t-due">{{ t.dueDate }}</td>
              <td class="t-who">{{ t.assigneeIds.length ? t.assigneeIds.map(nameOf).join('、') : groupOf(t.groupId) ?? '—' }}</td>
              <td class="t-st"><span class="tag" :class="statusTag(t.status)">{{ t.status }}</span></td>
            </tr>
            <tr v-for="l in c.pendingStart" :key="l.id" class="row" @click="openDealId = c.d.id">
              <td class="t-no"></td>
              <td><span class="tag amber mini">授權待起算</span> {{ l.name }} × {{ l.qty }}<div class="muted small">{{ l.months }} 個月</div></td>
              <td colspan="3"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!rows.length" class="muted empty">沒有符合的案件</p>
    </section>

    <el-drawer v-model="drawerOpen" size="560px" :with-header="false" destroy-on-close append-to-body>
      <div v-if="openCase" class="svc-drawer">
        <header>
          <h2>{{ openCase.d.customer }} {{ openCase.d.customerDept }}</h2>
          <p class="muted small">
            <a v-if="canDeal" class="link id" @click="jumpDeal(openCase.d.dealNo)">{{ openCase.d.dealNo }}</a><span v-else class="id">{{ openCase.d.dealNo }}</span>
            <template v-if="openCase.o"> · <a v-if="canSo" class="link id" @click="jumpSo(openCase.o.soNo)">{{ openCase.o.soNo }}</a><span v-else class="id">{{ openCase.o.soNo }}</span></template>
            · {{ openCase.d.product }}
          </p>
        </header>
        <EngSupportCard :deal="openCase.d" :can-edit="false" :readonly="!canEdit" />
        <section v-if="openCase.o" class="close-out">
          <h3>工程收尾</h3>
          <div v-for="l in openCase.o.licenses.filter((x) => !!x.months)" :key="l.id" class="line">
            <span>{{ l.name }} × {{ l.qty }}</span>
            <span v-if="hasExpiryDate(l)" class="muted small">起算 {{ l.start }}，到期 {{ l.expires }}</span>
            <template v-else>
              <span class="tag amber mini">待起算</span>
              <el-button v-if="canEdit" size="small" type="primary" plain @click="openStart(openCase.o!, l)">確認起算日</el-button>
            </template>
          </div>
          <div class="line">
            <span>工程結案</span>
            <span v-if="openCase.closed" class="muted small">已於 {{ openCase.o.engClosedAt }} 結案</span>
            <template v-else>
              <span v-if="openCount(openCase)" class="muted small">還有 {{ openCount(openCase) }} 張服務單未完成</span>
              <el-button v-if="canEdit" size="small" type="primary" :disabled="openCount(openCase) > 0" @click="engClose(openCase.o!)">工程結案</el-button>
            </template>
          </div>
        </section>
      </div>
    </el-drawer>

    <el-dialog v-model="startDlg.open" :title="startDlg.l ? `確認起算日｜${startDlg.l.name}` : ''" width="420px" append-to-body>
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="起算日" required>
          <el-date-picker v-model="startDlg.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="startDlg.open = false">取消</el-button>
        <el-button type="primary" :disabled="!startDlg.date" @click="confirmStart">確認</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.cases {
  padding: 0;
}

.case + .case {
  border-top: 1px solid var(--line);
}

.case-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
}

.case-head:hover {
  background: var(--paper);
}

.case-head:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: -2px;
}

.chev {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  margin: -4px 0 0 -6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}

.chev:hover {
  background: var(--surface-2);
}

.chev:focus-visible {
  outline: 2px solid var(--teal);
}

.who {
  flex: 1;
  min-width: 0;
}

.flags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tickets {
  margin: 0 0 8px;
}

.tickets td {
  padding-top: 6px;
  padding-bottom: 6px;
}

.t-no {
  width: 72px;
  padding-left: 50px;
  color: var(--muted);
}

.t-due {
  width: 110px;
}

.t-who {
  width: 160px;
}

.t-st {
  width: 90px;
}

.empty {
  padding: 16px;
}

.svc-drawer {
  padding: 20px 24px;
}

.svc-drawer h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.svc-drawer header {
  margin-bottom: 16px;
}

.close-out {
  margin-top: 20px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.close-out h3 {
  margin: 0 0 8px;
  font-size: 14px;
}

.close-out .line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.close-out .line > span:first-child {
  flex: 1;
}
</style>
