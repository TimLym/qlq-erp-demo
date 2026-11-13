<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { quotes, stock, shipments, natureOf, addMonths, warrantyOf, type Order, type Shipment, type LineNature } from '../mock/data'
import { useAppStore } from '../stores/app'

const props = defineProps<{ order: Order | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'shipped', s: Shipment): void }>()
const store = useAppStore()
const open = computed({ get: () => !!props.order, set: (v) => { if (!v) emit('close') } })

const DIRECT = '原廠直寄（不經入庫）'
interface Pick { sku: string; name: string; need: number; batch: string; available: number; qty: number; unitCost: number; expires: string; hasLicense: boolean; nature: LineNature; months: number }
const picks = ref<Pick[]>([])
const direct = ref(false)
const note = ref('')
watch(
  () => props.order,
  (o) => {
    if (!o) return
    const q = quotes.find((x) => x.id === o.quoteId)
    const list: Pick[] = []
    /* 已出貨的量依料號扣掉，只建議剩下的 */
    const shippedLeft = new Map<string, number>()
    shipments.filter((sh) => sh.orderId === o.id).flatMap((sh) => sh.lines).forEach((l) => shippedLeft.set(l.sku, (shippedLeft.get(l.sku) ?? 0) + l.qty))
    q?.lines.filter((l) => l.vendor !== '自有工程').forEach((l) => {
      /* 先進先出：先用保留給這張 SO 的批次，不夠再用公司庫存 */
      const done = Math.min(shippedLeft.get(l.intSku) ?? 0, l.qty)
      shippedLeft.set(l.intSku, (shippedLeft.get(l.intSku) ?? 0) - done)
      let need = l.qty - done
      if (need <= 0) return
      const mine = stock.filter((s) => s.sku === l.intSku && s.reservedFor === o.soNo && s.reserved > 0).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
      const free = stock.filter((s) => s.sku === l.intSku && s.qty - s.reserved > 0).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
      for (const s of [...mine, ...free]) {
        if (need <= 0) break
        const avail = s.reservedFor === o.soNo ? s.reserved : s.qty - s.reserved
        const take = Math.min(avail, need)
        if (take <= 0) continue
        const nature = natureOf(l)
        const months = nature === '硬體' ? warrantyOf(l.intSku) : (l.months ?? 12)
        const isLicense = nature === '授權'
        list.push({ sku: l.intSku, name: l.extName, need: l.qty, batch: s.batch, available: avail, qty: take, unitCost: s.unitCost, expires: isLicense ? addMonths(new Date().toISOString().slice(0, 10), months) : '', hasLicense: isLicense, nature, months })
        need -= take
      }
      /* 授權直接由原廠寄給客戶，不經入庫（1113）：不扣庫存，成本用報價內部單價 */
      if (need > 0 && natureOf(l) === '授權') list.push({ sku: l.intSku, name: l.extName, need: l.qty, batch: DIRECT, available: need, qty: need, unitCost: l.unitCost ?? 0, expires: '', hasLicense: true, nature: '授權', months: l.months ?? 12 })
      else if (need > 0) list.push({ sku: l.intSku, name: l.extName, need: l.qty, batch: '（庫存不足）', available: 0, qty: 0, unitCost: 0, expires: '', hasLicense: false, nature: natureOf(l), months: 0 })
    })
    picks.value = list
    direct.value = false
    note.value = ''
  },
  { immediate: true },
)
const shortage = computed(() => picks.value.filter((p) => p.batch === '（庫存不足）'))
function confirm() {
  const o = props.order
  if (!o || shortage.value.length) return
  const ymd = new Date().toISOString().slice(0, 10)
  const shipNo = `S-${ymd.slice(0, 4)}-${ymd.slice(5, 7)}${ymd.slice(8, 10)}-${String(shipments.length + 1).padStart(3, '0')}`
  const lines: Shipment['lines'] = []
  picks.value.forEach((p) => {
    if (p.qty <= 0) return
    const s = stock.find((x) => x.batch === p.batch)
    /* 扣庫存：保留的先扣保留，再扣數量；原廠直寄的授權不經庫存 */
    if (s) {
      if (s.reservedFor === o.soNo) s.reserved -= p.qty
      s.qty -= p.qty
    }
    lines.push({ sku: p.sku, name: p.name, qty: p.qty, batch: p.batch, unitCost: p.unitCost })
    /* 授權：等工程上授權後確認實際起算日才有到期日；硬體：保固依料號月數，起日等驗收；維護／服務合約在 SO 成立時就產生 */
    if (p.hasLicense) o.licenses.push({ id: `lic-${Date.now()}-${o.licenses.length + 1}`, kind: '授權', sku: p.sku, name: p.name, qty: p.qty, months: p.months, expires: '—' })
    else if (p.nature === '硬體') o.licenses.push({ id: `lic-${Date.now()}-${o.licenses.length + 1}`, kind: '保固', sku: p.sku, name: `${p.name} 硬體保固`, qty: p.qty, months: p.months, expires: addMonths(ymd, p.months) })
  })
  const sh: Shipment = { id: `sh-${Date.now()}`, shipNo, soNo: o.soNo, orderId: o.id, customer: o.customer, at: ymd, by: store.currentUser.name, direct: direct.value, note: note.value.trim() || undefined, lines, status: '已出貨' }
  shipments.unshift(sh)
  /* 全部項次都出完才是「全部出貨」，否則停在「部分出貨」 */
  const needQty = (quotes.find((x) => x.id === o.quoteId)?.lines ?? []).filter((l) => l.vendor !== '自有工程').reduce((s, l) => s + l.qty, 0)
  const shippedQty = shipments.filter((s) => s.orderId === o.id).flatMap((s) => s.lines).reduce((s, l) => s + l.qty, 0)
  o.stageIndex = Math.max(o.stageIndex, shippedQty >= needQty ? 5 : 4)
  store.logOrder(o, '執行', `出貨單 ${shipNo} 建立${direct.value ? '（原廠直送）' : ''}，進入「${o.stageIndex === 5 ? '全部出貨' : '部分出貨'}」階段`)
  store.addAttachment({ type: '其他', refNo: o.soNo, party: o.customer, fileName: `${shipNo}-出貨單.pdf`, sizeKb: 180 })
  store.todos.unshift({ id: `t-${Date.now()}-sign`, kind: '簽收', title: `${o.customer} 出貨單 ${shipNo} 待客戶簽收`, refNo: o.soNo, forRoles: ['業務'], forUserIds: [store.users.find((u) => u.name === o.owner)?.id ?? store.currentUserId], route: '/sales/orders', createdAt: new Date().toISOString() })
  ElMessage.success(`出貨單 ${shipNo} 已建立，庫存已扣，${o.soNo} 進到「${o.stageIndex === 5 ? '全部出貨' : '部分出貨'}」；接著請客戶簽收`)
  emit('shipped', sh)
  emit('close')
}
</script>

