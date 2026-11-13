<script setup lang="ts">
import { computed, ref } from 'vue'
import { Paperclip } from '@element-plus/icons-vue'
import { applications, vendors, type Attachment, type AttachmentType } from '../mock/data'
import { useAppStore } from '../stores/app'
import { dateTime } from '../utils/format'

/*
 * 附件總覽（簽核中心的頁簽）：所有簽核類型的附件統一查詢，只查不傳。
 * 案件附件來自附件庫；行政申請（報帳發票、合約）與供應商建檔文件掛在各自的單據上，這裡一併列出（1112 會議 #18）。
 */
const store = useAppStore()
const fromApps = computed<Attachment[]>(() =>
  applications.flatMap((a) => a.files.map((f, i) => ({ id: `app-${a.id}-${i}`, type: '行政申請' as const, refNo: a.appNo, party: `${a.type}・${a.applicant}`, fileName: f, uploader: a.applicant, at: a.at, sizeKb: 420, scan: '通過' as const, hash: '' }))),
)
const fromVendors = computed<Attachment[]>(() =>
  vendors.flatMap((v) => (v.docs ?? []).map((f, i) => ({ id: `ven-${v.id}-${i}`, type: '供應商文件' as const, refNo: v.vendorNo, party: v.name, fileName: f, uploader: v.appliedBy ?? '採購', at: v.appliedAt ?? '', sizeKb: 680, scan: '通過' as const, hash: '' }))),
)
const attachments = computed(() => [...store.attachments, ...fromApps.value, ...fromVendors.value])

const types: AttachmentType[] = ['客戶回簽', '廠商報價單', '廠商簽回', '出貨簽收', '報價單 PDF', '行政申請', '供應商文件', '其他']
const type = ref<AttachmentType | ''>('')
const q = ref('')

const rows = computed(() => {
  const s = q.value.trim().toLowerCase()
  return attachments.value
    .filter((a) => !type.value || a.type === type.value)
    .filter((a) => !a.voided)
    .filter((a) => !s || a.refNo.toLowerCase().includes(s) || a.party.toLowerCase().includes(s) || a.fileName.toLowerCase().includes(s))
    .sort((a, b) => b.at.localeCompare(a.at))
})
const countOf = (t: AttachmentType) => attachments.value.filter((a) => a.type === t && !a.voided).length

const typeTag: Record<AttachmentType, string> = { 客戶回簽: 'teal', 廠商報價單: 'slate', 廠商簽回: 'olive', 出貨簽收: 'teal', '報價單 PDF': 'slate', 行政申請: 'amber', 供應商文件: 'olive', 其他: 'slate' }
</script>

<template>
  <div class="toolbar">
    <button type="button" class="chip" :class="{ on: type === '' }" @click="type = ''">全部<span class="count">{{ attachments.filter((a) => !a.voided).length }}</span></button>
    <button v-for="t in types" :key="t" type="button" class="chip" :class="{ on: type === t }" @click="type = t">{{ t }}<span class="count">{{ countOf(t) }}</span></button>
    <span class="spacer"></span>
    <el-input v-model="q" placeholder="單號、客戶或廠商、檔名" clearable class="q" />
  </div>

  <section class="panel">
    <table class="plain-table">
      <thead>
        <tr><th>類型</th><th>單號</th><th>客戶 / 廠商</th><th>檔名</th><th>上傳者</th><th>時間</th><th class="num">大小</th></tr>
      </thead>
      <tbody>
        <tr v-for="a in rows" :key="a.id">
          <td><span class="tag" :class="typeTag[a.type]">{{ a.type }}</span></td>
          <td class="id">{{ a.refNo }}</td>
          <td>{{ a.party }}</td>
          <td><span class="file"><el-icon><Paperclip /></el-icon>{{ a.fileName }}</span></td>
          <td>{{ a.uploader }}</td>
          <td class="id">{{ dateTime(a.at) }}</td>
          <td class="num">{{ a.sizeKb >= 1024 ? (a.sizeKb / 1024).toFixed(1) + ' MB' : a.sizeKb + ' KB' }}</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="7" class="empty">沒有符合條件的附件。</td></tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.chip.on {
  border-color: var(--teal);
  background: var(--teal-soft);
  color: var(--teal-ink);
}

.spacer {
  flex: 1;
}

.q {
  width: 260px;
}

.file {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--teal);
  margin-right: 6px;
}

.empty {
  text-align: center;
  color: var(--muted);
  padding: 28px;
}

</style>
