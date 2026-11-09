<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { applications, type Application, type AppType, type Role } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { money, dateTime } from '../../utils/format'
import { evaluate, type Facts } from '../../mock/routing'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

/* 四種申請共用一個模組：欄位依類型切換，路由讀簽核路由設定。欄位是客戶拍板後要補的，先照現行系統的做法放 */
interface Field { key: string; label: string; type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file'; options?: string[]; required?: boolean; width?: 'half' | 'full' }
/* requires：送件要求寫在程式裡（使用者決定不進路由設定），回傳未滿足的要求文字 */
interface TypeConf { type: AppType; slug: string; fields: Field[]; noApproval?: boolean; requires?: (f: Record<string, string | number>, files: string[]) => string[] }
/* 表單欄位換成簽核引擎的判斷因子；哪些因子有用由單據註冊表決定 */
const daysOf = (from?: string | number, to?: string | number) => (from && to ? Math.max(1, Math.round((new Date(String(to)).getTime() - new Date(String(from)).getTime()) / 86_400_000) + 1) : 0)
const factsOf = (f: Record<string, string | number>): Facts => ({
  amount: Number(f.amount ?? 0),
  kind: f.kind !== undefined && f.kind !== '' ? String(f.kind) : undefined,
  onProject: !!f.project,
  days: daysOf(f.from, f.to),
  crossMonth: !!f.from && !!f.to && String(f.from).slice(0, 7) !== String(f.to).slice(0, 7),
  agentSet: !!String(f.agent ?? '').trim(),
})
const evalOf = (c: TypeConf, applicantRole: Role, f: Record<string, string | number>) => evaluate(c.type, { applicantRole, applicantId: store.currentUserId, facts: factsOf(f) })

const CONF: TypeConf[] = [
  {
    type: '報帳與代墊款', slug: 'expenses',
    fields: [
      { key: 'kind', label: '類別', type: 'select', options: ['交通', '餐費', '住宿', '客戶招待', '代墊採購', '其他'], required: true, width: 'half' },
      { key: 'date', label: '發生日期', type: 'date', required: true, width: 'half' },
      { key: 'amount', label: '金額', type: 'number', required: true, width: 'half' },
      { key: 'project', label: '掛到案子', type: 'text', width: 'half' },
      { key: 'desc', label: '事由', type: 'textarea', required: true, width: 'full' },
      { key: 'receipt', label: '發票或收據', type: 'file', width: 'full' },
    ],
    requires: (f, files) => (Number(f.amount ?? 0) >= 5_000 && !files.length ? ['金額達 5,000 必附發票或收據'] : []),
  },
  {
    type: '請假與出勤', slug: 'leave',
    fields: [
      { key: 'kind', label: '假別', type: 'select', options: ['特休', '事假', '病假', '公假', '出勤補登'], required: true, width: 'half' },
      { key: 'agent', label: '代理人', type: 'text', required: true, width: 'half' },
      { key: 'from', label: '開始', type: 'date', required: true, width: 'half' },
      { key: 'to', label: '結束', type: 'date', required: true, width: 'half' },
      { key: 'desc', label: '事由', type: 'textarea', width: 'full' },
    ],
  },
  {
    type: '公務車預約', slug: 'vehicles',
    fields: [
      { key: 'car', label: '車輛', type: 'select', options: ['公務車 A（ABC-1234）', '公務車 B（XYZ-5678）'], required: true, width: 'half' },
      { key: 'purpose', label: '用途', type: 'text', required: true, width: 'half' },
      { key: 'from', label: '開始', type: 'date', required: true, width: 'half' },
      { key: 'to', label: '結束', type: 'date', required: true, width: 'half' },
      { key: 'customer', label: '拜訪客戶', type: 'text', width: 'full' },
    ],
    noApproval: true,
  },
  {
    type: '用印名片與請購', slug: 'general',
    fields: [
      { key: 'kind', label: '項目', type: 'select', options: ['用印（合約）', '用印（投標文件）', '名片', '內部請購', '固定支出'], required: true, width: 'half' },
      { key: 'amount', label: '金額（用印與名片免填）', type: 'number', width: 'half' },
      { key: 'desc', label: '內容', type: 'textarea', required: true, width: 'full' },
      { key: 'doc', label: '附件（合約或報價）', type: 'file', width: 'full' },
    ],
    requires: (f, files) => (f.kind === '用印（合約）' && !files.length ? ['用印（合約）必附合約'] : []),
  },
]
/* 同一頁四個頁簽，頁簽記在網址 ?tab=，舊的 /apps/xxx 會轉過來 */
const tab = ref<string>(CONF.find((c) => c.slug === String(route.query.tab ?? ''))?.slug ?? CONF[0]!.slug)
watch(() => route.query.tab, (t) => { const c = CONF.find((x) => x.slug === String(t ?? '')); if (c && c.slug !== tab.value) tab.value = c.slug })
watch(tab, (t) => { if (String(route.query.tab ?? '') !== t) router.replace({ query: { tab: t } }) })
const conf = computed(() => CONF.find((c) => c.slug === tab.value) ?? CONF[0]!)
/* 這個頁簽的審核路由（標準路徑）與分支說明，取代原本的說明文字 */
/* 新增申請：類型預設帶目前頁簽，彈窗裡還能換 */
const dialogSlug = ref<string>(CONF[0]!.slug)
const dialogConf = computed(() => CONF.find((c) => c.slug === dialogSlug.value) ?? CONF[0]!)
const liveEval = computed(() => (dialogConf.value.noApproval ? undefined : evalOf(dialogConf.value, store.role, form.value)))
function openCreate() { dialogSlug.value = conf.value.slug; form.value = {}; files.value = []; creating.value = true }
watch(dialogSlug, () => { form.value = {}; files.value = [] })
const mine = computed(() => applications.filter((a) => a.type === conf.value.type && (store.role === '執行長' || store.role === '會計' || a.applicantId === store.currentUserId || (store.role === '業務主管' && a.applicantRole === '業務'))).sort((a, b) => b.at.localeCompare(a.at)))

const creating = ref(false)
const form = ref<Record<string, string | number>>({})
const files = ref<string[]>([])
watch(conf, () => { creating.value = false })
function mockFile() { files.value.push(`${dialogConf.value.slug}-${Date.now().toString().slice(-5)}.jpg`) }
function submit() {
  const c = dialogConf.value
  const missing = c.fields.filter((f) => f.required && f.type !== 'file' && (form.value[f.key] === undefined || form.value[f.key] === ''))
  if (missing.length) {
    ElMessage.warning(`${missing.map((f) => f.label).join('、')} 必填`)
    return
  }
  const now = new Date()
  const amount = Number(form.value.amount ?? 0)
  const ymd = now.toISOString().slice(0, 10)
  const appNo = `${c.slug.toUpperCase().slice(0, 3)}-${ymd.slice(0, 4)}-${ymd.slice(5, 7)}${ymd.slice(8, 10)}-${String(applications.length + 1).padStart(3, '0')}`
  const summary = c.fields.filter((f) => f.type !== 'file' && form.value[f.key] !== undefined && form.value[f.key] !== '').map((f) => `${f.label}：${f.type === 'number' ? money(Number(form.value[f.key])) : form.value[f.key]}`).join('；')
  const ev = c.noApproval ? undefined : evalOf(c, store.role, form.value)
  const unmet = c.requires?.(form.value, files.value) ?? []
  if (unmet.length) {
    ElMessage.warning(unmet.join('、'))
    return
  }
  const route_ = ev?.route ?? []
  const app: Application = {
    id: `app-${now.getTime()}`,
    appNo,
    type: c.type,
    title: `${c.type}：${String(form.value.kind ?? form.value.car ?? form.value.purpose ?? '')}${amount ? ` ${money(amount)}` : ''}`,
    applicantId: store.currentUserId,
    applicant: store.currentUser.name,
    applicantRole: store.role,
    at: now.toISOString(),
    fields: { ...form.value },
    files: [...files.value],
    amount: amount || undefined,
    status: c.noApproval ? '已預約' : '待簽核',
  }
  if (!c.noApproval) {
    const approvalId = `a-${now.getTime()}-app`
    app.approvalId = approvalId
    store.approvals.unshift({
      id: approvalId,
      type: '申請',
      title: app.title,
      refNo: appNo,
      submitterId: store.currentUserId,
      submitter: store.currentUser.name,
      submittedAt: now.toISOString(),
      amount,
      route: route_,
      steps: ev?.steps,
      currentStep: 0,
      status: '待簽核',
      reason: summary + (files.value.length ? `；附件 ${files.value.join('、')}` : ''),
      history: [{ role: store.role, name: store.currentUser.name, action: '送出', at: now.toISOString() }],
    })
    store.todos.unshift({ id: `t-${now.getTime()}-app`, kind: '簽核', title: app.title, refNo: appNo, forRoles: [route_[0]!], forUserIds: ev?.steps[0]?.candidateIds, approvalId, createdAt: now.toISOString() })
    files.value.forEach((f) => store.addAttachment({ type: '其他', refNo: appNo, party: store.currentUser.name, fileName: f, sizeKb: 300 }))
  }
  applications.unshift(app)
  creating.value = false
  form.value = {}
  files.value = []
  ElMessage.success(c.noApproval ? `已預約 ${appNo}，已加入公務車行事曆` : `已送出 ${appNo}，路由：${route_.join(' → ')}`)
}
const statusTag: Record<string, string> = { 待簽核: 'amber', 已核准: 'olive', 已退回: 'red', 已預約: 'teal' }
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>行政申請</h1>
      </div>
      <div class="actions"><el-button type="primary" :icon="Plus" @click="openCreate">{{ conf.noApproval ? '新增預約' : '新增申請' }}</el-button></div>
    </div>

