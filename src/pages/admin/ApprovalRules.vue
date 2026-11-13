<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { VueFlow, useVueFlow, MarkerType, type Connection, type Node, type Edge, type NodeDragEvent, type EdgeMouseEvent, type NodeMouseEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { useAppStore } from '../../stores/app'
import { users, type Role } from '../../mock/data'
import {
  routing, routingHistory, docTypes, docTypeOf, factOf, evaluate, describe, edgeText, nodeLabel, outgoing, isDefault, assignText, assignModeOf,
  STEP_OPTIONS, OPS_BY_KIND,
  type RoutingConfig, type DocRouting, type RouteEdge, type Condition, type Step, type Op, type AssignMode,
} from '../../mock/routing'
import RouteNodeCard from '../../components/RouteNodeCard.vue'
import ApprovalRoute from '../../components/ApprovalRoute.vue'
import { pct } from '../../utils/format'

const store = useAppStore()
const canEdit = computed(() => ['執行長', '財務主管', '系統管理員'].includes(store.role))

/* 畫面改的是草稿；儲存才寫回 routing 並升版本 */
const clone = (c: RoutingConfig): RoutingConfig => JSON.parse(JSON.stringify(c))
const draft = reactive<RoutingConfig>(clone(routing))
const saved = ref(JSON.stringify(routing))
const dirty = computed(() => JSON.stringify(draft) !== saved.value)
const thresholdPct = computed({
  get: () => Math.round(draft.lowMarginThreshold * 1000) / 10,
  set: (v: number) => (draft.lowMarginThreshold = v / 100),
})

const groupTag: Record<string, string> = { 業務: 'teal', 採購: 'slate', 財務: 'amber', 行政: 'olive' }
const current = ref('上單')
const simOpen = ref(true)
async function toggleSim() {
  simOpen.value = !simOpen.value
  await nextTick()
  fitView({ padding: 0.25, duration: 200 })
}
const doc = computed(() => draft.docs.find((d) => d.docType === current.value)!)
const def = computed(() => docTypeOf(current.value))
const nodeById = (id: string) => doc.value.nodes.find((n) => n.id === id)

/* ---------- 試算 ---------- */
const sim = reactive<{ applicantId: string; facts: Record<string, number | string | boolean> }>({ applicantId: 'u-chen', facts: {} })
const simApplicant = computed(() => users.find((u) => u.id === sim.applicantId))
const simFacts = computed(() => def.value?.facts ?? [])
function resetSim() {
  const f: Record<string, number | string | boolean> = {}
  for (const x of simFacts.value) f[x.key] = x.kind === '是否' ? false : x.kind === '列舉' ? x.options?.[0] ?? '' : 0
  if (current.value === '上單') Object.assign(f, { margin: -1, amount: 1_200_000 })
  if (current.value === 'PO') Object.assign(f, { amount: 1_200_000 })
  if (current.value === '請假與出勤') Object.assign(f, { kind: '事假', days: 5 })
  sim.facts = f
}
resetSim()
const simResult = computed(() => evaluate(current.value, { facts: sim.facts, applicantRole: simApplicant.value?.role, applicantId: sim.applicantId }, draft))
const desc = computed(() => describe(doc.value, draft))

/* ---------- 畫布 ---------- */
const { onConnect, screenToFlowCoordinate, fitView } = useVueFlow()
const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])

function edgeLabel(e: RouteEdge): string {
  if (isDefault(e)) return ''
  const conds = outgoing(doc.value, e.from).filter((x) => !isDefault(x))
  return `${conds.length > 1 ? `${conds.indexOf(e) + 1}. ` : ''}${edgeText(current.value, e, draft.lowMarginThreshold)}`
}