<template>
  <el-dialog v-model="open" title="建立出貨單" width="900px">
    <template v-if="order">
      <p class="muted small">{{ order.soNo }} · {{ order.customer }}</p>
      <table class="plain-table">
        <thead><tr><th>品項</th><th>批次</th><th class="num">出貨</th><th>到期</th></tr></thead>
        <tbody>
          <tr v-for="(p, i) in picks" :key="i" :class="{ bad: p.batch === '（庫存不足）' }">
            <td>{{ p.name }}<div class="muted small">{{ p.sku }} · 需要 {{ p.need }}</div></td>
            <td class="id">{{ p.batch }}<div v-if="p.available" class="muted small">可用 {{ p.available }}</div></td>
            <td class="num"><el-input-number v-model="p.qty" :min="0" :max="p.available" :precision="0" :controls="false" size="small" class="n" /></td>
            <td><span v-if="p.hasLicense && p.qty > 0" class="muted small">授權 {{ p.months }} 個月，工程確認起算日</span><span v-else-if="p.nature === '硬體' && p.qty > 0" class="muted small">保固 {{ p.months }} 個月</span><span v-else class="muted small">—</span></td>
          </tr>
        </tbody>
      </table>
      <div class="opts">
        <el-checkbox v-model="direct">原廠直送客戶（形式上仍建進貨與出貨，庫存不經倉）</el-checkbox>
        <el-input v-model="note" size="small" placeholder="備註：例如分兩批、客戶指定收件人" style="width: 360px" />
      </div>
      <p v-if="shortage.length" class="problem">{{ shortage.map((s) => s.name).join('、') }} 庫存不足，請先在 PO 分配保留或等到貨</p>
    </template>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="!picks.some((p) => p.qty > 0) || shortage.length > 0" @click="confirm">建立出貨單並扣庫存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.n { width: 80px; }
.opts { display: flex; gap: 16px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
.bad td { color: var(--red); }
.problem { color: var(--red); font-size: 13px; margin: 8px 0 0; }
.small { font-size: 12px; }
</style>
