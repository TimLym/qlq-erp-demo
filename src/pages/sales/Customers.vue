<script setup lang="ts">
import { deptWarningOf } from '../../utils/deptCheck'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { customers, deals, orders, isGuarantee, type Customer, type CustomerDept } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { money } from '../../utils/format'

const store = useAppStore()
const router = useRouter()
const q = ref('')
const type = ref<'' | '終端客戶' | '中間商'>('')
const canEdit = computed(() => ['業務', '業務主管', '執行長', '系統管理員'].includes(store.role) && store.can('/sales/customers', 'edit'))

const activeDeals = (c: Customer) => deals.filter((d) => d.customer === c.name && d.stage !== '未成交' && d.stage !== 'SO已成立')
/* 正式訂單：保證單（含作廢）不算 */
const orderCount = (c: Customer) => orders.filter((o) => o.customer === c.name && !isGuarantee(o)).length
const list = computed(() =>
  customers
    .filter((c) => !type.value || c.type === type.value)
    .filter((c) => {
      const s = q.value.trim().toLowerCase()
      if (!s) return true
      return c.name.toLowerCase().includes(s) || c.taxId.includes(s) || c.depts.some((d) => d.name.toLowerCase().includes(s) || (d.contact ?? '').toLowerCase().includes(s))
    }),
)

/* 抽屜 */
const openId = ref<string | null>(null)
const current = computed(() => customers.find((c) => c.id === openId.value))
const tab = ref<'basic' | 'depts' | 'deals'>('basic')
const editing = ref(false)
const form = ref({ name: '', taxId: '', industry: '', type: '終端客戶' as Customer['type'], address: '', owner: '', note: '', status: '正常' as Customer['status'], payDays: 30 })
function startEdit() {
  const c = current.value
  if (!c) return
  form.value = { name: c.name, taxId: c.taxId, industry: c.industry, type: c.type, address: c.address ?? '', owner: c.ownerId ?? '', note: c.note ?? '', status: c.status, payDays: c.payDays ?? 30 }
  editing.value = true
}
function saveEdit() {
  const c = current.value
  if (!c) return
  if (!form.value.name.trim() || !/^\d{8}$/.test(form.value.taxId)) {
    ElMessage.warning('客戶名稱必填，統一編號要 8 碼數字')
    return
  }
  const dup = customers.find((x) => x.id !== c.id && x.taxId === form.value.taxId)
  if (dup) {
    ElMessage.warning(`統一編號與「${dup.name}」重複`)
    return
  }
  const ownerUser = store.users.find((u) => u.id === form.value.owner)
  c.payDays = form.value.payDays
  Object.assign(c, { name: form.value.name.trim(), taxId: form.value.taxId, industry: form.value.industry.trim(), type: form.value.type, address: form.value.address.trim() || undefined, ownerId: ownerUser?.id, owner: ownerUser?.name, note: form.value.note.trim() || undefined, status: form.value.status, updatedAt: new Date().toISOString() })
  editing.value = false
  ElMessage.success('客戶資料已儲存並記錄異動')
}

/* 部門 */
const deptForm = ref<CustomerDept>({ name: '', contact: '', phone: '', email: '' })
const addingDept = ref(false)
const deptWarn = computed(() => deptWarningOf(deptForm.value.name, current.value?.depts.map((d) => d.name) ?? []))
function addDept() {
  const c = current.value
  if (!c) return
  const name = deptForm.value.name.trim()
  if (!name) {
    ElMessage.warning('部門名稱必填')
    return
  }
  if (c.depts.some((d) => d.name === name)) {
    ElMessage.warning('這個部門已經存在，請直接選用，避免同一部門多種寫法')
    return
  }
  c.depts.push({ name, contact: deptForm.value.contact?.trim() || undefined, phone: deptForm.value.phone?.trim() || undefined, email: deptForm.value.email?.trim() || undefined })
  deptForm.value = { name: '', contact: '', phone: '', email: '' }
  addingDept.value = false
  ElMessage.success(`已新增部門「${name}」，新增商機時可以選到`)
}

