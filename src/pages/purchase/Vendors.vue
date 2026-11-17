<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { vendors, quotes, purchaseOrders, type Vendor } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { money } from '../../utils/format'
import { evaluate } from '../../mock/routing'

const store = useAppStore()
const q = ref('')
const status = ref<'' | Vendor['status']>('')
const canApply = computed(() => ['業務', '業務主管', '採購', '採購主管', '執行長'].includes(store.role) && store.can('/purchase/vendors', 'edit'))
const canEdit = computed(() => ['採購', '採購主管', '執行長'].includes(store.role) && store.can('/purchase/vendors', 'edit'))
const seesBank = computed(() => ['採購', '財務主管', '會計', '執行長'].includes(store.role))

const list = computed(() =>
  vendors
    .filter((v) => !status.value || v.status === status.value)
    .filter((v) => {
      const s = q.value.trim().toLowerCase()
      return !s || v.name.toLowerCase().includes(s) || v.taxId.includes(s) || (v.products ?? '').toLowerCase().includes(s)
    }),
)
const poCount = (v: Vendor) => purchaseOrders.filter((p) => p.vendor === v.name).length
const quoteCount = (v: Vendor) => quotes.filter((qq) => qq.lines.some((l) => l.vendor === v.name)).length
const poTotal = (v: Vendor) => purchaseOrders.filter((p) => p.vendor === v.name && p.status !== '待核准').reduce((s, p) => s + p.amount, 0)

/* 抽屜 */
const openId = ref<string | null>(null)
const current = computed(() => vendors.find((v) => v.id === openId.value))
const editing = ref(false)
const form = ref({ contact: '', phone: '', email: '', terms: '', products: '', note: '', bankName: '', account: '' })
function startEdit() {
  const v = current.value
  if (!v) return
  form.value = { contact: v.contact ?? '', phone: v.phone ?? '', email: v.email ?? '', terms: v.terms, products: v.products ?? '', note: v.note ?? '', bankName: v.bank?.bankName ?? '', account: '' }
  editing.value = true
}
function saveEdit() {
  const v = current.value
  if (!v) return
  const bankChanged = form.value.account.trim() !== '' || form.value.bankName !== (v.bank?.bankName ?? '')
  Object.assign(v, { contact: form.value.contact.trim() || undefined, phone: form.value.phone.trim() || undefined, email: form.value.email.trim() || undefined, terms: form.value.terms, products: form.value.products.trim() || undefined, note: form.value.note.trim() || undefined })
  if (bankChanged) {
    /* 銀行資料變更須重審：帳號只存遮罩，走會計 → 採購 → 執行長 */
    const masked = form.value.account.trim() ? `${form.value.account.trim().slice(0, 3)}***${form.value.account.trim().slice(-3)}` : v.bank?.accountMasked ?? ''
    v.pendingBank = { bankName: form.value.bankName, accountMasked: masked }
    submitReview(v, `${v.name} 銀行資料變更`, `銀行 ${form.value.bankName} 帳號 ${masked}，由 ${store.currentUser.name} 提出`)
    ElMessage.info('銀行資料變更已送審（會計 → 採購 → 執行長），核准前付款仍用原帳號')
  } else {
    ElMessage.success('供應商資料已儲存並記錄異動')
  }
  editing.value = false
}
function submitReview(v: Vendor, title: string, reason: string) {
  const now = new Date()
  const approvalId = `a-${now.getTime()}-vd`
  v.approvalId = approvalId
  const ev = evaluate('供應商建檔', { applicantId: store.currentUserId, facts: { bankChange: title.includes('銀行'), overseas: false } })
  store.approvals.unshift({
    id: approvalId,
    type: '供應商建檔',
    title,
    refNo: v.vendorNo,
    submitterId: store.currentUserId,
    submitter: store.currentUser.name,
    submittedAt: now.toISOString(),
    amount: 0,
    route: ev.route,
    steps: ev.steps,
    flags: title.includes('銀行') ? ['銀行帳號變更'] : undefined,
    currentStep: 0,
    status: '待簽核',
    reason,
    history: [{ role: store.role, name: store.currentUser.name, action: '送出', at: now.toISOString() }],
  })
  store.todos.unshift({ id: `t-${now.getTime()}-vd`, kind: '簽核', title, refNo: v.vendorNo, forRoles: [ev.route[0]!], forUserIds: ev.steps[0]?.candidateIds, approvalId, createdAt: now.toISOString() })
}