function syncFlow() {
  const hitNodes = new Set(simResult.value.path)
  const hitEdges = new Set(simResult.value.edges)
  /* vue-flow 的 Node 泛型推導太深，這裡先組純物件再整批指定 */
  const nodes: Node[] = []
  for (const n of doc.value.nodes) {
    nodes.push({
      id: n.id,
      type: n.kind,
      position: { x: n.x, y: n.y },
      draggable: canEdit.value && n.kind === 'role',
      data: { kind: n.kind, role: n.role, sub: n.kind === 'role' ? assignText(n) : undefined, hit: hitNodes.has(n.id), editable: canEdit.value },
    })
  }
  flowNodes.value = nodes
  const edges: Edge[] = []
  for (const e of doc.value.edges) {
    const hit = hitEdges.has(e.id)
    edges.push({
      id: e.id,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      label: edgeLabel(e),
      markerEnd: MarkerType.ArrowClosed,
      animated: hit,
      class: `${hit ? 'hit' : ''} ${!isDefault(e) ? 'cond' : 'dflt'}`,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 3,
      style: { stroke: hit ? 'var(--teal)' : !isDefault(e) ? 'var(--amber)' : 'var(--line-strong)', strokeWidth: hit ? 2.4 : !isDefault(e) ? 1.8 : 1.4 },
      labelStyle: { fill: hit ? 'var(--teal-ink)' : 'var(--amber)', fontSize: 12 },
      labelBgStyle: { fill: 'var(--surface)', stroke: hit ? 'var(--teal)' : 'var(--amber)', strokeWidth: 1 },
    })
  }
  flowEdges.value = edges
}
syncFlow()
watch([doc, simResult, canEdit], () => syncFlow(), { deep: false })
watch(current, async () => {
  resetSim()
  syncFlow()
  await nextTick()
  fitView({ padding: 0.25, duration: 200 })
})

/* 拖角色進畫布 */
function onDragStart(ev: DragEvent, role: Step) {
  ev.dataTransfer?.setData('text/plain', role)
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
}
function onDrop(ev: DragEvent) {
  if (!canEdit.value) return
  const role = ev.dataTransfer?.getData('text/plain') as Step | ''
  if (!role || !STEP_OPTIONS.includes(role)) return
  if (doc.value.nodes.some((n) => n.role === role)) {
    ElMessage.warning(`${role} 已在畫布上`)
    return
  }
  const pos = screenToFlowCoordinate({ x: ev.clientX, y: ev.clientY })
  doc.value.nodes.push({ id: `n-${role}`, kind: 'role', role, x: Math.round(pos.x), y: Math.round(pos.y) })
  syncFlow()
}
function onNodeDragStop(ev: NodeDragEvent) {
  for (const n of ev.nodes) {
    const t = nodeById(n.id)
    if (t) {
      t.x = Math.round(n.position.x)
      t.y = Math.round(n.position.y)
    }
  }
}
function removeNode(id: string) {
  const n = nodeById(id)
  if (!n || n.kind !== 'role') return
  doc.value.nodes = doc.value.nodes.filter((x) => x.id !== id)
  doc.value.edges = doc.value.edges.filter((e) => e.from !== id && e.to !== id)
  syncFlow()
}

/* 點節點 → 誰來簽 */
const ndlg = reactive<{ open: boolean; nodeId: string; mode: AssignMode; userId: string; proxyUserId: string }>({ open: false, nodeId: '', mode: '任一人', userId: '', proxyUserId: '' })
/* 代理人：只有執行長、系統管理員能設；該角色沒有人時由他簽 */
const proxyUsers = computed(() => users.filter((u) => !['業務', '工程師'].includes(u.role)))
/* 代理人本身的角色也在這張單的其他關卡：可能同一人簽兩關（系統會併關，但可能不足三人） */
const proxyClash = computed(() => {
  const u = users.find((x) => x.id === ndlg.proxyUserId)
  if (!u) return ''
  const other = doc.value.nodes.find((n) => n.id !== ndlg.nodeId && n.kind === 'role' && (n.role === u.role || n.assign?.proxyUserId === u.id))
  return other ? `${u.name} 也可能簽「${other.role}」這一關` : ''
})
const ndlgNode = computed(() => nodeById(ndlg.nodeId))
const ndlgRole = computed(() => ndlgNode.value?.role ?? '')
const ndlgUsers = computed(() => (ndlgRole.value === '直屬主管' ? users.filter((u) => u.role !== '業務') : users.filter((u) => u.role === ndlgRole.value)))
function onNodeClick(ev: NodeMouseEvent) {
  const n = nodeById(ev.node.id)
  if (!n || n.kind !== 'role') return
  ndlg.nodeId = n.id
  ndlg.mode = assignModeOf(n)
  ndlg.userId = n.assign?.userId ?? ndlgUsers.value[0]?.id ?? ''
  ndlg.proxyUserId = n.assign?.proxyUserId ?? ''
  ndlg.open = true
}
function confirmNodeDialog() {
  const n = ndlgNode.value
  if (!n) return
  if (ndlg.mode === '指定人' && !ndlg.userId) {
    ElMessage.warning('請選一位')
    return
  }
  const dflt: AssignMode = n.role === '直屬主管' ? '依申請人' : '任一人'
  n.assign = ndlg.mode === dflt && !ndlg.proxyUserId ? undefined : { mode: ndlg.mode, userId: ndlg.mode === '指定人' ? ndlg.userId : undefined, proxyUserId: ndlg.proxyUserId || undefined }
  ndlg.open = false
  syncFlow()
}
function removeFromNodeDialog() {
  ndlg.open = false
  removeNode(ndlg.nodeId)
}