/* 新增客戶 */
const creating = ref(false)
const newForm = ref({ name: '', taxId: '', industry: '', type: '終端客戶' as Customer['type'], dept: '', contact: '' })
const taxDup = computed(() => (/^\d{8}$/.test(newForm.value.taxId) ? customers.find((c) => c.taxId === newForm.value.taxId) : undefined))
function createCustomer() {
  const f = newForm.value
  if (!f.name.trim() || !/^\d{8}$/.test(f.taxId) || !f.dept.trim()) {
    ElMessage.warning('客戶名稱、8 碼統一編號、第一個部門都要填')
    return
  }
  if (taxDup.value) return
  const c: Customer = {
    id: `c-${Date.now()}`,
    name: f.name.trim(),
    taxId: f.taxId,
    industry: f.industry.trim() || '未分類',
    type: f.type,
    depts: [{ name: f.dept.trim(), contact: f.contact.trim() || undefined }],
    ownerId: store.role === '業務' ? store.currentUserId : undefined,
    owner: store.role === '業務' ? store.currentUser.name : undefined,
    status: '正常',
    createdAt: new Date().toISOString(),
  }
  customers.unshift(c)
  creating.value = false
  newForm.value = { name: '', taxId: '', industry: '', type: '終端客戶', dept: '', contact: '' }
  ElMessage.success(`客戶「${c.name}」已建檔，可以在新增商機時選到`)
  openId.value = c.id
  tab.value = 'basic'
}

