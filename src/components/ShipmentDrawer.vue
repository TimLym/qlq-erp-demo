<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Paperclip, CopyDocument, Promotion } from '@element-plus/icons-vue'
import { shipments, type Order, type Shipment } from '../mock/data'
import { useAppStore } from '../stores/app'
import { dateFull, dateTime } from '../utils/format'
import UploadDialog from './UploadDialog.vue'
import SignReceiptPreview from './SignReceiptPreview.vue'

/** shipment 有給就是「重新簽收」那一張（已簽收的也可以），沒給就是這張 SO 還沒簽的出貨單 */
const props = defineProps<{ order: Order | null; shipment?: Shipment | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'signed', orderId: string, method: string, file: string): void; (e: 'resigned', orderId: string, shipmentId: string, method: string, file: string): void }>()
const store = useAppStore()

const open = computed({
  get: () => !!props.order,
  set: (v) => {
    if (!v) emit('close')
  },
})

const method = ref<'ipad' | 'link' | 'scan'>('ipad')
const signer = ref('')
const signerTitle = ref('')
const uploading = ref(false)

const receipts = computed(() => (props.order ? store.attachments.filter((a) => a.type === '出貨簽收' && a.refNo === props.order!.soNo) : []))
const alreadySigned = computed(() => !!props.order && !pending.value.length && signedOnes.value.length > 0)
/* 這次要簽的：這張 SO 還沒簽收的出貨單；已簽收或還沒出貨就沒有簽收方式可選 */
const pending = computed(() => (props.order ? shipments.filter((s) => s.orderId === props.order!.id && s.status === '已出貨') : []))
const signedOnes = computed(() => (props.order ? shipments.filter((s) => s.orderId === props.order!.id && s.status === '已簽收') : []))
const targets = computed(() => (props.shipment ? [props.shipment] : pending.value))
/* 簽收紀錄點檔名預覽：找簽收檔是這個檔的出貨單，找不到就用最近一張已簽收的 */
const preview = ref<{ shipment: Shipment; file: string } | null>(null)
function previewOf(fileName: string) {
  const s = signedOnes.value.find((x) => x.signFile === fileName) ?? signedOnes.value[0]
  if (!s) return
  preview.value = { shipment: s, file: fileName }
}
const resigning = computed(() => !!props.shipment)
function finish(method: string, file: string) {
  if (!props.order) return
  if (props.shipment) emit('resigned', props.order.id, props.shipment.id, method, file)
  else emit('signed', props.order.id, method, file)
  emit('close')
}

