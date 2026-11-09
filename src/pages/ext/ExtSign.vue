<script setup lang="ts">
import { computed, ref } from 'vue'
import { dateTime } from '../../utils/format'
import { useRoute } from 'vue-router'
import { orders, shipments } from '../../mock/data'
import { useAppStore } from '../../stores/app'

const route = useRoute()
const store = useAppStore()
const soNo = computed(() => String(route.params.token ?? ''))
const order = computed(() => orders.find((o) => o.soNo === soNo.value))
const shipment = computed(() => shipments.find((s) => s.soNo === soNo.value && s.status === '已出貨'))
const done = ref(false)
const signer = ref('')
const canvas = ref<HTMLCanvasElement | null>(null)
const hasInk = ref(false)
let drawing = false
let last: { x: number; y: number } | null = null
function pos(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * canvas.value!.width, y: ((e.clientY - r.top) / r.height) * canvas.value!.height }
}
function down(e: PointerEvent) { drawing = true; last = pos(e); canvas.value?.setPointerCapture(e.pointerId) }
function move(e: PointerEvent) {
  if (!drawing || !canvas.value || !last) return
  const ctx = canvas.value.getContext('2d')!
  const p = pos(e)
  ctx.strokeStyle = '#16211b'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke()
  last = p; hasInk.value = true
}
function up() { drawing = false; last = null }
function clear() { canvas.value?.getContext('2d')!.clearRect(0, 0, canvas.value!.width, canvas.value!.height); hasInk.value = false }
function confirm() {
  const o = order.value
  if (!o || !hasInk.value || !signer.value.trim()) return
  const file = `${o.customer}-線上簽收-${signer.value.trim()}.png`
  store.addAttachment({ type: '出貨簽收', refNo: o.soNo, party: o.customer, fileName: file, sizeKb: 520 })
  store.signOff(o, `線上簽收，${signer.value.trim()}`, signer.value.trim(), file)
  done.value = true
}
const items = computed(() => (shipment.value ? shipment.value.lines : order.value ? (order.value.licenses.length ? order.value.licenses.map((l) => ({ name: l.name, qty: l.qty })) : [{ name: order.value.product, qty: 1 }]) : []))
</script>

<template>
  <div class="ext">
    <div class="card">
      <div class="brand">銓立光科技 · 出貨簽收</div>
      <template v-if="!order">
        <div class="bad">✕ 連結無效或已使用</div>
        <p class="muted">這個簽收連結限用一次，完成後即失效。請聯絡您的業務窗口重新取得。</p>
      </template>
      <template v-else-if="done">
        <div class="ok">✓ 簽收完成，謝謝</div>
        <p class="muted">{{ order.customer }} · {{ order.soNo }} 已於 {{ dateTime(new Date().toISOString()) }} 由 {{ signer }} 簽收，業務已收到通知。您可以關閉此頁。</p>
      </template>
      <template v-else>
        <h2>{{ order.customer }}</h2>
        <p class="muted">請確認以下品項已收到，並在下方簽名。此連結限用一次，{{ soNo }}。</p>
        <table>
          <thead><tr><th>品項</th><th>數量</th></tr></thead>
          <tbody><tr v-for="(l, i) in items" :key="i"><td>{{ l.name }}</td><td>{{ l.qty }}</td></tr></tbody>
        </table>
        <div class="pad-wrap">
          <canvas ref="canvas" width="640" height="200" class="pad" @pointerdown="down" @pointermove="move" @pointerup="up" @pointerleave="up"></canvas>
          <span v-if="!hasInk" class="hint">請在此簽名</span>
        </div>
        <div class="row">
          <input v-model="signer" placeholder="簽收人姓名" />
          <button type="button" class="ghost" @click="clear">清除</button>
          <button type="button" class="primary" :disabled="!hasInk || !signer.trim()" @click="confirm">確認簽收</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ext { min-height: 100vh; display: grid; place-items: center; background: #eef2f1; padding: 24px; font-family: 'Noto Sans TC', system-ui, sans-serif; }
.card { background: #fff; border-radius: 12px; padding: 28px 32px; max-width: 560px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,.08); color: #16211b; }
.brand { font-size: 13px; color: #5d6b66; margin-bottom: 10px; }
h2 { margin: 0 0 4px; font-size: 20px; }
.ok { font-size: 20px; font-weight: 700; color: #0f766e; margin-bottom: 10px; }
.bad { font-size: 20px; font-weight: 700; color: #b3261e; margin-bottom: 10px; }
.muted { color: #5d6b66; font-size: 13px; margin: 0 0 12px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 14px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #d9e0de; }
.id { font-variant-numeric: tabular-nums; }
.pad-wrap { position: relative; border: 1px dashed #9aa39c; border-radius: 6px; }
.pad { display: block; width: 100%; height: 200px; touch-action: none; cursor: crosshair; }
.hint { position: absolute; inset: 0; display: grid; place-items: center; color: #9aa39c; pointer-events: none; }
.row { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
input { flex: 1; padding: 8px 10px; border: 1px solid #d9e0de; border-radius: 6px; font: inherit; }
button { padding: 8px 14px; border-radius: 6px; font: inherit; cursor: pointer; border: 1px solid #d9e0de; background: #fff; }
button.primary { background: #0f766e; color: #fff; border-color: #0f766e; }
button:disabled { opacity: .5; cursor: not-allowed; }
</style>
