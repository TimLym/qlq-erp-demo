<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Shipment } from '../mock/data'
import SignReceiptPreview from './SignReceiptPreview.vue'
import { useJump } from '../composables/useJump'

/** 出貨單明細抽屜：從 SO 抽屜的簽收表、流程紀錄或出貨單列表點單號打開，不跳頁 */
const props = defineProps<{ shipment: Shipment | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { goSo, canSo } = useJump()
const preview = ref(false)
function jumpSo(soNo: string) {
  emit('close')
  goSo(soNo)
}
const open = computed({
  get: () => !!props.shipment,
  set: (v) => {
    if (!v) emit('close')
  },
})
</script>

<template>
  <el-drawer v-model="open" size="640px" :with-header="false" destroy-on-close append-to-body>
    <div v-if="shipment" class="drawer">
      <header class="head">
        <div>
          <div class="eyebrow">
            <span class="id">{{ shipment.shipNo }}</span>
            <span class="tag" :class="shipment.status === '已簽收' ? 'olive' : 'amber'">{{ shipment.status === '已簽收' ? '已簽收' : '待簽收' }}</span>
          </div>
          <h2>{{ shipment.customer }}<span class="dept"><a v-if="canSo" class="link" @click="jumpSo(shipment.soNo)">{{ shipment.soNo }}</a><template v-else>{{ shipment.soNo }}</template></span></h2>
          <p class="muted">出貨 {{ shipment.at }} · {{ shipment.by }}</p>
        </div>
        <el-button @click="emit('close')">關閉</el-button>
      </header>
      <div class="body">
        <table class="plain-table">
          <thead><tr><th>品項</th><th class="num">數量</th><th>授權到期</th></tr></thead>
          <tbody>
            <tr v-for="(l, i) in shipment.lines" :key="i">
              <td>{{ l.name }}<div class="muted small">{{ l.sku }}</div></td>
              <td class="num">{{ l.qty }}</td>
              <td class="id">{{ l.expires ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
        <dl v-if="shipment.status === '已簽收'" class="kv">
          <dt>簽收</dt><dd>{{ shipment.signedAt }} · {{ shipment.method }}</dd>
          <dt>簽收檔</dt><dd><a v-if="shipment.signFile" class="link" @click="preview = true">{{ shipment.signFile }}</a><template v-else>—</template></dd>
        </dl>
        <p v-if="shipment.note" class="muted small">備註：{{ shipment.note }}</p>
      </div>
    </div>
    <SignReceiptPreview :shipment="preview ? shipment : null" :customer="shipment?.customer ?? ''" :so-no="shipment?.soNo ?? ''" @close="preview = false" />
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
  margin: 0;
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
  padding: 16px 24px 24px;
}

.kv {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 6px 12px;
  margin: 16px 0 0;
  font-size: 13px;
}

.kv dt {
  color: var(--muted);
}

.kv dd {
  margin: 0;
}

.small {
  font-size: 12px;
}
</style>