    <el-tabs v-model="tab" class="tabs">
      <el-tab-pane v-for="c in CONF" :key="c.slug" :label="c.type" :name="c.slug" />
    </el-tabs>
    <section class="panel">
      <table class="plain-table fixed">
        <colgroup><col class="c-no" /><col /><col class="c-who" /><col class="c-at" /><col class="c-amt" /><col class="c-st" /></colgroup>
        <thead><tr><th>單號</th><th>內容</th><th>申請人</th><th>時間</th><th class="num">金額</th><th>狀態</th></tr></thead>
        <tbody>
          <tr v-for="a in mine" :key="a.id">
            <td class="id">{{ a.appNo }}</td>
            <td>{{ a.title }}<div class="muted small">{{ Object.entries(a.fields).filter(([k]) => k !== 'kind' && k !== 'amount').map(([, v]) => v).filter(Boolean).join(' · ') }}</div></td>
            <td>{{ a.applicant }}</td>
            <td class="id">{{ dateTime(a.at) }}</td>
            <td class="num">{{ a.amount ? money(a.amount) : '—' }}</td>
            <td><span class="tag" :class="statusTag[a.status]">{{ a.status }}</span></td>
          </tr>
          <tr v-if="!mine.length"><td colspan="6" class="muted">還沒有{{ conf.noApproval ? '預約' : '申請' }}</td></tr>
        </tbody>
      </table>
    </section>

