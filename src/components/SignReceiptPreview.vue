<script setup lang="ts">
import { computed } from 'vue'
import type { Shipment } from '../mock/data'

/** 簽收檔預覽（示範用紙本）：SO 抽屜的簽收表與簽收抽屜的簽收紀錄共用 */
const props = defineProps<{ shipment: Shipment | null; customer: string; soNo: string; file?: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const open = computed({
  get: () => !!props.shipment,
  set: (v) => {
    if (!v) emit('close')
  },
})
const fileName = computed(() => props.file ?? props.shipment?.signFile ?? props.shipment?.shipNo ?? '')
/* 簽收人：iPad 與線上簽收的方式字串裡有名字，紙本掃描沒有就顯示客戶簽章 */
const signer = computed(() => props.shipment?.method?.match(/簽收人 (.+)$/)?.[1] ?? props.shipment?.method?.match(/^線上簽收，(.+)$/)?.[1] ?? '客戶簽章')
</script>

<template>
  <el-dialog v-model="open" :title="`簽收檔 · ${fileName}`" width="640px" append-to-body destroy-on-close>
    <div v-if="shipment" class="receipt">
      <div class="stamp" aria-hidden="true">已簽收</div>
      <div class="rc-head"><b>出貨簽收單</b><span class="id">{{ shipment.shipNo }}</span></div>
      <dl class="kv">
        <dt>客戶</dt><dd>{{ customer }}</dd>
        <dt>訂單</dt><dd class="id">{{ soNo }}</dd>
        <dt>出貨日</dt><dd class="id">{{ shipment.at }}</dd>
      </dl>
      <table class="plain-table inner">
        <thead><tr><th>品項</th><th class="num">數量</th></tr></thead>
        <tbody>
          <tr v-for="(l, i) in shipment.lines" :key="i"><td>{{ l.name }}</td><td class="num">{{ l.qty }}</td></tr>
        </tbody>
      </table>
      <div class="rc-sign">
        <span class="muted small">簽收</span>
        <span class="ink">{{ signer }}</span>
        <span class="muted small">{{ shipment.signedAt }} · {{ shipment.method }}</span>
      </div>
    </div>
    <template #footer><el-button @click="open = false">關閉</el-button></template>
  </el-dialog>
</template>

<style scoped>
.receipt {
  position: relative;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.rc-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.stamp {
  position: absolute;
  right: 22px;
  top: 14px;
  padding: 4px 10px;
  border: 2px solid var(--red);
  border-radius: 6px;
  color: var(--red);
  font-weight: 700;
  letter-spacing: 2px;
  transform: rotate(-8deg);
  opacity: 0.85;
}

.kv {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 4px 12px;
  margin: 0 0 10px;
  font-size: 13px;
}

.kv dt {
  color: var(--muted);
}

.kv dd {
  margin: 0;
}

.rc-sign {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}

.ink {
  font-family: 'Segoe Script', 'Brush Script MT', cursive;
  font-size: 22px;
  color: #16211b;
}

.small {
  font-size: 12px;
}
</style>
