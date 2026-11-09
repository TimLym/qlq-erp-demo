<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MilestoneEditor from './MilestoneEditor.vue'
import { milestoneProblems, type Milestone } from '../mock/data'

/* 請款條件彈窗：開啟時複製一份暫存，按確定才交回；合計要等於報價合計 */
const props = defineProps<{ modelValue: boolean; milestones: Milestone[]; total: number; title?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'save', v: Milestone[]): void }>()

const draft = ref<Milestone[]>([])
watch(() => props.modelValue, (open) => { if (open) draft.value = props.milestones.map((m) => ({ ...m })) })
const problems = computed(() => (props.modelValue ? milestoneProblems(draft.value, props.total) : []))
function save() {
  if (problems.value.length) return
  emit('save', draft.value.map((m) => ({ ...m })))
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog :model-value="modelValue" :title="title ?? '請款條件'" width="640px" append-to-body @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <MilestoneEditor v-if="modelValue" v-model="draft" :total="total" />
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="problems.length > 0" :title="problems.join('、')" @click="save">確定</el-button>
    </template>
  </el-dialog>
</template>
