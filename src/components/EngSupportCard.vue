<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ArrowDown, ArrowRight, MoreFilled } from '@element-plus/icons-vue'
import { engGroups, type Deal, type EngRequest } from '../mock/data'
import { useAppStore } from '../stores/app'
import { dateTime } from '../utils/format'

/*
 * 工程支援：一個商機可以有多張技術服務單（T01、T02…），先 POC、再勘查、再部署、之後的服務各自一張。
 * 業務新增服務單 → 工程主管派工（每張單各自派、可派不同人）→ 工程師成為成員並收到代辦 → 完成。
 * 主管可退回（填原因，業務補件重送用同一張單號）或取消（終止，需要時再開新單）。
 */
/* readonly：商機轉 SO 後在商機抽屜唯讀，派工、完成都改在 SO 做 */
const props = defineProps<{ deal: Deal; canEdit: boolean; readonly?: boolean }>()
const store = useAppStore()
const isEngManager = computed(() => !props.readonly && store.role === '工程主管')
const engineers = computed(() => store.users.filter((u) => u.role === '工程師'))
const nameOf = (id: string) => store.users.find((u) => u.id === id)?.name ?? id
const statusTag: Record<EngRequest['status'], string> = { 待派工: 'amber', 待接受: 'amber', 已派工: 'teal', 已完成: 'olive', 已退回: 'red', 已取消: 'slate' }
/* 派工：工程主管，或派給組的單由組長派（只能派組內的人） */
const canDispatch = (t: EngRequest) => !props.readonly && store.canDispatch(t)
const groupName = (t: EngRequest) => engGroups.find((g) => g.id === t.groupId)?.name
const awaitingMe = (t: EngRequest) => !props.readonly && t.status === '待接受' && t.assigneeIds.includes(store.currentUserId) && !store.isAccepted(t, store.currentUserId)
const statusLabel = (s: EngRequest['status']) => (s === '已派工' ? '進行中' : s)
const shortNo = (t: EngRequest) => t.requestNo.slice(t.requestNo.lastIndexOf('-') + 1)
const TODAY = new Date('2026-10-08')
const overdue = (t: EngRequest) => (t.status === '待派工' || t.status === '待接受' || t.status === '已派工' ? Math.max(0, Math.round((TODAY.getTime() - new Date(t.dueDate).getTime()) / 86400000)) : 0)

const tickets = computed(() => store.engRequestsOf(props.deal))
const weight = (t: EngRequest) => (t.status === '待派工' ? (t.urgent ? 0 : 1) : t.status === '待接受' ? 1 : t.status === '已退回' ? 2 : t.status === '已派工' ? 3 : 4)
const sorted = computed(() => [...tickets.value].sort((a, b) => weight(a) - weight(b) || (weight(a) === 3 ? a.dueDate.localeCompare(b.dueDate) : b.requestedAt.localeCompare(a.requestedAt))))
const count = (s: EngRequest['status']) => tickets.value.filter((t) => t.status === s).length
const mine = (t: EngRequest) => !props.readonly && t.assigneeIds.includes(store.currentUserId)
/* 待派工、已退回、我負責的進行中預設展開；完成與取消收合 */
const opened = ref<Record<string, boolean>>({})
const isOpen = (t: EngRequest) => opened.value[t.id] ?? (t.status === '待派工' || t.status === '待接受' || t.status === '已退回' || (t.status === '已派工' && mine(t)))
const toggle = (t: EngRequest) => { opened.value = { ...opened.value, [t.id]: !isOpen(t) } }
const canCancel = (t: EngRequest) => (t.status === '待派工' || t.status === '已退回' ? props.canEdit || isEngManager.value : t.status === '已派工' || t.status === '待接受' ? isEngManager.value : false)

