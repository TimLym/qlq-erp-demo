<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import type { AttachmentType } from '../mock/data'
import { useAppStore } from '../stores/app'

const props = defineProps<{
  modelValue: boolean
  refNo: string
  party: string
  /** 可選的附件類型；不給則全部 */
  types?: AttachmentType[]
  /** 預設類型 */
  defaultType?: AttachmentType
  title?: string
  /** 其他附件：只有上傳區與檔案名稱，類型固定「其他」 */
  simple?: boolean
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'uploaded', fileName: string, type: AttachmentType): void }>()
const store = useAppStore()

const allTypes: AttachmentType[] = ['客戶回簽', '廠商報價單', '廠商簽回', '出貨簽收', '報價單 PDF', '其他']
const typeOptions = computed(() => props.types ?? allTypes)
const type = ref<AttachmentType>(props.defaultType ?? typeOptions.value[0]!)
const name = ref('')
const picked = ref<{ name: string; sizeKb: number } | null>(null)
const busy = ref(false)

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      type.value = props.simple ? '其他' : props.defaultType ?? typeOptions.value[0]!
      name.value = ''
      picked.value = null
      busy.value = false
    }
  },
)

const stem = (f: string) => f.replace(/\.[^.]+$/, '')
function onChange(file: UploadFile) {
  picked.value = { name: file.name, sizeKb: Math.max(1, Math.round((file.size ?? 0) / 1024)) }
  if (!name.value.trim()) name.value = stem(file.name)
}

const samples = ['合約書_簽章版.pdf', '會議紀錄_20261008.docx', '掃描_20261008.pdf']
function useSample() {
  const f = samples[Math.floor(Math.random() * samples.length)]!
  picked.value = { name: f, sizeKb: 420 + Math.floor(Math.random() * 1800) }
  if (!name.value.trim()) name.value = stem(f)
}

const canSubmit = computed(() => !!picked.value && (!props.simple || !!name.value.trim()))

async function submit() {
  if (!picked.value || !canSubmit.value) return
  busy.value = true
  await new Promise((r) => setTimeout(r, 500))
  store.addAttachment({ type: type.value, refNo: props.refNo, party: props.party, fileName: picked.value.name, sizeKb: picked.value.sizeKb, title: props.simple ? name.value.trim() : undefined })
  busy.value = false
  ElMessage.success('上傳完成')
  emit('uploaded', picked.value.name, type.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog :model-value="modelValue" :title="title ?? '上傳附件'" width="520px" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <el-form label-position="top">
      <!-- 只有一種可選（例如廠商報價單）就不用選 -->
      <el-form-item v-if="!simple && typeOptions.length > 1" label="附件類型">
        <el-select v-model="type" style="width: 100%">
          <el-option v-for="t in typeOptions" :key="t" :value="t" :label="t" />
        </el-select>
      </el-form-item>
      <el-form-item label="檔案">
        <el-upload drag :auto-upload="false" :show-file-list="false" :on-change="onChange" accept=".pdf,.jpg,.jpeg,.png,.heic,.docx,.xlsx" class="uploader">
          <el-icon class="up-icon"><UploadFilled /></el-icon>
          <div class="up-text">拖曳檔案到這裡，或點一下選擇</div>
        </el-upload>
        <div class="picked">
          <span v-if="picked" class="file">{{ picked.name }}<span class="muted">（{{ picked.sizeKb >= 1024 ? (picked.sizeKb / 1024).toFixed(1) + ' MB' : picked.sizeKb + ' KB' }}）</span></span>
          <el-button v-else size="small" text @click="useSample">示範用：隨機帶一個檔案</el-button>
        </div>
      </el-form-item>
      <el-form-item v-if="simple" label="檔案名稱" required>
        <el-input v-model="name" placeholder="例：崇光醫療 維護合約書" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="busy" :disabled="!canSubmit" @click="submit">上傳</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.uploader {
  width: 100%;
}

.uploader :deep(.el-upload-dragger) {
  padding: 22px 16px;
}

.up-icon {
  font-size: 36px;
  color: var(--teal);
}

.up-text {
  margin-top: 4px;
}

.picked {
  margin-top: 8px;
  min-height: 24px;
}

.file {
  color: var(--teal);
  font-weight: 500;
}
</style>
