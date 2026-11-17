<script setup lang="ts">
import { computed } from 'vue'
import { Upload } from '@element-plus/icons-vue'
import { deals, orders, isGuarantee, type PurchaseOrder } from '../mock/data'
import { money } from '../utils/format'
import { useJump } from '../composables/useJump'

/** 採購單抽屜：從採購單列表點列、或流程紀錄點 PO 單號打開；簽回與到貨的動作由列表頁接 */
const props = defineProps<{ po: PurchaseOrder | null; isSales: boolean; canOperate: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'sign', po: PurchaseOrder): void; (e: 'receive', po: PurchaseOrder): void }>()
const open = computed({
  get: () => !!props.po,
  set: (v) => {
    if (!v) emit('close')
  },
})
const { goRef, canRef } = useJump()
const statusTag: Record<string, string> = { 待核准: 'amber', 已下單: 'teal', 已到貨: 'olive' }
/*
 * 關聯路徑（批次 6）：商機 →（保證單）→ PO → SO。預下單的 PO 先掛在商機或保證單上，
 * 上單核准（保證單轉正式）時自動改掛到 SO；作廢則轉為公司庫存。
 */
interface PathNode { kind: string; no: string; state: string; done: boolean; jump?: string }
const path = computed<PathNode[]>(() => {
  const po = props.po
  if (!po) return []
  const dealId = po.dealId ?? po.sourceDealId
  const d = deals.find((x) => x.id === dealId)
  const g = orders.find((o) => (po.sourceGuaranteeNo ? o.soNo === po.sourceGuaranteeNo : o.dealId === dealId && (isGuarantee(o) || o.guaranteeNo)))
  const so = po.soNo.startsWith('SO-') ? orders.find((o) => o.soNo === po.soNo) : undefined
  const list: PathNode[] = []
  if (d) list.push({ kind: '商機', no: d.dealNo, state: d.stage, done: true, jump: d.dealNo })
  if (g && isGuarantee(g)) list.push({ kind: '保證單', no: g.soNo, state: g.voidedAt ? '已作廢' : g.guaranteeReason ?? '', done: true, jump: g.soNo })
  else if (g?.guaranteeNo) list.push({ kind: '保證單', no: g.guaranteeNo, state: '已轉正式', done: true })
  list.push({ kind: po.preOrder ? 'PO（預下單）' : 'PO', no: po.poNo, state: po.status, done: po.status !== '待核准' })
  if (so) list.push({ kind: 'SO', no: so.soNo, state: '已關聯', done: true, jump: so.soNo })
  else if (po.soNo === '公司庫存') list.push({ kind: '公司庫存', no: '—', state: '案子未成立，轉為備貨', done: true })
  else list.push({ kind: 'SO', no: '—', state: '上單核准後自動關聯', done: false })
  return list
})
</script>