/* 新增／補件重送 */
const reqOpen = ref(false)
const reqTarget = ref<EngRequest | null>(null)
const reqForm = ref({ type: '售前諮詢' as EngRequest['type'], title: '', desc: '', dueDate: '', urgent: false, suggestedId: '', suggestReason: '' })
function startRequest(t?: EngRequest) {
  reqTarget.value = t ?? null
  reqForm.value = t ? { type: t.type, title: t.title, desc: t.desc, dueDate: t.dueDate, urgent: t.urgent, suggestedId: t.suggestedId ?? '', suggestReason: t.suggestReason ?? '' } : { type: '售前諮詢', title: '', desc: '', dueDate: props.deal.expectClose, urgent: false, suggestedId: '', suggestReason: '' }
  reqOpen.value = true
}
function submitRequest() {
  if (!reqForm.value.desc.trim() || !reqForm.value.dueDate) {
    ElMessage.warning('需求說明與需求日期必填')
    return
  }
  const desc = reqForm.value.desc.trim()
  /* 標題由需求說明前段帶出（通知與代辦用） */
  const { suggestedId, suggestReason, ...rest } = reqForm.value
  const form = { ...rest, title: desc.split(/[，。；\n]/)[0]!.slice(0, 24), desc }
  if (reqTarget.value) {
    store.resubmitEngineering(props.deal, reqTarget.value, form)
    ElMessage.success(`${shortNo(reqTarget.value)} 已補件重送，等工程主管派工`)
  } else {
    const t = store.requestEngineering(props.deal, { ...form, suggestedId: suggestedId || undefined, suggestReason: suggestReason.trim() || undefined })
    ElMessage.success(`服務單 ${shortNo(t)} 已送交工程主管派工`)
  }
  reqOpen.value = false
}

/* 派工／改派 */
const assignOpen = ref(false)
const assignTarget = ref<EngRequest | null>(null)
const assignIds = ref<string[]>([])
const assignNote = ref('')
const assignGroup = ref('')
/* 可選的人：工程主管看全部；組長只看自己組 */
const pickable = computed(() => {
  const t = assignTarget.value
  if (!t || isEngManager.value) return engineers.value
  const g = engGroups.find((x) => x.id === t.groupId)
  return engineers.value.filter((u) => g?.memberIds.includes(u.id))
})
function startAssign(t: EngRequest) {
  assignGroup.value = ''
  assignTarget.value = t
  assignIds.value = [...t.assigneeIds]
  assignNote.value = t.assignNote ?? ''
  assignOpen.value = true
}
function toggleEngineer(id: string) {
  assignIds.value = assignIds.value.includes(id) ? assignIds.value.filter((x) => x !== id) : [...assignIds.value, id]
}
function submitAssign() {
  if (!assignTarget.value) return
  if (assignGroup.value) {
    store.assignToGroup(props.deal, assignTarget.value, assignGroup.value, assignNote.value.trim())
    assignOpen.value = false
    ElMessage.success(`${shortNo(assignTarget.value)} 已交給${engGroups.find((g) => g.id === assignGroup.value)?.name}，組長派人`)
    return
  }
  if (!assignIds.value.length) {
    ElMessage.warning('至少選一位工程師')
    return
  }
  const names = store.assignEngineers(props.deal, assignTarget.value, assignIds.value, assignNote.value.trim())
  if (!names.length) {
    ElMessage.warning('沒有派這張單的權限，或選的人不在這一組')
    return
  }
  assignOpen.value = false
  ElMessage.success(`${shortNo(assignTarget.value)} 已派給 ${names.join('、')}，等工程師接受`)
}
async function reject(t: EngRequest) {
  const { value } = await ElMessageBox.prompt('退回原因（業務會收到通知，補件後可用同一張單重送）', `退回｜${shortNo(t)} ${t.type}`, { inputPlaceholder: '例：需求範圍與現場拓樸未附', confirmButtonText: '退回', cancelButtonText: '取消', inputValidator: (v) => !!v.trim() || '請填原因' }).catch(() => ({ value: '' }))
  if (!value) return
  store.rejectEngineering(props.deal, t, value.trim())
  ElMessage.info(`${shortNo(t)} 已退回`)
}
async function cancel(t: EngRequest) {
  const { value } = await ElMessageBox.prompt('取消後不能重開，之後有需要再開新單', `取消｜${shortNo(t)} ${t.type}`, { inputPlaceholder: '取消原因', confirmButtonText: '取消服務單', cancelButtonText: '返回', inputValidator: (v) => !!v.trim() || '請填原因' }).catch(() => ({ value: '' }))
  if (!value) return
  store.cancelEngineering(props.deal, t, value.trim())
  ElMessage.info(`${shortNo(t)} 已取消`)
}
/* 完成：工程師填服務內容、到場時間、完成時間 */
const doneOpen = ref(false)
const doneTarget = ref<EngRequest | null>(null)
const doneForm = ref({ workSummary: '', arrivedAt: '', completedAt: '' })
const localNow = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
function startComplete(t: EngRequest) {
  doneTarget.value = t
  doneForm.value = { workSummary: '', arrivedAt: '', completedAt: localNow() }
  doneOpen.value = true
}
function submitComplete() {
  const t = doneTarget.value
  const f = doneForm.value
  if (!t) return
  if (!f.workSummary.trim() || !f.arrivedAt || !f.completedAt) {
    ElMessage.warning('服務內容、到場時間與完成時間必填')
    return
  }
  if (new Date(f.completedAt).getTime() < new Date(f.arrivedAt).getTime()) {
    ElMessage.warning('完成時間不能早於到場時間')
    return
  }
  store.completeEngineering(props.deal, t, { workSummary: f.workSummary.trim(), arrivedAt: f.arrivedAt, completedAt: f.completedAt })
  doneOpen.value = false
  ElMessage.success(`${shortNo(t)} 已完成`)
}
function accept(t: EngRequest) {
  store.acceptEngineering(props.deal, t)
  ElMessage.success(`已接受 ${shortNo(t)}`)
}
async function decline(t: EngRequest) {
  const { value } = await ElMessageBox.prompt('婉拒原因（派工的人會收到通知重派）', `婉拒｜${shortNo(t)} ${t.type}`, { inputPlaceholder: '例：當週已排滿現場', confirmButtonText: '婉拒', cancelButtonText: '取消', inputValidator: (v) => !!v?.trim() || '請填原因' }).catch(() => ({ value: '' }))
  if (!value) return
  store.declineEngineering(props.deal, t, value.trim())
  ElMessage.info(`已婉拒 ${shortNo(t)}`)
}
const loadOf = (id: string) => store.deals.reduce((n, d) => n + (d.engRequests ?? []).filter((t) => (t.status === '已派工' || t.status === '待接受') && t.assigneeIds.includes(id)).length, 0)
</script>