/* 接線 → 跳出規則對話框 */
const dlg = reactive<{ open: boolean; edgeId: string | null; from: string; to: string; mode: '預設' | '條件'; conds: Condition[]; priority: number; note: string }>({
  open: false, edgeId: null, from: '', to: '', mode: '預設', conds: [], priority: 1, note: '',
})
const condFact = (c: Condition) => factOf(current.value, c.fact)
const condOps = (c: Condition): Op[] => (condFact(c) ? OPS_BY_KIND[condFact(c)!.kind] : [])
const condNeedsValue = (c: Condition) => !!condFact(c) && condFact(c)!.kind !== '是否' && c.op !== '低於門檻'
const hasDefault = (from: string, except?: string | null) => doc.value.edges.some((e) => e.from === from && isDefault(e) && e.id !== except)
function defaultCondValue(c: Condition): void {
  const f = condFact(c)
  if (!f) return
  if (f.kind === '是否' || c.op === '低於門檻') c.value = undefined
  else if (f.kind === '列舉') c.value = c.op === '屬於' ? [f.options?.[0] ?? ''] : f.options?.[0]
  else if (typeof c.value !== 'number') c.value = f.kind === '金額' ? 100_000 : f.kind === '天數' ? 3 : 10
}
function newCond(): Condition {
  const f = def.value?.facts[0]
  const c: Condition = { fact: f?.key ?? '', op: f ? OPS_BY_KIND[f.kind][0]! : '≥', value: undefined }
  defaultCondValue(c)
  return c
}
function onCondFact(c: Condition) {
  const f = condFact(c)
  if (!f) return
  c.op = OPS_BY_KIND[f.kind][0]!
  c.value = undefined
  defaultCondValue(c)
}
function onCondOp(c: Condition) {
  const f = condFact(c)
  if (!f) return
  if (f.kind === '列舉') c.value = c.op === '屬於' ? [f.options?.[0] ?? ''] : f.options?.[0]
  else if (c.op === '低於門檻') c.value = undefined
  else defaultCondValue(c)
}
function openDialog(from: string, to: string, edge?: RouteEdge) {
  dlg.edgeId = edge?.id ?? null
  dlg.from = from
  dlg.to = to
  const conditional = edge ? !isDefault(edge) : hasDefault(from)
  dlg.mode = conditional ? '條件' : '預設'
  dlg.conds = edge && !isDefault(edge) ? JSON.parse(JSON.stringify(edge.conds)) : [newCond()]
  dlg.priority = edge?.priority ?? outgoing(doc.value, from).filter((e) => !isDefault(e)).length + 1
  dlg.note = edge?.note ?? ''
  dlg.open = true
}
watch(() => dlg.mode, (m) => { if (m === '條件' && !dlg.conds.length) dlg.conds = [newCond()] })
onConnect((c: Connection) => {
  if (!canEdit.value || !c.source || !c.target) return
  if (c.source === c.target) return
  if (c.target === 'start' || c.source === 'end') {
    ElMessage.warning('起點只能出線、終點只能進線')
    return
  }
  /* 同一對節點只有一條線；再拉一次就是編輯它（多個條件用「或」掛在同一條線上） */
  const dup = doc.value.edges.find((e) => e.from === c.source && e.to === c.target)
  openDialog(c.source, c.target, dup)
})
function onEdgeClick(ev: EdgeMouseEvent) {
  const e = doc.value.edges.find((x) => x.id === ev.edge.id)
  if (e) openDialog(e.from, e.to, e)
}
function confirmDialog() {
  if (dlg.mode === '預設' && hasDefault(dlg.from, dlg.edgeId)) {
    ElMessage.warning(`「${nodeLabel(nodeById(dlg.from))}」已經有一條預設線，這條請設條件`)
    return
  }
  if (dlg.mode === '條件') {
    if (!dlg.conds.length || dlg.conds.some((c) => !condFact(c))) {
      ElMessage.warning('請選判斷因子')
      return
    }
    if (dlg.conds.some((c) => condNeedsValue(c) && (c.value === undefined || c.value === '' || (Array.isArray(c.value) && !c.value.length)))) {
      ElMessage.warning('請填條件的值')
      return
    }
  }
  const conds: Condition[] | undefined = dlg.mode === '條件' ? JSON.parse(JSON.stringify(dlg.conds)) : undefined
  const existing = dlg.edgeId ? doc.value.edges.find((e) => e.id === dlg.edgeId) : undefined
  if (existing) {
    existing.conds = conds
    existing.priority = dlg.priority
    existing.note = dlg.note.trim() || undefined
  } else {
    doc.value.edges.push({ id: `${dlg.from}>${dlg.to}`, from: dlg.from, to: dlg.to, priority: dlg.priority, conds, note: dlg.note.trim() || undefined })
  }
  dlg.open = false
  syncFlow()
}
function deleteEdge() {
  if (dlg.edgeId) doc.value.edges = doc.value.edges.filter((e) => e.id !== dlg.edgeId)
  dlg.open = false
  syncFlow()
}
const paletteRoles = computed(() => STEP_OPTIONS.filter((r) => !doc.value.nodes.some((n) => n.role === r)))