const customerDeals = computed(() => (current.value ? deals.filter((d) => d.customer === current.value!.name) : []))
const customerOrders = computed(() => (current.value ? orders.filter((o) => o.customer === current.value!.name && !isGuarantee(o)) : []))
const canDealPage = computed(() => store.can('/sales/pipeline'))
const canNewDeal = computed(() => store.can('/sales/pipeline', 'edit'))
function goDeal(id: string) {
  if (!canDealPage.value) return
  openId.value = null
  router.push({ path: '/sales/pipeline', query: { deal: id } })
}
function newDealFor(c: Customer) {
  openId.value = null
  router.push({ path: '/sales/pipeline', query: { new: '1', customer: c.name } })
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>客戶管理（CRM）</h1>
      </div>
      <div class="actions">
        <el-input v-model="q" placeholder="客戶、統編、部門、聯絡人" clearable style="width: 260px" />
        <el-button v-if="canEdit" type="primary" :icon="Plus" @click="creating = true">新增客戶</el-button>
      </div>
    </div>

    <div class="chips">
      <button type="button" class="chip" :class="{ on: type === '' }" @click="type = ''">全部<span class="count">{{ customers.length }}</span></button>
      <button type="button" class="chip" :class="{ on: type === '終端客戶' }" @click="type = '終端客戶'">終端客戶<span class="count">{{ customers.filter((c) => c.type === '終端客戶').length }}</span></button>
      <button type="button" class="chip" :class="{ on: type === '中間商' }" @click="type = '中間商'">中間商<span class="count">{{ customers.filter((c) => c.type === '中間商').length }}</span></button>
    </div>

    <section class="panel">
      <table class="plain-table">
        <thead><tr><th>客戶</th><th>統一編號</th><th>產業</th><th>類型</th><th>部門</th><th class="num">進行中商機</th><th class="num">訂單</th><th>負責業務</th><th>狀態</th></tr></thead>
        <tbody>
          <tr v-for="c in list" :key="c.id" class="row" @click="openId = c.id; tab = 'basic'; editing = false">
            <td><b>{{ c.name }}</b><div v-if="c.note" class="muted small">{{ c.note }}</div></td>
            <td class="id">{{ c.taxId }}</td>
            <td>{{ c.industry }}</td>
            <td><span class="tag" :class="c.type === '中間商' ? 'slate' : 'teal'">{{ c.type }}</span></td>
            <td class="depts">{{ c.depts.map((d) => d.name).join('、') }}</td>
            <td class="num">{{ activeDeals(c).length || '—' }}</td>
            <td class="num">{{ orderCount(c) || '—' }}</td>
            <td>{{ c.owner ?? '—' }}</td>
            <td><span class="tag" :class="c.status === '正常' ? 'olive' : 'red'">{{ c.status }}</span></td>
          </tr>
          <tr v-if="!list.length"><td colspan="9" class="muted">沒有符合的客戶</td></tr>
        </tbody>
      </table>
    </section>

    <el-drawer :model-value="!!current" direction="btt" size="100%" :with-header="false" destroy-on-close class="deal-drawer" modal-class="deal-drawer-mask" @update:model-value="(v: boolean) => { if (!v) openId = null }">
      <div v-if="current" class="drawer">
        <header class="head">
          <div>
            <div class="eyebrow"><span class="id">{{ current.taxId }}</span><span class="tag" :class="current.type === '中間商' ? 'slate' : 'teal'">{{ current.type }}</span><span v-if="current.status !== '正常'" class="tag red">{{ current.status }}</span></div>
            <h2>{{ current.name }}<span class="dept">{{ current.industry }}</span></h2>
            <p class="muted">{{ current.depts.length }} 個部門 · 進行中商機 {{ activeDeals(current).length }} · 訂單 {{ orderCount(current) }}</p>
          </div>
          <div class="head-actions">
            <el-button v-if="canEdit && canNewDeal && current.status === '正常'" type="primary" @click="newDealFor(current)">新增商機</el-button>
            <el-button @click="openId = null">關閉</el-button>
          </div>
        </header>
        <el-tabs v-model="tab" class="tabs">
          <el-tab-pane label="基本資料" name="basic">
            <div class="section">
              <div class="edit-bar">
                <el-button v-if="canEdit && !editing" size="small" @click="startEdit">編輯</el-button>
              </div>
              <el-form v-if="editing" label-position="top" class="edit-form">
                <div class="grid2">
                  <el-form-item label="客戶名稱" required><el-input v-model="form.name" /></el-form-item>
                  <el-form-item label="統一編號" required><el-input v-model="form.taxId" maxlength="8" /></el-form-item>
                  <el-form-item label="產業"><el-input v-model="form.industry" /></el-form-item>
                  <el-form-item label="類型">
                    <el-radio-group v-model="form.type">
                      <el-radio-button value="終端客戶">終端客戶</el-radio-button>
                      <el-radio-button value="中間商">中間商</el-radio-button>
                    </el-radio-group>
                  </el-form-item>
                  <el-form-item label="負責業務">
                    <el-select v-model="form.owner" clearable placeholder="未指定" style="width: 100%">
                      <el-option v-for="u in store.users.filter((u) => u.role === '業務' || u.role === '業務主管')" :key="u.id" :value="u.id" :label="u.name" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="狀態">
                    <el-radio-group v-model="form.status">
                      <el-radio-button value="正常">正常</el-radio-button>
                      <el-radio-button value="停用">停用</el-radio-button>
                    </el-radio-group>
                  </el-form-item>
                </div>
                <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
                <el-form-item label="付款條件">
                  <el-radio-group v-model="form.payDays">
                    <el-radio-button :value="30">月結 30 天</el-radio-button>
                    <el-radio-button :value="60">月結 60 天</el-radio-button>
                    <el-radio-button :value="120">月結 120 天</el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="備註"><el-input v-model="form.note" placeholder="例：採購流程需經總務處；付款習慣月結 60 天" /></el-form-item>
                <div class="edit-actions"><el-button @click="editing = false">取消</el-button><el-button type="primary" @click="saveEdit">儲存</el-button></div>
              </el-form>
              <dl v-else class="kv two">
                <dt>統一編號</dt><dd class="id">{{ current.taxId }}</dd>
                <dt>產業</dt><dd>{{ current.industry }}</dd>
                <dt>類型</dt><dd>{{ current.type }}</dd>
                <dt>負責業務</dt><dd>{{ current.owner ?? '未指定' }}</dd>
                <dt>地址</dt><dd>{{ current.address ?? '—' }}</dd>
                <dt>付款條件</dt><dd>{{ current.payDays ? `月結 ${current.payDays} 天` : '—' }}</dd>
                <dt>狀態</dt><dd>{{ current.status }}</dd>
                <dt>備註</dt><dd>{{ current.note ?? '—' }}</dd>
                <dt>建檔</dt><dd class="id">{{ current.createdAt.slice(0, 10) }}</dd>
              </dl>
            </div>
          </el-tab-pane>
          <el-tab-pane :label="`部門（${current.depts.length}）`" name="depts">
            <div class="section">
              <table class="plain-table">
                <thead><tr><th>部門</th><th>聯絡人</th><th>電話</th><th>Email</th><th class="num">進行中商機</th></tr></thead>
                <tbody>
                  <tr v-for="d in current.depts" :key="d.name">
                    <td><b>{{ d.name }}</b></td>
                    <td>{{ d.contact ?? '—' }}</td>
                    <td class="id">{{ d.phone ?? '—' }}</td>
                    <td>{{ d.email ?? '—' }}</td>
                    <td class="num">{{ activeDeals(current).filter((x) => x.customerDept === d.name).length || '—' }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="canEdit" class="dept-add">
                <el-button v-if="!addingDept" size="small" :icon="Plus" @click="addingDept = true">新增部門</el-button>
                <div v-else class="dept-form">
                  <el-input v-model="deptForm.name" size="small" placeholder="部門名稱 *" style="width: 160px" />
                  <el-input v-model="deptForm.contact" size="small" placeholder="聯絡人" style="width: 120px" />
                  <el-input v-model="deptForm.phone" size="small" placeholder="電話" style="width: 140px" />
                  <el-input v-model="deptForm.email" size="small" placeholder="Email" style="width: 180px" />
                  <el-button size="small" type="primary" @click="addDept">加入</el-button>
                  <el-button size="small" text @click="addingDept = false">取消</el-button>
                  <p v-if="deptWarn" class="dept-warn">{{ deptWarn }}</p>
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane :label="`商機與訂單（${customerDeals.length + customerOrders.length}）`" name="deals">
            <div class="section">
              <h4>商機</h4>
              <table class="plain-table">
                <thead><tr><th>編號</th><th>部門</th><th>需求</th><th>階段</th><th class="num">金額</th><th>業務</th></tr></thead>
                <tbody>
                  <tr v-for="d in customerDeals" :key="d.id" :class="{ row: canDealPage }" @click="goDeal(d.id)">
                    <td class="id">{{ d.dealNo }}</td><td>{{ d.customerDept }}</td><td>{{ d.product }}</td><td><span class="tag" :class="d.stage === 'SO已成立' ? 'olive' : d.stage === '未成交' ? 'red' : 'teal'">{{ d.stage }}</span></td><td class="num">{{ money(d.amount) }}</td><td>{{ d.owner }}</td>
                  </tr>
                  <tr v-if="!customerDeals.length"><td colspan="6" class="muted">還沒有商機</td></tr>
                </tbody>
              </table>
              <h4>訂單</h4>
              <table class="plain-table">
                <thead><tr><th>SO</th><th>內容</th><th class="num">金額</th><th>業務</th></tr></thead>
                <tbody>
                  <tr v-for="o in customerOrders" :key="o.id"><td class="id">{{ o.soNo }}</td><td>{{ o.product }}</td><td class="num">{{ money(o.amount) }}</td><td>{{ o.owner }}</td></tr>
                  <tr v-if="!customerOrders.length"><td colspan="4" class="muted">還沒有訂單</td></tr>
                </tbody>
              </table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <el-dialog v-model="creating" title="新增客戶" width="560px">
      <el-form label-position="top">
        <div class="grid2">
          <el-form-item label="客戶名稱" required><el-input v-model="newForm.name" placeholder="登記名稱" /></el-form-item>
          <el-form-item label="統一編號" required>
            <el-input v-model="newForm.taxId" maxlength="8" placeholder="8 碼" />
            <span v-if="taxDup" class="dup">統編與「{{ taxDup.name }}」重複，請直接使用該客戶</span>
          </el-form-item>
          <el-form-item label="產業"><el-input v-model="newForm.industry" placeholder="例：醫療、金融、製造" /></el-form-item>
          <el-form-item label="類型">
            <el-radio-group v-model="newForm.type">
              <el-radio-button value="終端客戶">終端客戶</el-radio-button>
              <el-radio-button value="中間商">中間商</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="第一個部門" required><el-input v-model="newForm.dept" placeholder="例：資訊部" /></el-form-item>
          <el-form-item label="聯絡人"><el-input v-model="newForm.contact" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="creating = false">取消</el-button>
        <el-button type="primary" :disabled="!!taxDup" @click="createCustomer">建檔</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dept-warn {
  flex-basis: 100%;
  margin: 4px 0 0;
  color: var(--amber);
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.chips {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.chip {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
}

.chip.on {
  border-color: var(--teal);
  color: var(--teal);
  font-weight: 600;
}

.chip .count {
  margin-left: 6px;
  color: var(--muted);
  font-size: 12px;
}

.row {
  cursor: pointer;
}

.depts {
  max-width: 260px;
}

.drawer {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  width: 100%;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 6px;
}

.head h2 {
  font-size: 20px;
}

.dept {
  margin-left: 8px;
  font-weight: 400;
  font-size: 15px;
  color: var(--muted);
}

.head-actions {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.tabs {
  padding: 0 24px;
}

.section {
  padding: 8px 0 20px;
}

.section h4 {
  margin: 14px 0 6px;
  font-size: 13px;
}

.edit-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.kv {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  margin: 0;
}

.kv.two {
  grid-template-columns: auto 1fr auto 1fr;
}

.kv dt {
  color: var(--muted);
  font-size: 13px;
}

.kv dd {
  margin: 0;
}

.dept-add {
  margin-top: 10px;
}

.dept-form {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.dup {
  color: var(--red);
  font-size: 12px;
}

.small {
  font-size: 12px;
}
</style>