/* 建檔申請：業務或採購發起，供應商透過一次性連結填資料（Demo 直接填） */
const applying = ref(false)
const apply = ref({ name: '', taxId: '', contact: '', phone: '', email: '', terms: 'T/T 30 天', products: '', bankName: '', account: '', urgent: false })
const taxDup = computed(() => (/^\d{8}$/.test(apply.value.taxId) ? vendors.find((v) => v.taxId === apply.value.taxId) : undefined))
function sendApply() {
  const f = apply.value
  if (!f.name.trim() || !/^\d{8}$/.test(f.taxId)) {
    ElMessage.warning('供應商名稱與 8 碼統一編號必填')
    return
  }
  if (taxDup.value) return
  const now = new Date()
  const seq = vendors.length + 11
  const v: Vendor = {
    id: `v-${now.getTime()}`,
    vendorNo: `V-${now.getFullYear()}-${String(seq).padStart(4, '0')}`,
    name: f.name.trim(),
    taxId: f.taxId,
    contact: f.contact.trim() || undefined,
    phone: f.phone.trim() || undefined,
    email: f.email.trim() || undefined,
    terms: f.terms,
    products: f.products.trim() || undefined,
    bank: f.account.trim() ? { bankName: f.bankName.trim(), accountMasked: `${f.account.trim().slice(0, 3)}***${f.account.trim().slice(-3)}` } : undefined,
    status: '非正式',
    appliedBy: store.currentUser.name,
    appliedAt: now.toISOString(),
    note: f.urgent ? '緊急案：建檔核准前可先報價，不可建 PO 與付款' : undefined,
  }
  vendors.unshift(v)
  submitReview(v, `新供應商：${v.name}`, `${v.products ?? '未填產品線'} · ${v.terms}${v.bank ? ` · ${v.bank.bankName} ${v.bank.accountMasked}` : ' · 銀行資料待供應商填寫'}`)
  applying.value = false
  apply.value = { name: '', taxId: '', contact: '', phone: '', email: '', terms: 'T/T 30 天', products: '', bankName: '', account: '', urgent: false }
  ElMessage.success(`已送建檔審核（會計 → 採購 → 執行長）。核准前為非正式供應商：報價單可以選，建 PO 與付款不行。`)
  openId.value = v.id
}
const statusTag: Record<string, string> = { 正式: 'olive', 非正式: 'amber', 停用: 'red' }
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>供應商主檔</h1>
      </div>
      <div class="actions">
        <el-input v-model="q" placeholder="名稱、統編、產品線" clearable style="width: 240px" />
        <el-button v-if="canApply" type="primary" :icon="Plus" @click="applying = true">供應商建檔申請</el-button>
      </div>
    </div>

    <div class="chips">
      <button type="button" class="chip" :class="{ on: status === '' }" @click="status = ''">全部<span class="count">{{ vendors.length }}</span></button>
      <button v-for="s in ['正式', '非正式', '停用'] as const" :key="s" type="button" class="chip" :class="{ on: status === s }" @click="status = s">{{ s }}<span class="count">{{ vendors.filter((v) => v.status === s).length }}</span></button>
    </div>

    <section class="panel">
      <table class="plain-table">
        <thead><tr><th>供應商</th><th>統一編號</th><th>產品線</th><th>付款條件</th><th class="num">報價單引用</th><th class="num">PO</th><th v-if="seesBank" class="num">累計採購</th><th>狀態</th></tr></thead>
        <tbody>
          <tr v-for="v in list" :key="v.id" class="row" @click="openId = v.id; editing = false">
            <td><b>{{ v.name }}</b><div class="muted small">{{ v.vendorNo }}{{ v.contact ? ` · ${v.contact}` : '' }}</div></td>
            <td class="id">{{ v.taxId }}</td>
            <td>{{ v.products ?? '—' }}</td>
            <td>{{ v.terms }}</td>
            <td class="num">{{ quoteCount(v) || '—' }}</td>
            <td class="num">{{ poCount(v) || '—' }}</td>
            <td v-if="seesBank" class="num">{{ poTotal(v) ? money(poTotal(v)) : '—' }}</td>
            <td><span class="tag" :class="statusTag[v.status]">{{ v.status }}</span><span v-if="v.pendingBank" class="tag amber">銀行變更審核中</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <el-drawer :model-value="!!current" size="720px" :with-header="false" destroy-on-close @update:model-value="(v: boolean) => { if (!v) openId = null }">
      <div v-if="current" class="drawer">
        <header class="head">
          <div>
            <div class="eyebrow"><span class="id">{{ current.vendorNo }}</span><span class="tag" :class="statusTag[current.status]">{{ current.status }}</span><span v-if="current.pendingBank" class="tag amber">銀行變更審核中</span></div>
            <h2>{{ current.name }}<span class="dept">{{ current.taxId }}</span></h2>
            <p class="muted">{{ current.products ?? '產品線未填' }} · {{ current.terms }}</p>
          </div>
          <div class="head-actions">
            <el-button v-if="canEdit && !editing" @click="startEdit">編輯</el-button>
            <el-button @click="openId = null">關閉</el-button>
          </div>
        </header>
        <div class="body">
          <p v-if="current.status === '非正式'" class="notice">非正式供應商：建檔審核中（{{ current.appliedBy }} 於 {{ current.appliedAt?.slice(0, 10) }} 提出）。報價單可以選，建 PO 與付款要等核准。</p>
          <el-form v-if="editing" label-position="top" class="edit-form">
            <div class="grid2">
              <el-form-item label="聯絡人"><el-input v-model="form.contact" /></el-form-item>
              <el-form-item label="電話"><el-input v-model="form.phone" /></el-form-item>
              <el-form-item label="Email"><el-input v-model="form.email" /></el-form-item>
              <el-form-item label="付款條件">
                <el-select v-model="form.terms" style="width: 100%">
                  <el-option v-for="t in ['T/T 30 天', 'T/T 45 天', '月結 30 天', '月結 60 天', '分期：30% / 70%', '預付 100%']" :key="t" :value="t" :label="t" />
                </el-select>
              </el-form-item>
              <el-form-item label="產品線"><el-input v-model="form.products" /></el-form-item>
              <el-form-item label="備註"><el-input v-model="form.note" /></el-form-item>
              <el-form-item label="銀行"><el-input v-model="form.bankName" placeholder="改了會送重審" /></el-form-item>
              <el-form-item label="帳號（只存遮罩）"><el-input v-model="form.account" placeholder="留空代表不變" /></el-form-item>
            </div>
            <div class="edit-actions"><el-button @click="editing = false">取消</el-button><el-button type="primary" @click="saveEdit">儲存</el-button></div>
          </el-form>
          <dl v-else class="kv two">
            <dt>聯絡人</dt><dd>{{ current.contact ?? '—' }}</dd>
            <dt>電話</dt><dd class="id">{{ current.phone ?? '—' }}</dd>
            <dt>Email</dt><dd>{{ current.email ?? '—' }}</dd>
            <dt>付款條件</dt><dd>{{ current.terms }}</dd>
            <dt>產品線</dt><dd>{{ current.products ?? '—' }}</dd>
            <dt>備註</dt><dd>{{ current.note ?? '—' }}</dd>
            <template v-if="seesBank">
              <dt>銀行</dt><dd>{{ current.bank ? `${current.bank.bankName} ${current.bank.accountMasked}` : '待供應商填寫' }}</dd>
              <dt>變更中</dt><dd>{{ current.pendingBank ? `${current.pendingBank.bankName} ${current.pendingBank.accountMasked}（審核中）` : '—' }}</dd>
            </template>
            <dt>報價單引用</dt><dd class="num">{{ quoteCount(current) }} 版</dd>
            <dt>PO</dt><dd class="num">{{ poCount(current) }} 張{{ seesBank && poTotal(current) ? `，累計 ${money(poTotal(current))}` : '' }}</dd>
          </dl>
        </div>
      </div>
    </el-drawer>

    <el-dialog v-model="applying" title="供應商建檔申請" width="600px">
      <el-form label-position="top">
        <div class="grid2">
          <el-form-item label="供應商名稱" required><el-input v-model="apply.name" /></el-form-item>
          <el-form-item label="統一編號" required><el-input v-model="apply.taxId" maxlength="8" /><span v-if="taxDup" class="dup">統編與「{{ taxDup.name }}」重複</span></el-form-item>
          <el-form-item label="聯絡人"><el-input v-model="apply.contact" /></el-form-item>
          <el-form-item label="電話"><el-input v-model="apply.phone" /></el-form-item>
          <el-form-item label="Email"><el-input v-model="apply.email" /></el-form-item>
          <el-form-item label="付款條件">
            <el-select v-model="apply.terms" style="width: 100%">
              <el-option v-for="t in ['T/T 30 天', 'T/T 45 天', '月結 30 天', '月結 60 天', '預付 100%']" :key="t" :value="t" :label="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="產品線"><el-input v-model="apply.products" placeholder="例：CrowdStrike、SentinelOne" /></el-form-item>
          <el-form-item label="銀行 / 帳號（只存遮罩）"><div class="bank"><el-input v-model="apply.bankName" placeholder="銀行" style="width: 45%" /><el-input v-model="apply.account" placeholder="帳號" /></div></el-form-item>
        </div>
        <el-checkbox v-model="apply.urgent">緊急案：核准前先以非正式供應商報價（不可建 PO、不可付款）</el-checkbox>
      </el-form>
      <template #footer>
        <el-button @click="applying = false">取消</el-button>
        <el-button type="primary" :disabled="!!taxDup" @click="sendApply">送建檔審核</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.actions { display: flex; gap: 8px; align-items: center; }
