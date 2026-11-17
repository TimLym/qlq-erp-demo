<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { type Deal } from '../mock/data'
import { useAppStore } from '../stores/app'

/*
 * 把人拉進商機：負責業務、所屬業務主管、執行長可以加一般協作成員（採購、會計、其他業務…）。
 * 工程師不能從這裡加，要走「工程支援」由工程主管派工，主管才知道人力去哪裡。
 */
const props = defineProps<{ modelValue: boolean; deal: Deal | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const store = useAppStore()

const q = ref('')
const picked = ref<string[]>([])
watch(() => props.modelValue, (v) => { if (v) { q.value = ''; picked.value = [] } })

const members = computed(() => (props.deal ? store.membersOf(props.deal.id) : []))
const memberUser = (id: string) => store.users.find((u) => u.id === id)
const inDeal = (id: string) => !!props.deal && (props.deal.ownerId === id || members.value.some((m) => m.userId === id))
/* 本來就看得到這個商機的人（該事業部業務主管、執行長）不用加；已在商機的也不列 */
const alreadySees = (u: { id: string; role: string; dept: string }) => !!props.deal && (u.role === '執行長' || (u.role === '業務主管' && u.dept === props.deal.dept))
const candidates = computed(() =>
  store.users
    .filter((u) => !inDeal(u.id) && !alreadySees(u))
    .filter((u) => !q.value.trim() || `${u.name}${u.dept}${u.role}`.includes(q.value.trim())),
)
const isEngineer = (role: string) => role === '工程師'
function toggle(id: string) {
  picked.value = picked.value.includes(id) ? picked.value.filter((x) => x !== id) : [...picked.value, id]
}
function confirm() {
  if (!props.deal || !picked.value.length) return
  const added = store.addMembers(props.deal, picked.value)
  ElMessage.success(`已加入 ${added.map((u) => u.name).join('、')}，他們可以看留言、被提及，但看不到金額與報價單`)
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog :model-value="modelValue" title="加入協作成員" width="520px" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <template v-if="deal">
      <div class="current">
        <span class="label muted small">目前在商機</span>
        <span class="chip owner">{{ deal.owner }} · 負責業務</span>
        <span v-for="m in members" :key="m.userId" class="chip" :class="{ eng: m.kind === '工程師' }">{{ memberUser(m.userId)?.name }} · {{ m.kind }}</span>
      </div>
      <el-input v-model="q" placeholder="搜尋姓名、部門或角色" clearable class="search" />
      <ul class="people">
        <li v-for="u in candidates" :key="u.id" :class="{ disabled: isEngineer(u.role), on: picked.includes(u.id) }" @click="!isEngineer(u.role) && toggle(u.id)">
          <span class="avatar" :class="{ eng: isEngineer(u.role) }">{{ u.name.slice(0, 1) }}</span>
          <span class="who"><b>{{ u.name }}</b><span class="muted small">{{ u.dept }} · {{ store.roleLabelOf(u) }}</span></span>
          <span v-if="isEngineer(u.role)" class="muted small">須由工程主管派工</span>
          <el-checkbox v-else :model-value="picked.includes(u.id)" @click.stop @change="toggle(u.id)" />
        </li>
        <li v-if="!candidates.length" class="muted small empty">沒有可以再加的人。</li>
      </ul>
    </template>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!picked.length" @click="confirm">加入{{ picked.length ? ` ${picked.length} 位` : '' }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.search {
  margin-bottom: 8px;
}

.current {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.current .label {
  margin-right: 2px;
}

.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--slate-soft);
  font-size: 12px;
}

.chip.owner {
  background: var(--teal-soft);
  color: var(--teal);
}

.chip.eng {
  background: var(--amber-soft);
  color: var(--amber);
}

.people {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 6px;
}

.people li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
}

.people li:last-child {
  border-bottom: none;
}

.people li:hover {
  background: var(--paper);
}

.people li.on {
  background: var(--teal-soft);
}

.people li.disabled {
  cursor: default;
  color: var(--muted);
}

.people li.disabled:hover {
  background: transparent;
}

.people li.empty {
  justify-content: center;
}

.who {
  display: flex;
  flex-direction: column;
  flex: 1;
  line-height: 1.3;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--teal);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  flex: none;
}

.avatar.eng {
  background: var(--amber);
}

.small {
  font-size: 12px;
}
</style>