/* ---------- 儲存 ---------- */
function summarize(): string {
  const before = JSON.parse(saved.value) as RoutingConfig
  const parts: string[] = []
  if (before.lowMarginThreshold !== draft.lowMarginThreshold) parts.push(`低毛利門檻 ${pct(before.lowMarginThreshold, 1)} → ${pct(draft.lowMarginThreshold, 1)}`)
  for (const d of draft.docs) {
    const b = before.docs.find((x) => x.docType === d.docType)
    if (!b) continue
    const strip = (x: DocRouting) => JSON.stringify({ n: x.nodes.map((n) => [n.id]).sort(), e: x.edges.map((e) => [e.from, e.to, e.conds, e.priority]) })
    if (strip(b) === strip(d)) continue
    const info = describe(d, draft)
    parts.push(`${d.docType}：標準 ${info.standard.join(' → ')}${info.branches.map((br) => `；${br.cond} 時 ${br.path.join(' → ')}`).join('')}`)
  }
  return parts.join('。') || '只移動了節點位置'
}
function save() {
  for (const d of draft.docs) {
    const p = describe(d, draft).problems
    if (p.length) {
      ElMessage.warning(`${d.docType}：${p[0]}`)
      current.value = d.docType
      return
    }
  }
  const summary = summarize()
  const today = new Date().toISOString().slice(0, 10)
  draft.version = routing.version + 1
  draft.updatedAt = today
  draft.updatedBy = store.currentUser.name
  Object.assign(routing, clone(draft))
  routingHistory.unshift({ version: routing.version, at: today, by: store.currentUser.name, summary })
  saved.value = JSON.stringify(routing)
  ElMessage.success(`已儲存為簽核進度 v${routing.version}。已送審的單據沿用原版本，新送的單從現在起照新規則走`)
}
function discard() {
  Object.assign(draft, clone(routing))
  syncFlow()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>簽核進度設定</h1>
      </div>
      <div class="actions">
        <span class="muted small version">目前 v{{ routing.version }} · {{ routing.updatedAt }} {{ routing.updatedBy }}</span>
        <el-button :disabled="!dirty" @click="discard">放棄變更</el-button>
        <el-button type="primary" :disabled="!dirty || !canEdit" @click="save">儲存為新版本</el-button>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>通用參數</h2></div>
      <div class="panel-body general">
        <span class="lbl">低毛利門檻</span>
        <el-input-number v-model="thresholdPct" :min="0" :max="30" :step="0.5" :disabled="!canEdit" />
        <span>%</span>
      </div>
    </section>

    <section class="panel canvas-panel">
      <div class="panel-head">
        <h2>
          <el-select v-model="current" class="title-select" style="width: 190px">
            <el-option v-for="d in draft.docs" :key="d.docType" :value="d.docType" :label="d.docType">
              <span>{{ d.docType }}</span><span v-if="describe(d, draft).problems.length" class="opt-prob">接錯</span>
            </el-option>
          </el-select>
          的路由 <span class="tag" :class="groupTag[def?.group ?? '']">{{ def?.group }}</span><span class="muted small desc-text">{{ def?.desc }}</span>
        </h2>
        <span class="muted small">判斷因子：<span v-for="f in simFacts" :key="f.key" class="fact">{{ f.label }}<i>{{ f.kind }}</i></span></span>
      </div>
      <div class="palette">
        <span class="muted small">角色（拖進畫布）</span>
        <span v-for="r in paletteRoles" :key="r" class="chip" :class="{ ceo: r === '執行長', off: !canEdit }" :draggable="canEdit" @dragstart="onDragStart($event, r)">{{ r }}</span>
        <span v-if="!paletteRoles.length" class="muted small">全部角色都在畫布上</span>
      </div>
      <div class="canvas">
        <div class="flow" @dragover.prevent @drop="onDrop">
          <VueFlow
            v-model:nodes="flowNodes"
            v-model:edges="flowEdges"
            :nodes-connectable="canEdit"
            :nodes-draggable="canEdit"
            :delete-key-code="null"
            :zoom-on-double-click="false"
            :min-zoom="0.5"
            :max-zoom="1.6"
            fit-view-on-init
            @node-drag-stop="onNodeDragStop"
            @node-click="onNodeClick"
            @edge-click="onEdgeClick"
          >
            <Background pattern-color="#c9cfc8" :gap="18" />
            <template #node-start="p"><RouteNodeCard :id="p.id" :data="p.data" /></template>
            <template #node-end="p"><RouteNodeCard :id="p.id" :data="p.data" /></template>
            <template #node-role="p"><RouteNodeCard :id="p.id" :data="p.data" @remove="removeNode(p.id)" /></template>
          </VueFlow>
          <button v-if="!simOpen" type="button" class="sim-fab" @click="toggleSim">試算 ▸ <span class="muted small">{{ simResult.route.join(' → ') || '—' }}</span></button>
        </div>
        <aside v-if="simOpen" class="sim-panel">
          <button type="button" class="sim-head" @click="toggleSim">
            <span>試算</span>
            <span class="muted small">走過的路在畫布上變綠</span>
            <span class="caret">收合 ▸</span>
          </button>
          <div class="sim-body">
            <div v-for="f in simFacts" :key="f.key" class="sim-row">
              <span class="lbl">{{ f.label }}</span>
              <el-checkbox v-if="f.kind === '是否'" v-model="(sim.facts[f.key] as boolean)" size="small">是</el-checkbox>
              <el-select v-else-if="f.kind === '列舉'" v-model="(sim.facts[f.key] as string)" size="small" style="width: 130px">
                <el-option v-for="o in f.options ?? []" :key="o" :value="o" :label="o" />
              </el-select>
              <template v-else>
                <el-input-number v-model="(sim.facts[f.key] as number)" size="small" :step="f.kind === '金額' ? 10000 : f.kind === '百分比' ? 0.5 : 1" :controls="false" style="width: 110px" />
                <span class="muted small">{{ f.kind === '百分比' ? '%' : f.kind === '天數' ? '天' : '' }}</span>
              </template>
            </div>
            <div class="sim-row">
              <span class="lbl">申請人</span>
              <el-select v-model="sim.applicantId" size="small" style="width: 150px">
                <el-option v-for="u in users" :key="u.id" :value="u.id" :label="`${u.name}（${u.role}）`" />
              </el-select>
            </div>
            <div class="sim-result">
              <ApprovalRoute :route="simResult.route" :current="0" preview />
              <p class="muted small">
                <template v-if="simResult.applied.length">命中：{{ simResult.applied.map((a) => a.text).join('；') }}</template>
                <template v-else>沒有命中條件，走標準路由。</template>
              </p>
              <ul class="who">
                <li v-for="(s, i) in simResult.steps" :key="i"><b>{{ s.role }}</b> {{ s.label }}</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
      <div class="legend">
        <span><i class="ln dflt"></i>預設線：沒有條件命中時走這條</span>
        <span><i class="ln cond"></i>條件線：橘色並標條件，同一節點多條時依編號先後比對</span>
        <span><i class="ln hit"></i>試算走過的路：綠色流動虛線</span>
      </div>
    </section>

    <section class="panel full">
        <div class="panel-head"><h2>路由說明</h2></div>
        <div class="panel-body desc">
          <p v-for="(p, i) in desc.problems" :key="'p' + i" class="prob">{{ p }}</p>
          <p v-for="(w, i) in desc.warnings" :key="'w' + i" class="warn">{{ w }}</p>
          <div class="line"><span class="k">標準</span><ApprovalRoute :route="(desc.standard as Role[])" :current="0" preview /><span v-if="!desc.reachedEnd" class="prob small">（沒有連到終點）</span></div>
          <div v-for="b in desc.branches" :key="b.edgeId" class="line">
            <span class="k">當 {{ b.cond }}</span>
            <ApprovalRoute :route="(b.path as Role[])" :current="0" preview />
            <span v-if="!b.reachedEnd" class="prob small">（沒有連到終點）</span>
            <span v-if="b.note" class="muted small note">{{ b.note }}</span>
          </div>
          <div v-if="desc.assignments.length" class="line"><span class="k">誰來簽</span><span class="muted small">{{ desc.assignments.join('；') }}</span></div>
        </div>
    </section>

    <section class="panel full">
        <div class="panel-head"><h2>單據類型註冊表</h2></div>
        <table class="plain-table">
          <thead><tr><th>單據</th><th>分組</th><th>判斷因子</th><th>送審來源</th></tr></thead>
          <tbody>
            <tr v-for="d in docTypes" :key="d.key">
              <td>{{ d.label }}</td>
              <td><span class="tag" :class="groupTag[d.group]">{{ d.group }}</span></td>
              <td><span v-for="f in d.facts" :key="f.key" class="fact">{{ f.label }}<i>{{ f.kind }}</i></span></td>
              <td class="muted">{{ d.source }}</td>
            </tr>
          </tbody>
        </table>
    </section>

    <section class="panel full">
      <div class="panel-head"><h2>版本歷程</h2></div>
      <table class="plain-table">
        <thead><tr><th>版本</th><th>日期</th><th>異動人</th><th>內容</th></tr></thead>
        <tbody>
          <tr v-for="h in routingHistory" :key="h.version">
            <td class="num">v{{ h.version }}</td>
            <td class="num">{{ h.at }}</td>
            <td>{{ h.by }}</td>
            <td>{{ h.summary }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <el-dialog v-model="ndlg.open" width="460px" :title="`${ndlgRole} 誰來簽`" append-to-body>
      <el-radio-group v-model="ndlg.mode" class="who-modes" :disabled="!canEdit">
        <el-radio value="任一人"><b>任一人</b></el-radio>
        <el-radio value="依申請人"><b>依申請人</b></el-radio>
        <el-radio value="指定人"><b>指定人</b></el-radio>
      </el-radio-group>
      <div v-if="ndlg.mode === '指定人'" class="cond-line note-line">
        <span class="muted">指定</span>
        <el-select v-model="ndlg.userId" size="small" style="width: 200px" :disabled="!canEdit">
          <el-option v-for="u in ndlgUsers" :key="u.id" :value="u.id" :label="`${u.name}（${u.role}・${u.dept}）`" />
        </el-select>
      </div>
      <div class="cond-line note-line">
        <span class="muted">代理人</span>
        <el-select v-model="ndlg.proxyUserId" size="small" clearable placeholder="無" style="width: 200px" :disabled="!canEdit || !['執行長', '系統管理員'].includes(store.role)">
          <el-option v-for="u in proxyUsers" :key="u.id" :value="u.id" :label="`${u.name}（${u.role}）`" />
        </el-select>
        <span v-if="!ndlgUsers.length" class="tag amber">目前沒有{{ ndlgRole }}</span>
        <span v-if="proxyClash" class="tag amber">{{ proxyClash }}</span>
      </div>
      <template #footer>
        <el-button v-if="canEdit" type="danger" plain @click="removeFromNodeDialog">移除這一關</el-button>
        <el-button @click="ndlg.open = false">取消</el-button>
        <el-button type="primary" :disabled="!canEdit" @click="confirmNodeDialog">確定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dlg.open" width="520px" :title="`${nodeLabel(nodeById(dlg.from))} → ${nodeLabel(nodeById(dlg.to))}`" append-to-body>
      <el-radio-group v-model="dlg.mode" :disabled="!canEdit">
        <el-radio value="預設">預設（沒有條件命中時走這條）</el-radio>
        <el-radio value="條件">有條件</el-radio>
      </el-radio-group>
      <div v-if="dlg.mode === '條件'" class="cond-form">
        <div v-for="(c, i) in dlg.conds" :key="i" class="cond-line">
          <span class="muted">{{ i === 0 ? '當' : '或' }}</span>
          <el-select v-model="c.fact" size="small" style="width: 140px" :disabled="!canEdit" @change="onCondFact(c)">
            <el-option v-for="f in simFacts" :key="f.key" :value="f.key" :label="f.label" />
          </el-select>
          <el-select v-model="c.op" size="small" style="width: 96px" :disabled="!canEdit" @change="onCondOp(c)">
            <el-option v-for="o in condOps(c)" :key="o" :value="o" :label="o" />
          </el-select>
          <template v-if="condNeedsValue(c)">
            <el-select v-if="condFact(c)?.kind === '列舉' && c.op === '屬於'" v-model="c.value" multiple collapse-tags size="small" style="width: 160px" :disabled="!canEdit">
              <el-option v-for="o in condFact(c)?.options ?? []" :key="o" :value="o" :label="o" />
            </el-select>
            <el-select v-else-if="condFact(c)?.kind === '列舉'" v-model="c.value" size="small" style="width: 140px" :disabled="!canEdit">
              <el-option v-for="o in condFact(c)?.options ?? []" :key="o" :value="o" :label="o" />
            </el-select>
            <span v-else class="val">
              <el-input-number v-model="(c.value as number)" size="small" :min="condFact(c)?.kind === '百分比' ? -100 : 0" :step="condFact(c)?.kind === '金額' ? 10000 : 1" :controls="false" style="width: 110px" :disabled="!canEdit" />
              <span class="muted small">{{ condFact(c)?.kind === '百分比' ? '%' : condFact(c)?.kind === '天數' ? '天' : '' }}</span>
            </span>
          </template>
          <button v-if="canEdit && dlg.conds.length > 1" type="button" class="del" title="移除這個條件" @click="dlg.conds.splice(i, 1)">×</button>
        </div>
        <div class="cond-line">
          <el-button v-if="canEdit" text size="small" type="primary" @click="dlg.conds.push(newCond())">＋ 再加一個條件（任一成立就走這條線）</el-button>
        </div>
        <div class="cond-line">
          <span class="muted">比對順序</span>
          <el-input-number v-model="dlg.priority" size="small" :min="1" :max="9" style="width: 90px" :disabled="!canEdit" />
        </div>
      </div>
      <div class="cond-line note-line">
        <span class="muted">備註</span>
        <el-input v-model="dlg.note" size="small" placeholder="給看設定的人的說明" :disabled="!canEdit" />
      </div>
      <template #footer>
        <el-button v-if="dlg.edgeId && canEdit" type="danger" plain @click="deleteEdge">刪除這條線</el-button>
        <el-button @click="dlg.open = false">取消</el-button>
        <el-button type="primary" :disabled="!canEdit" @click="confirmDialog">確定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.version {
  align-self: center;
}

.small {
  font-size: 12px;
}

.general {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.sep {
  width: 1px;
  height: 22px;
  background: var(--line);
  margin: 0 6px;
}

.lbl {
  color: var(--muted);
  font-size: 13px;
  min-width: 72px;
}

.fact {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--surface-2);
  font-size: 12px;
  color: var(--ink);
  margin-left: 4px;
}

.fact i {
  font-style: normal;
  color: var(--muted);
  font-size: 11px;
}

.canvas-panel {
  margin-top: 14px;
}

.title-select :deep(.el-select__wrapper) {
  font-size: 15px;
  font-weight: 600;
}

.opt-prob {
  margin-left: 8px;
  color: var(--red);
  font-size: 12px;
}

.sim-panel {
  width: 310px;
  flex: none;
  border-left: 1px solid var(--line);
  background: var(--surface);
  overflow: auto;
}

.sim-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  background: var(--paper);
  padding: 7px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}

.sim-head .caret {
  margin-left: auto;
  color: var(--muted);
}

.sim-head .small {
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sim-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--line);
}