/* 線上簽收連結：簽章 token、限時、一次有效 */
const link = ref('')
const linkExpires = ref('')
function makeLink() {
  const token = Array.from({ length: 24 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('')
  link.value = `${location.origin}${location.pathname}#/ext/sign/${props.order?.soNo ?? token}`
  const d = new Date(Date.now() + 72 * 3600 * 1000)
  linkExpires.value = dateFull(d.toISOString())
}
async function copyLink() {
  try {
    await navigator.clipboard.writeText(link.value)
    ElMessage.success('連結已複製，完成簽收後即失效')
  } catch {
    ElMessage.info('請手動複製連結')
  }
}

/* iPad 現場簽名：canvas 手寫 */
const canvas = ref<HTMLCanvasElement | null>(null)
const hasInk = ref(false)
let drawing = false
let last: { x: number; y: number } | null = null
function pos(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * canvas.value!.width, y: ((e.clientY - r.top) / r.height) * canvas.value!.height }
}
function down(e: PointerEvent) {
  drawing = true
  last = pos(e)
  canvas.value?.setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (!drawing || !canvas.value || !last) return
  const ctx = canvas.value.getContext('2d')!
  const p = pos(e)
  ctx.strokeStyle = '#16211b'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(last.x, last.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  last = p
  hasInk.value = true
}
function up() {
  drawing = false
  last = null
}
function clearPad() {
  const c = canvas.value
  if (!c) return
  c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
  hasInk.value = false
}
onBeforeUnmount(() => (drawing = false))

watch(
  () => [props.order, props.shipment],
  () => {
    method.value = 'ipad'
    signer.value = ''
    signerTitle.value = ''
    link.value = ''
    hasInk.value = false
  },
)

function confirmIpad() {
  if (!props.order) return
  if (!hasInk.value || !signer.value.trim()) {
    ElMessage.warning('請客戶簽名並填寫簽收人')
    return
  }
  const file = `${props.order.customer}-出貨簽收-iPad${resigning.value ? `-${Date.now().toString().slice(-4)}` : ''}.png`
  store.addAttachment({ type: '出貨簽收', refNo: props.order.soNo, party: props.order.customer, fileName: file, sizeKb: 640 })
  finish(`iPad 現場簽名，簽收人 ${signer.value}`, file)
}
function onScanned(fileName: string) {
  finish(`紙本掃描上傳 ${fileName}`, fileName)
}
</script>

<template>
  <el-drawer v-model="open" size="720px" :with-header="false" destroy-on-close>
    <div v-if="order" class="drawer">
      <header class="head">
        <div>
          <div class="eyebrow"><span class="id">{{ shipment ? shipment.shipNo : order.soNo }}</span><span class="tag" :class="resigning ? 'amber' : alreadySigned ? 'olive' : 'amber'">{{ resigning ? '重新簽收' : alreadySigned ? '已簽收' : '待簽收' }}</span></div>
          <h2>{{ resigning ? '重新簽收' : '出貨與簽收' }}<span class="dept">{{ order.customer }}</span></h2>
          <p class="muted">{{ order.product }}</p>
        </div>
        <el-button @click="emit('close')">關閉</el-button>
      </header>

      <div class="body">
        <section class="block">
          <table v-if="targets.length" class="plain-table">
            <thead><tr><th>內容</th><th class="num">數量</th></tr></thead>
            <tbody>
              <template v-for="s in targets" :key="s.id">
                <tr v-for="(l, i) in s.lines" :key="i">
                  <td>{{ l.name }}</td>
                  <td class="num">{{ l.qty }}</td>
                </tr>
              </template>
            </tbody>
          </table>
          <p v-else class="muted small">{{ signedOnes.length ? '出貨單已全部簽收。' : '尚未建立出貨單。' }}</p>
        </section>

        <section v-if="receipts.length" class="block">
          <h3>已有的簽收紀錄</h3>
          <ul class="receipts">
            <li v-for="r in receipts" :key="r.id">
              <a class="file" @click="previewOf(r.fileName)"><el-icon><Paperclip /></el-icon>{{ r.fileName }}</a>
              <span class="muted">{{ r.uploader }} · {{ dateTime(r.at) }}</span>
            </li>
          </ul>
        </section>

        <section v-if="targets.length || !resigning" class="block">
          <h3>簽收方式</h3>
          <el-radio-group v-model="method" class="methods">
            <el-radio-button value="ipad">iPad 現場簽名</el-radio-button>
            <el-radio-button value="link">線上簽收連結</el-radio-button>
            <el-radio-button value="scan">紙本掃描上傳</el-radio-button>
          </el-radio-group>

          <div v-if="method === 'ipad'" class="method">
            <div class="pad-wrap">
              <canvas ref="canvas" width="640" height="220" class="pad" @pointerdown="down" @pointermove="move" @pointerup="up" @pointerleave="up"></canvas>
              <span v-if="!hasInk" class="pad-hint">請在此簽名</span>
            </div>
            <div class="row">
              <el-input v-model="signer" placeholder="簽收人姓名" style="width: 200px" />
              <el-input v-model="signerTitle" placeholder="職稱" style="width: 200px" />
              <el-button text @click="clearPad">清除重簽</el-button>
            </div>
            <div class="actions"><el-button type="primary" @click="confirmIpad">確認簽收</el-button></div>
          </div>

          <div v-else-if="method === 'link'" class="method">
            <div v-if="!link" class="actions"><el-button type="primary" @click="makeLink">產生簽收連結</el-button></div>
            <template v-else>
              <div class="link-box">
                <code class="link">{{ link }}</code>
                <el-button size="small" :icon="CopyDocument" @click="copyLink">複製</el-button>
              </div>
              <p class="muted small">有效至 {{ linkExpires }}</p>
              <div class="actions">
                <el-button :icon="Promotion" @click="ElMessage.success(`已寄給 ${order.customer} 的聯絡人，簽收後會出現在你的通知`)">寄給客戶</el-button>
              </div>
            </template>
          </div>

          <div v-else class="method">
            <div class="actions"><el-button type="primary" @click="uploading = true">上傳簽收單</el-button></div>
          </div>
        </section>
      </div>
    </div>

    <SignReceiptPreview v-if="order" :shipment="preview?.shipment ?? null" :file="preview?.file" :customer="order.customer" :so-no="order.soNo" @close="preview = null" />
    <UploadDialog
      v-if="order"
      v-model="uploading"
      :ref-no="order.soNo"
      :party="order.customer"
      :types="['出貨簽收']"
      default-type="出貨簽收"
      title="上傳紙本簽收單"
      @uploaded="onScanned"
    />
  </el-drawer>
</template>

<style scoped>
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
  font-size: 20px;
}

.dept {
  margin-left: 8px;
  font-weight: 400;
  font-size: 15px;
  color: var(--muted);
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 24px 24px;
}

.block {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.block:last-child {
  border-bottom: none;
}

.block h3 {
  margin-bottom: 10px;
}

.receipts {
  list-style: none;
  margin: 0;
  padding: 0;
}

.receipts li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0;
  font-size: 13px;
}

.file {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--teal);
  cursor: pointer;
  text-decoration: underline dotted;
}

.file:hover {
  text-decoration: underline;
}

.methods {
  margin-bottom: 14px;
}

.method {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.small {
  font-size: 12px;
}

.pad-wrap {
  position: relative;
  border: 1px dashed var(--line-strong);
  border-radius: 6px;
  background: var(--surface);
}

.pad {
  display: block;
  width: 100%;
  height: 220px;
  touch-action: none;
  cursor: crosshair;
}

.pad-hint {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--muted);
  pointer-events: none;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.actions {
  display: flex;
  gap: 8px;
}

.link-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--paper);
  border-radius: 4px;
}

.link {
  flex: 1;
  font-size: 13px;
  word-break: break-all;
  background: transparent;
}
</style>
