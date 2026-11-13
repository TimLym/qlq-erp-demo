<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { dateTime } from '../../utils/format'
import ApprovalRoute from '../../components/ApprovalRoute.vue'
import ApprovalDrawer from '../../components/ApprovalDrawer.vue'
import DealDrawer from '../../components/DealDrawer.vue'
import SignoffTable from '../../components/SignoffTable.vue'
import AttachmentsBrowser from '../../components/AttachmentsBrowser.vue'
import { shipments, type Approval } from '../../mock/data'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const tab = ref<string>((route.meta.tab as string) ?? 'pending')
watch(() => route.meta.tab, (t) => (tab.value = (t as string) ?? 'pending'))
function onTab(name: string | number) {
  const map: Record<string, string> = { pending: '/approvals', mine: '/approvals/mine', history: '/approvals/history', signoff: '/approvals/signoff', files: '/approvals/files' }
  router.push(map[String(name)])
}

const openApproval = ref<string | null>((route.query.open as string | undefined) ?? null)
if (route.query.open) router.replace({ query: {} })
const openDeal = ref<string | null>(null)
/* 等待簽收的數量跟首頁的數字卡同一個算法 */
const scopedSo = computed(() => new Set(store.scopedOrders.map((o) => o.soNo)))
const signoffCount = computed(() => shipments.filter((s) => s.status === '已出貨' && scopedSo.value.has(s.soNo)).length)

/* 類型篩選只對前三個簽核頁簽有意義 */
const typeFilter = ref<string>('')
const filterable = computed(() => ['pending', 'mine', 'history'].includes(tab.value))
function filterType(list: Approval[]) {
  return typeFilter.value ? list.filter((a) => a.type === typeFilter.value) : list
}
const pending = computed(() => filterType(store.pendingForMe))
const mine = computed(() => filterType(store.submittedByMe).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)))
const history = computed(() =>
  filterType(store.approvals)
    .flatMap((a) => a.history.map((h) => ({ a, h })))
    .sort((x, y) => y.h.at.localeCompare(x.h.at)),
)