<template>
  <el-drawer v-model="open" size="860px" :with-header="false" destroy-on-close append-to-body>
    <div v-if="po" class="drawer">
      <header class="head">
        <div>
          <div class="eyebrow">
            <span class="id">{{ po.poNo }}</span>
            <span class="tag" :class="statusTag[po.status]">{{ po.status }}</span>
            <span v-if="po.preOrder" class="tag amber">預下單</span>
          </div>
          <h2>{{ po.vendor }}<span class="dept">{{ po.customer }}</span></h2>
          <p class="muted"><a v-if="canRef(po.soNo)" class="link" @click="goRef(po.soNo)">{{ po.soNo }}</a><template v-else>{{ po.soNo }}</template></p>
          <div class="meta">
            <span v-if="!isSales">金額 <b class="num">{{ money(po.amount) }}</b></span>
            <span v-if="!isSales">付款條件 <b>{{ po.terms }}</b><template v-if="po.prepaid">（已預付 {{ money(po.prepaid) }}）</template></span>
            <span>預計交期 <b class="id">{{ po.expectedAt ?? '—' }}</b></span>
          </div>
        </div>
        <el-button @click="emit('close')">關閉</el-button>
      </header>
      <div class="body">
        <section class="block">
          <h3>關聯</h3>
          <ol class="path">
            <li v-for="(n, i) in path" :key="i" :class="{ done: n.done }">
              <span class="k">{{ n.kind }}</span>
              <a v-if="n.jump && canRef(n.jump)" class="link id" @click="goRef(n.jump)">{{ n.no }}</a>
              <span v-else class="id">{{ n.no }}</span>
              <span class="muted small">{{ n.state }}</span>
            </li>
          </ol>
        </section>
        <section class="block">
          <div class="block-head">
            <h3>進度</h3>
            <div v-if="canOperate" class="actions-row">
              <el-button v-if="!po.signbackFile && po.status === '已下單'" size="small" :icon="Upload" @click="emit('sign', po)">上傳原廠簽回</el-button>
              <el-button v-if="po.status === '已下單'" size="small" type="primary" @click="emit('receive', po)">到貨入庫與分配</el-button>
            </div>
          </div>
          <ul class="steps">
            <li :class="{ ok: po.status !== '待核准' }"><b>財務核准</b><span class="muted">{{ po.status === '待核准' ? '簽核中' : '已核准' }}</span></li>
            <li :class="{ ok: po.signbackFile }"><b>原廠簽回</b><span class="muted">{{ po.signbackFile ?? '未上傳' }}</span></li>
            <li :class="{ ok: po.status === '已到貨' }"><b>到貨入庫</b><span class="muted">{{ po.status === '已到貨' ? po.receivedAt : po.receivedAt ? `部分到貨 ${po.receivedAt}` : '未到貨' }}</span></li>
          </ul>
        </section>
        <section class="block">
          <h3>項次</h3>
          <table class="plain-table inner">
            <thead><tr><th>#</th><th>品名 / 對內 SKU</th><th>原廠 SKU</th><th class="num">數量</th><th v-if="!isSales" class="num">單位成本</th><th v-if="!isSales" class="num">小計</th><th>到貨 / 分配</th></tr></thead>
            <tbody>
              <tr v-for="l in po.lines" :key="l.no">
                <td class="num">{{ l.no }}</td>
                <td>{{ l.extName }}<div class="muted small">{{ l.intSku }}</div></td>
                <td class="id">{{ l.vendorSku }}</td>
                <td class="num">{{ l.qty }}</td>
                <td v-if="!isSales" class="num">{{ money(l.unitCost) }}</td>
                <td v-if="!isSales" class="num">{{ money(l.qty * l.unitCost) }}</td>
                <td class="small">
                  <template v-if="l.received"><b>{{ l.received }}/{{ l.qty }}</b><div v-for="(a, i) in l.allocations" :key="i" class="muted"><template v-if="a.target.startsWith('SO-')">{{ a.qty }} → <a class="link" @click="goRef(a.target)">{{ a.target }}</a></template><template v-else>{{ a.qty }} → {{ a.target }}</template></div></template>
                  <span v-else class="muted">未到貨</span>
                </td>
              </tr>
              <tr v-if="!po.lines.length"><td colspan="7" class="muted">舊資料未附項次</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.path {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.path li {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 150px;
  padding: 8px 22px 8px 12px;
  border: 1px dashed var(--line);
  border-radius: 6px;
  background: var(--paper);
}

.path li.done {
  border-style: solid;
  border-color: var(--teal);
  background: var(--teal-soft);
}

.path li + li {
  margin-left: 22px;
}

.path li + li::before {
  content: '→';
  position: absolute;
  left: -18px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
}

.path .k {
  font-size: 12px;
  color: var(--muted);
}

.drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
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
  margin: 0;
  font-size: 20px;
}

.dept {
  margin-left: 8px;
  font-weight: 400;
  font-size: 15px;
  color: var(--muted);
}

.meta {
  display: flex;
  gap: 18px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--muted);
}

.meta b {
  color: var(--ink);
  margin-left: 4px;
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 24px;
}

.block {
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}

.block:last-child {
  border-bottom: none;
}

.block h3 {
  margin: 0 0 10px;
  font-size: 13px;
}

.block-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.block-head h3 {
  margin: 0;
}

.inner {
  font-size: 13px;
}

/* 進度：三步橫排 */
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  font-size: 13px;
}

.steps li {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.steps li::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--line-strong);
  flex: none;
  transform: translateY(1px);
}

.steps li.ok::before {
  background: var(--teal);
  border-color: var(--teal);
}

.steps .muted {
  font-size: 12px;
}

.actions-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.small {
  font-size: 12px;
}
</style>