.chips { display: flex; gap: 8px; margin-bottom: 12px; }
.chip { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 4px 12px; font-size: 13px; cursor: pointer; }
.chip.on { border-color: var(--teal); color: var(--teal); font-weight: 600; }
.chip .count { margin-left: 6px; color: var(--muted); font-size: 12px; }
.row { cursor: pointer; }
.drawer { display: flex; flex-direction: column; height: 100%; }
.head { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px 14px; border-bottom: 1px solid var(--line); }
.eyebrow { display: flex; gap: 8px; align-items: center; color: var(--muted); font-size: 13px; margin-bottom: 6px; }
.head h2 { font-size: 20px; }
.dept { margin-left: 8px; font-weight: 400; font-size: 15px; color: var(--muted); }
.head-actions { display: flex; gap: 8px; }
.body { padding: 16px 24px; }
.notice { padding: 10px 12px; border-radius: 6px; background: var(--amber-soft); color: var(--amber); font-size: 13px; margin: 0 0 14px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.edit-actions { display: flex; justify-content: flex-end; gap: 8px; }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin: 0; }
.kv.two { grid-template-columns: auto 1fr auto 1fr; }
.kv dt { color: var(--muted); font-size: 13px; }
.kv dd { margin: 0; }
.bank { display: flex; gap: 6px; width: 100%; }
.dup { color: var(--red); font-size: 12px; }
.small { font-size: 12px; }
</style>