.desc-text {
  font-weight: 400;
}

.full {
  margin-top: 14px;
}

.palette {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
}

.chip {
  display: inline-block;
  padding: 3px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: var(--surface);
  font-size: 13px;
  cursor: grab;
  user-select: none;
}

.chip.ceo {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-soft);
}

.chip.off {
  cursor: default;
  opacity: 0.6;
}

.hint {
  margin-left: auto;
}

.canvas {
  display: flex;
  height: 420px;
  background: var(--surface);
}

.flow {
  flex: 1;
  min-width: 0;
  position: relative;
}

.sim-fab {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 5;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: var(--surface);
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sim-fab .small {
  font-weight: 400;
}

.canvas :deep(.vue-flow__edge-textbg) {
  rx: 3px;
}

.canvas :deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: var(--teal);
}

.canvas :deep(.vue-flow__edge) {
  cursor: pointer;
}

.legend {
  display: flex;
  gap: 18px;
  padding: 8px 16px;
  border-top: 1px solid var(--line);
  font-size: 12px;
  color: var(--muted);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ln {
  display: inline-block;
  width: 26px;
  height: 0;
  border-top: 2px solid var(--line-strong);
}

.ln.cond {
  border-top: 2px solid var(--amber);
}

.ln.hit {
  border-top: 2px dashed var(--teal);
}

.two {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 14px;
  margin-top: 14px;
}

@media (max-width: 1100px) {
  .two {
    grid-template-columns: 1fr;
  }
}

.desc {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.desc .line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.desc .k {
  min-width: 48px;
  font-size: 13px;
  color: var(--muted);
}

.prob {
  color: var(--red);
  font-size: 13px;
}

.warn {
  color: var(--amber);
  font-size: 13px;
}

.note::before {
  content: "｜";
  color: var(--line-strong);
}

.foot-note {
  margin-top: 4px;
}

.sim-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sim-row .lbl {
  min-width: 96px;
  font-size: 12px;
}

.sim-result {
  margin-top: 4px;
  padding: 8px 10px;
  background: var(--paper);
  border-radius: var(--radius-s);
}

.sim-result p {
  margin-top: 6px;
}

.intro {
  padding: 10px 16px;
  max-width: 90ch;
}

.foot {
  margin-top: 14px;
  max-width: 90ch;
}

.cond-form {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--paper);
  border-radius: var(--radius-s);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cond-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.note-line {
  margin-top: 12px;
}

.who-modes {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.who-modes :deep(.el-radio) {
  height: auto;
  align-items: flex-start;
  white-space: normal;
}

.who-modes :deep(.el-radio__label) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.who-note {
  margin-top: 12px;
}

.who {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  font-size: 12px;
  color: var(--muted);
}

.who li + li {
  margin-top: 2px;
}

.who b {
  color: var(--ink);
  font-weight: 500;
  margin-right: 4px;
}

.val {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.del {
  border: 0;
  border-radius: 3px;
  background: var(--surface-2);
  color: var(--muted);
  width: 20px;
  height: 24px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}

.del:hover {
  background: var(--red-soft);
  color: var(--red);
}
</style>