const typeTag: Record<string, string> = { 上單: 'teal', PO: 'slate', 預付: 'amber', 供應商建檔: 'olive', 品項參考成本: 'slate', 申請: 'slate' }
const statusTag: Record<string, string> = { 待簽核: 'amber', 已核准: 'olive', 已退回: 'red', 已收回: 'slate' }
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>簽核中心</h1>
      </div>
      <div v-if="filterable" class="actions">
        <el-select v-model="typeFilter" clearable placeholder="全部類型" style="width: 150px">
          <el-option value="上單" label="上單" />
          <el-option value="PO" label="PO" />
          <el-option value="預付" label="預付" />
          <el-option value="供應商建檔" label="供應商建檔" />
          <el-option value="品項參考成本" label="品項參考成本" />
          <el-option value="申請" label="行政申請" />
        </el-select>
      </div>
    </div>

    <el-tabs v-model="tab" @tab-change="onTab">
      <el-tab-pane name="pending">
        <template #label>我待簽核<span v-if="store.pendingForMe.length" class="count hot tab-count">{{ store.pendingForMe.length }}</span></template>
        <section class="panel">
          <p v-if="!pending.length" class="empty">目前沒有等你簽核的單據。</p>
          <table v-else class="plain-table rows approvals">
            <colgroup><col class="c-type" /><col class="c-title" /><col class="c-at" /><col class="c-route" /></colgroup>
            <thead>
              <tr><th>類型</th><th>標題</th><th>送出時間</th><th>簽核進度</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in pending" :key="a.id" @click="openApproval = a.id">
                <td><span class="tag" :class="typeTag[a.type]">{{ a.type }}</span></td>
                <td>
                  <div class="title">{{ a.title }}<span v-if="a.postHoc" class="tag red">事後追認</span><span v-for="f in a.flags ?? []" :key="f" class="tag amber">{{ f }}</span><span v-if="a.diff && a.type === '上單'" class="tag amber">重審</span><span v-if="a.diff && a.type === 'PO'" class="tag red">成本異動</span></div>
                  <div class="muted small"><span class="num">{{ a.refNo }}</span> · {{ a.submitter }}</div>
                </td>
                <td class="muted nowrap">{{ dateTime(a.submittedAt) }}</td>
                <td><ApprovalRoute :route="a.route" :current="a.currentStep" :status="a.status" /></td>
              </tr>
            </tbody>
          </table>
        </section>
      </el-tab-pane>

      <el-tab-pane name="mine" label="等待他人">
        <section class="panel">
          <p v-if="!mine.length" class="empty">你還沒有送出任何單據。</p>
          <table v-else class="plain-table rows approvals">
            <colgroup><col class="c-type" /><col class="c-title" /><col class="c-at" /><col class="c-route" /></colgroup>
            <thead>
              <tr><th>類型</th><th>標題</th><th>送出時間</th><th>簽核進度</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in mine" :key="a.id" @click="openApproval = a.id">
                <td><span class="tag" :class="typeTag[a.type]">{{ a.type }}</span></td>
                <td><div class="title">{{ a.title }}</div><div class="muted small num">{{ a.refNo }}</div></td>
                <td class="muted nowrap">{{ dateTime(a.submittedAt) }}</td>
                <td><div class="progress"><ApprovalRoute :route="a.route" :current="a.currentStep" :status="a.status" /><span v-if="a.status !== '待簽核'" class="tag" :class="statusTag[a.status]">{{ a.status }}</span></div></td>
              </tr>
            </tbody>
          </table>
        </section>
      </el-tab-pane>

      <el-tab-pane name="history" label="簽核歷程">
        <section class="panel">
          <table class="plain-table rows">
            <thead>
              <tr><th>時間</th><th>動作</th><th>人員</th><th>單據</th><th>備註</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in history" :key="i" @click="openApproval = r.a.id">
                <td class="muted id nowrap">{{ dateTime(r.h.at) }}</td>
                <td><span class="action" :class="{ reject: r.h.action === '退回' || r.h.action === '收回', back: r.h.action === '駁回' }">{{ r.h.action }}</span></td>
                <td>{{ r.h.name }}<span class="muted">（{{ r.h.role }}）</span></td>
                <td><span class="tag" :class="typeTag[r.a.type]">{{ r.a.type }}</span> {{ r.a.title }}</td>
                <td class="muted">{{ r.h.note ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </el-tab-pane>

      <el-tab-pane name="signoff">
        <template #label>等待簽收<span v-if="signoffCount" class="count tab-count">{{ signoffCount }}</span></template>
        <SignoffTable v-if="tab === 'signoff'" />
      </el-tab-pane>

      <el-tab-pane name="files" label="附件總覽">
        <AttachmentsBrowser v-if="tab === 'files'" />
      </el-tab-pane>
    </el-tabs>

    <ApprovalDrawer :approval-id="openApproval" @close="openApproval = null" @open-deal="(id) => { openApproval = null; openDeal = id }" />
    <DealDrawer :deal-id="openDeal" @close="openDeal = null" />
  </div>
</template>

<style scoped>
.tab-count {
  margin-left: 6px;
}

.rows tbody tr {
  cursor: pointer;
}

/* 我待簽核與等待他人共用同一組欄寬，切頁簽時欄位不會跳 */
.approvals {
  table-layout: fixed;
}

.approvals .c-type {
  width: 110px;
}

.approvals .c-at {
  width: 180px;
}

.approvals .c-route {
  width: 36%;
}

.title {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.small {
  font-size: 12px;
}

.nowrap {
  white-space: nowrap;
}

.progress {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action {
  font-weight: 500;
  color: var(--teal-ink);
}

.action.reject {
  color: var(--red);
}

.action.back {
  color: var(--amber);
}

.empty {
  padding: 28px 16px;
  color: var(--muted);
}
</style>