<template>
  <section class="block">
    <div class="block-head">
      <h4>
        工程支援<span class="muted sub">共 {{ tickets.length }} 張</span>
        <span v-if="count('待派工')" class="tag amber">待派工 {{ count('待派工') }}</span>
        <span v-if="count('待接受')" class="tag amber">待接受 {{ count('待接受') }}</span>
        <span v-if="count('已派工')" class="tag teal">進行中 {{ count('已派工') }}</span>
        <span v-if="count('已退回')" class="tag red">退回 {{ count('已退回') }}</span>
        <span v-if="count('已完成')" class="tag olive">已完成 {{ count('已完成') }}</span>
      </h4>
      <el-button v-if="canEdit" size="small" type="primary" :icon="Plus" @click="startRequest()">新增服務單</el-button>
    </div>
    <div class="block-body">
    <p v-if="!tickets.length" class="muted small">還沒有服務單。</p>
    <ul v-else class="tickets">
      <li v-for="t in sorted" :key="t.id" :class="[t.status, { open: isOpen(t), mine: mine(t) }]">
        <div class="row" @click="toggle(t)">
          <el-icon class="chev"><component :is="isOpen(t) ? ArrowDown : ArrowRight" /></el-icon>
          <span class="no num">{{ shortNo(t) }}</span>
          <span class="tag" :class="statusTag[t.status]">{{ statusLabel(t.status) }}</span>
          <span v-if="t.urgent && t.status === '待派工'" class="tag red">急件</span>
          <span v-if="groupName(t) && t.status === '待派工'" class="tag slate">{{ groupName(t) }}</span>
          <span class="title"><b>{{ t.type }}</b></span>
          <span v-if="t.assigneeIds.length" class="meta muted small"><span v-for="id in t.assigneeIds" :key="id" class="chip" :class="{ wait: !store.isAccepted(t, id) }">{{ nameOf(id) }}{{ store.isAccepted(t, id) ? '' : '（待接受）' }}</span></span>
          <span class="acts" @click.stop>
            <template v-if="t.status === '待派工' && canDispatch(t)">
              <el-button size="small" type="primary" @click="startAssign(t)">派工</el-button>
            </template>
            <template v-else-if="t.status === '待接受'">
              <template v-if="awaitingMe(t)">
                <el-button size="small" @click="decline(t)">婉拒</el-button>
                <el-button size="small" type="primary" @click="accept(t)">接受</el-button>
              </template>
              <el-button v-else-if="canDispatch(t)" size="small" @click="startAssign(t)">改派</el-button>
            </template>
            <template v-else-if="t.status === '已派工'">
              <el-button v-if="canDispatch(t)" size="small" @click="startAssign(t)">改派</el-button>
              <el-button v-if="isEngManager || mine(t)" size="small" type="primary" @click="startComplete(t)">完成</el-button>
            </template>
            <template v-else-if="t.status === '已退回'">
              <el-button v-if="canEdit" size="small" type="primary" @click="startRequest(t)">補件重送</el-button>
            </template>
            <el-dropdown v-if="(t.status === '待派工' && isEngManager) || canCancel(t)" trigger="click" @command="(c: string) => (c === 'reject' ? reject(t) : cancel(t))">
              <el-button size="small" text :icon="MoreFilled" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="t.status === '待派工' && isEngManager" command="reject">退回</el-dropdown-item>
                  <el-dropdown-item v-if="canCancel(t)" command="cancel">取消服務單</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </span>
        </div>
        <dl v-if="isOpen(t)" class="kv">
          <dt>需求</dt><dd>{{ t.desc }}</dd>
          <template v-if="t.status === '待派工' || t.status === '待接受' || t.status === '已派工'"><dt>需求日期</dt><dd>{{ t.dueDate }}<span v-if="overdue(t)" class="late">（逾期 {{ overdue(t) }} 天）</span></dd></template>
          <dt>申請</dt><dd>{{ t.requestedBy }} · {{ dateTime(t.requestedAt) }}</dd>
          <template v-if="t.suggestedId"><dt>建議工程師</dt><dd>{{ nameOf(t.suggestedId) }}<template v-if="t.suggestReason">，{{ t.suggestReason }}</template></dd></template>
          <template v-if="groupName(t)"><dt>派給組</dt><dd>{{ groupName(t) }}</dd></template>
          <template v-for="(x, i) in t.declines ?? []" :key="i"><dt>婉拒</dt><dd class="reason">{{ nameOf(x.userId) }}：{{ x.reason }}</dd></template>
          <template v-if="t.assignedAt"><dt>派工</dt><dd>{{ nameOf(t.assignedById ?? '') }} · {{ dateTime(t.assignedAt) }}<template v-if="t.assignNote">，{{ t.assignNote }}</template></dd></template>
          <template v-if="t.status === '已退回'"><dt>退回原因</dt><dd class="reason">{{ t.rejectReason }}</dd></template>
          <template v-if="t.status === '已取消'"><dt>取消原因</dt><dd class="muted">{{ t.cancelReason }}</dd></template>
          <template v-if="t.status === '已完成'">
            <dt>服務內容</dt><dd>{{ t.workSummary || '—' }}</dd>
            <dt>到場時間</dt><dd>{{ t.arrivedAt ? dateTime(t.arrivedAt) : '—' }}</dd>
            <dt>完成時間</dt><dd>{{ t.completedAt ? dateTime(t.completedAt) : '—' }}</dd>
          </template>
        </dl>
      </li>
    </ul>
    </div>

    <el-dialog v-model="reqOpen" :title="reqTarget ? `補件重送｜${shortNo(reqTarget)} ${reqTarget.type}` : '新增服務單'" width="520px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="支援類型">
          <el-radio-group v-model="reqForm.type">
            <el-radio-button value="售前諮詢">售前諮詢</el-radio-button>
            <el-radio-button value="POC">POC</el-radio-button>
            <el-radio-button value="現場勘查">現場勘查</el-radio-button>
            <el-radio-button value="部署">部署</el-radio-button>
            <el-radio-button value="其他">其他</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="需求說明" required>
          <el-input v-model="reqForm.desc" type="textarea" :rows="3" placeholder="例：POC 兩週，需部署 200 端點並做防火牆策略移轉" />
        </el-form-item>
        <div class="grid2">
          <el-form-item label="需求日期" required>
            <el-date-picker v-model="reqForm.dueDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="急件">
            <el-switch v-model="reqForm.urgent" />
          </el-form-item>
        </div>
        <div class="grid2">
          <el-form-item label="建議工程師">
            <el-select v-model="reqForm.suggestedId" clearable placeholder="不指定" style="width: 100%">
              <el-option v-for="u in engineers" :key="u.id" :value="u.id" :label="u.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="建議理由">
            <el-input v-model="reqForm.suggestReason" :disabled="!reqForm.suggestedId" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="reqOpen = false">取消</el-button>
        <el-button type="primary" @click="submitRequest">{{ reqTarget ? '重送給工程主管' : '送交工程主管派工' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="assignOpen" :title="assignTarget ? `${assignTarget.status === '已派工' ? '改派' : '派工'}｜${shortNo(assignTarget)} ${assignTarget.type}` : '派工'" width="560px" append-to-body>
      <div v-if="assignTarget" class="assign-summary">
        <b>{{ deal.customer }} · {{ assignTarget.type }}</b>
        <div class="muted small">{{ assignTarget.type }} · 需求日期 {{ assignTarget.dueDate }}{{ assignTarget.urgent ? ' · 急件' : '' }}</div>
        <p class="muted small">{{ assignTarget.desc }}</p>
        <p v-if="assignTarget.suggestedId" class="suggest">業務建議：<b>{{ nameOf(assignTarget.suggestedId) }}</b><template v-if="assignTarget.suggestReason">，{{ assignTarget.suggestReason }}</template></p>
      </div>
      <div v-if="isEngManager && assignTarget?.status === '待派工'" class="group-pick">
        <span class="muted small">派給組</span>
        <el-select v-model="assignGroup" size="small" clearable placeholder="直接派人" style="width: 180px">
          <el-option v-for="g in engGroups" :key="g.id" :value="g.id" :label="`${g.name}（組長 ${nameOf(g.leaderId)}）`" />
        </el-select>
      </div>
      <ul v-if="!assignGroup" class="people">
        <li v-for="u in pickable" :key="u.id" :class="{ on: assignIds.includes(u.id) }" @click="toggleEngineer(u.id)">
          <span class="avatar">{{ u.name.slice(0, 1) }}</span>
          <span class="who"><b>{{ u.name }}<span v-if="u.id === assignTarget?.suggestedId" class="tag teal">業務建議</span></b><span class="muted small">{{ (u.skills ?? []).join('、') || '—' }} · 進行中 {{ loadOf(u.id) }} 張</span></span>
          <el-checkbox :model-value="assignIds.includes(u.id)" @click.stop @change="toggleEngineer(u.id)" />
        </li>
      </ul>
      <el-input v-model="assignNote" placeholder="派工說明，例：先做現場勘查，部署另派" class="note" />
      <template #footer>
        <el-button @click="assignOpen = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">{{ assignGroup ? '交給這一組' : assignTarget?.status === '待派工' ? '確認派工' : '確認改派' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="doneOpen" :title="doneTarget ? `完成｜${shortNo(doneTarget)} ${doneTarget.type}` : '完成'" width="520px" append-to-body>
      <div v-if="doneTarget" class="assign-summary">
        <b>{{ deal.customer }} · {{ doneTarget.type }}</b>
      </div>
      <el-form label-position="top">
        <el-form-item label="服務內容" required>
          <el-input v-model="doneForm.workSummary" type="textarea" :rows="3" />
        </el-form-item>
        <div class="grid2">
          <el-form-item label="到場時間" required>
            <el-date-picker v-model="doneForm.arrivedAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
          </el-form-item>
          <el-form-item label="完成時間" required>
            <el-date-picker v-model="doneForm.completedAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="doneOpen = false">取消</el-button>
        <el-button type="primary" @click="submitComplete">確認完成</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.group-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}

.suggest {
  margin: 6px 0 0;
  font-size: 13px;
}

.chip.wait {
  color: var(--amber);
}

.block {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.block {
  display: flex;
  flex-direction: column;
  height: 300px;
  min-height: 0;
}

.block-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin-right: -6px;
  padding-right: 6px;
}

.block-head h4 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.sub {
  font-weight: 400;
  font-size: 12px;
}

.tickets {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tickets li {
  border-top: 1px solid var(--line);
}

.tickets li:first-child {
  border-top: none;
}

.tickets li.mine .row {
  background: var(--teal-soft);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 4px;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
}

.row:hover {
  background: var(--paper);
}

.chev {
  color: var(--muted);
  flex: none;
}

.no {
  font-weight: 600;
  flex: none;
}

.title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  flex: none;
  white-space: nowrap;
}

.late {
  color: var(--red);
}

.acts {
  display: flex;
  gap: 4px;
  flex: none;
}

.acts :deep(.el-button + .el-button) {
  margin-left: 0;
}

.kv {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 3px 12px;
  margin: 0 0 8px 28px;
  font-size: 13px;
}

.kv dt {
  color: var(--muted);
}

.kv dd {
  margin: 0;
}

.chip {
  display: inline-block;
  padding: 0 7px;
  margin-right: 3px;
  border-radius: 999px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.reason {
  color: var(--red);
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}

.assign-summary {
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: 6px;
  background: var(--paper);
}

.assign-summary p {
  margin: 4px 0 0;
}

.people {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
}

.people li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
}

.people li:last-child {
  border-bottom: none;
}

.people li.on {
  background: var(--teal-soft);
}

.who {
  display: flex;
  flex-direction: column;
  flex: 1;
  line-height: 1.3;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--amber);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  flex: none;
}

.small {
  font-size: 12px;
}
</style>