    <el-dialog v-model="creating" :title="dialogConf.noApproval ? '新增預約' : '新增申請'" width="640px">
      <el-form label-position="top">
        <el-form-item label="類型">
          <el-select v-model="dialogSlug" style="width: 100%"><el-option v-for="c in CONF" :key="c.slug" :value="c.slug" :label="c.type" /></el-select>
        </el-form-item>
        <div class="grid2">
          <el-form-item v-for="f in dialogConf.fields" :key="f.key" :label="f.label" :required="!!f.required" :class="{ full: f.width === 'full' }">
            <el-select v-if="f.type === 'select'" v-model="form[f.key]" style="width: 100%"><el-option v-for="o in f.options" :key="o" :value="o" :label="o" /></el-select>
            <el-date-picker v-else-if="f.type === 'date'" v-model="form[f.key]" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            <el-input-number v-else-if="f.type === 'number'" v-model="form[f.key]" :min="0" :step="100" style="width: 100%" />
            <el-input v-else-if="f.type === 'textarea'" v-model="form[f.key]" type="textarea" :rows="2" />
            <div v-else-if="f.type === 'file'" class="files">
              <el-button size="small" @click="mockFile">示範用：帶一個附件</el-button>
              <span v-for="x in files" :key="x" class="tag slate">{{ x }}</span>
            </div>
            <el-input v-else v-model="form[f.key]" />
          </el-form-item>
        </div>
      </el-form>
      <p v-if="!dialogConf.noApproval" class="muted small">簽核進度：{{ liveEval?.route.join(' → ') }}</p>
      <template #footer>
        <el-button @click="creating = false">取消</el-button>
        <el-button type="primary" @click="submit">{{ dialogConf.noApproval ? '預約' : '送出申請' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.fixed { table-layout: fixed; }
.c-no { width: 14%; }
.c-who { width: 10%; }
.c-at { width: 16%; }
.c-amt { width: 11%; }
.c-st { width: 9%; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.grid2 .full { grid-column: 1 / -1; }
.files { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.small { font-size: 12px; }
.tabs { margin-bottom: 4px; }
</style>
