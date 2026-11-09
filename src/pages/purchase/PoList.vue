<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { purchaseOrders, deals, type PurchaseOrder } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { money } from '../../utils/format'
import PoCreateDialog from '../../components/PoCreateDialog.vue'
import ReceiveDialog from '../../components/ReceiveDialog.vue'
import UploadDialog from '../../components/UploadDialog.vue'
import PoDrawer from '../../components/PoDrawer.vue'
import { useJump } from '../../composables/useJump'

const route = useRoute()
const router = useRouter()
const { goRef } = useJump()
const creating = ref(false)
const presetSo = ref<string | undefined>()
const q = ref('')
/* 點列開抽屜（明細、進度、簽回與到貨動作都在抽屜裡） */
const detail = ref<PurchaseOrder | null>(null)
/* 篩選：全部、待核准、已下單、預下單、已到貨 */
const filter = ref<'all' | 'pending' | 'ordered' | 'pre' | 'received'>((route.query.filter as 'pre') === 'pre' ? 'pre' : 'all')
const receiving = ref<PurchaseOrder | null>(null)
const canOperate = computed(() => store.role === '採購' || store.role === '執行長')
onMounted(() => {
  const so = route.query.so as string | undefined
  if (so) {
    presetSo.value = so
    creating.value = true
    router.replace({ query: {} })
  }
  /* 從流程紀錄點 PO 單號過來：展開那張 PO */
  const po = route.query.po as string | undefined
  if (po) {
    filter.value = 'all'
    detail.value = purchaseOrders.find((p) => p.poNo === po) ?? null
    router.replace({ query: {} })
  }
})
function onCreated(poNos: string[]) {
  detail.value = purchaseOrders.find((p) => p.poNo === poNos[0]) ?? null
}

/* 原廠簽回 */
const signing = ref<PurchaseOrder | null>(null)
function onSigned(fileName: string) {
  if (signing.value) signing.value.signbackFile = fileName
  signing.value = null
}

/* 到貨：開「到貨入庫與分配」對話框，數量分給 SO 或公司庫存 */
function receive(po: PurchaseOrder) {
  receiving.value = po
}
const store = useAppStore()
/* 業務只看自己訂單（或自己預下單商機）的 PO，且只能看；採購與財務看全部 */
const isSales = computed(() => store.role === '業務')
const visible = computed(() => {
  if (!isSales.value) return purchaseOrders
  const mySo = new Set(store.scopedOrders.map((o) => o.soNo))
  const myDealNo = new Set(deals.filter((d) => d.ownerId === store.currentUserId).map((d) => d.dealNo))
  return purchaseOrders.filter((p) => mySo.has(p.soNo) || (p.soNo.startsWith('預下單 ') && myDealNo.has(p.soNo.replace('預下單 ', ''))))
})
const filtered = computed(() =>
  visible.value.filter((p) => {
    const k = q.value.trim()
    if (k && ![p.poNo, p.vendor, p.soNo, p.customer].some((x) => x.includes(k))) return false
    if (filter.value === 'pending') return p.status === '待核准'
    if (filter.value === 'ordered') return p.status === '已下單'
    if (filter.value === 'pre') return !!p.preOrder
    if (filter.value === 'received') return p.status === '已到貨'
    return true
  }),
)
const countOf = (f: typeof filter.value) => (f === 'all' ? visible.value.length : visible.value.filter((p) => (f === 'pending' ? p.status === '待核准' : f === 'ordered' ? p.status === '已下單' : f === 'pre' ? !!p.preOrder : p.status === '已到貨')).length)

const statusTag: Record<string, string> = { 待核准: 'amber', 已下單: 'teal', 已到貨: 'olive' }
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>採購單（PO）</h1>
      </div>
      <div class="actions">
        <el-input v-model="q" placeholder="PO 編號、供應商、SO、客戶" clearable style="width: 260px" />
        <el-button v-if="canOperate" type="primary" @click="presetSo = undefined; creating = true">建立 PO</el-button>
      </div>
    </div>
    <div class="chips">
      <button type="button" class="chip" :class="{ on: filter === 'all' }" @click="filter = 'all'">全部<span class="count">{{ countOf('all') }}</span></button>
      <button type="button" class="chip" :class="{ on: filter === 'pending' }" @click="filter = 'pending'">待核准<span class="count">{{ countOf('pending') }}</span></button>
      <button type="button" class="chip" :class="{ on: filter === 'ordered' }" @click="filter = 'ordered'">已下單<span class="count">{{ countOf('ordered') }}</span></button>
      <button type="button" class="chip" :class="{ on: filter === 'pre' }" @click="filter = 'pre'">預下單<span class="count">{{ countOf('pre') }}</span></button>
      <button type="button" class="chip" :class="{ on: filter === 'received' }" @click="filter = 'received'">已到貨<span class="count">{{ countOf('received') }}</span></button>
    </div>
    <section class="panel">
      <table class="plain-table">
        <thead>
          <tr><th>PO 編號</th><th>供應商</th><th>對應 SO</th><th>客戶</th><th class="num">金額</th><th>付款條件</th><th>預計交期</th><th>狀態</th></tr>
        </thead>
        <tbody>
          <template v-for="p in filtered" :key="p.id">
            <tr class="row" :class="{ open: detail?.id === p.id }" @click="detail = p">
              <td class="id">{{ p.poNo }}<span v-if="p.preOrder" class="tag amber">預下單</span></td>
              <td>{{ p.vendor }}</td>
              <td class="id"><a class="link" @click.stop="goRef(p.soNo)">{{ p.soNo }}</a></td>
              <td>{{ p.customer }}</td>
              <td class="num">{{ isSales ? '—' : money(p.amount) }}</td>
              <td>{{ isSales ? '—' : p.terms }}<div v-if="p.prepaid && !isSales" class="muted small">已預付 {{ money(p.prepaid) }}</div></td>
              <td class="id">{{ p.expectedAt ?? '—' }}</td>
              <td><span class="tag" :class="statusTag[p.status]">{{ p.status }}</span></td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>
    <PoDrawer :po="detail" :is-sales="isSales" :can-operate="canOperate" @close="detail = null" @sign="(p: PurchaseOrder) => (signing = p)" @receive="receive" />
    <PoCreateDialog v-model="creating" :so-no="presetSo" @created="onCreated" />
    <ReceiveDialog :po="receiving" @close="receiving = null" />
    <UploadDialog
      v-if="signing"
      :model-value="!!signing"
      :ref-no="signing.poNo"
      :party="signing.vendor"
      :types="['廠商簽回']"
      default-type="廠商簽回"
      title="上傳原廠簽回的 PO"
      @update:model-value="(v: boolean) => { if (!v) signing = null }"
      @uploaded="onSigned"
    />
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
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

.row.open td {
  background: var(--paper-strong, var(--surface));
}

.small {
  font-size: 12px;
}
</style>
