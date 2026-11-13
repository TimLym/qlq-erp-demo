<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Paperclip, Plus } from '@element-plus/icons-vue'
import type { Deal } from '../mock/data'
import { useAppStore } from '../stores/app'
import { dateTime } from '../utils/format'

/*
 * 案件留言：商機與 SO 共用同一條時間軸（留言掛在案件上，只存一份）。
 * 商機轉 SO 後在商機抽屜唯讀；SO 抽屜照常留言，看得到 SO 成立前的留言。
 */
const props = withDefaults(defineProps<{ deal: Deal; readonly?: boolean; canManageMembers?: boolean; active?: boolean }>(), { active: true })
const emit = defineEmits<{ (e: 'add-member'): void }>()
const store = useAppStore()

const list = computed(() => store.comments.filter((c) => c.dealId === props.deal.id).sort((a, b) => a.at.localeCompare(b.at)))
const members = computed(() => store.membersOf(props.deal.id))
const participants = computed(() => store.participantsOf(props.deal))
const isMentioningMe = (c: { mentionIds?: string[] }) => !!c.mentionIds?.includes(store.currentUserId)
/* 切到留言頁簽才把這個案件對我的提及標為已讀 */
watch([() => props.active, () => props.deal.id], ([on, id]) => { if (on) store.markMentionsRead(id) }, { immediate: true })

const draft = ref('')
const composerRef = ref<{ focus: () => void } | null>(null)
const people = computed(() =>
  participants.value.map((u) => {
    const m = members.value.find((x) => x.userId === u.id)
    const kind = props.deal.ownerId === u.id ? '負責業務' : m?.kind ?? u.role
    return { u, kind, cls: kind === '負責業務' ? 'owner' : kind === '工程師' ? 'eng' : '' }
  }),
)
function tagPerson(name: string) {
  const cur = draft.value
  draft.value = `${cur}${cur && !/\s$/.test(cur) ? ' ' : ''}@${name} `
  composerRef.value?.focus()
}
function post() {
  const d = props.deal
  const text = draft.value.trim()
  if (!text) return
  /* @ 提及：只能提及案件參與者；不在案件的人要先加入 */
  const outsiders = store.users.filter((u) => u.id !== store.currentUserId && text.includes(`@${u.name}`) && !participants.value.some((p) => p.id === u.id))
  if (outsiders.length) {
    ElMessage.warning(`${outsiders.map((u) => u.name).join('、')} 不在這個案件，請先加入再提及`)
    return
  }
  const mentioned = participants.value.filter((u) => u.id !== store.currentUserId && text.includes(`@${u.name}`))
  const now = new Date()
  store.comments.push({ id: `c-${now.getTime()}`, dealId: d.id, author: store.currentUser.name, role: store.currentUser.role, at: now.toISOString(), text, mentionIds: mentioned.map((u) => u.id) })
  mentioned.forEach((u) => {
    store.todos.unshift({ id: `t-${now.getTime()}-${u.id}`, kind: '回覆', title: `${store.currentUser.name}在${d.customer}案提及你：${text.replace(`@${u.name}`, '').trim().slice(0, 30)}`, refNo: d.dealNo, forRoles: [u.role], forUserIds: [u.id], dealId: d.id, createdAt: now.toISOString() })
    store.notifications.unshift({ id: `n-${now.getTime()}-${u.id}`, kind: '提及', text: `${store.currentUser.name} 在 ${d.customer} 案提及你：${text.slice(0, 60)}`, at: now.toISOString(), read: false, forRoles: [u.role], forUserIds: [u.id] })
  })
  draft.value = ''
  ElMessage.success(mentioned.length ? `留言已送出，${mentioned.map((u) => u.name).join('、')}會收到代辦與通知` : '留言已送出')
}
defineExpose({ count: computed(() => list.value.length) })
</script>

<template>
  <div class="case-comments">
    <div v-if="!readonly" class="people-bar">
      <button v-for="x in people" :key="x.u.id" type="button" class="avatar" :class="x.cls" :title="`${x.u.name} · ${x.kind}${x.u.id === store.currentUserId ? '（你）' : '，點一下 @ 他'}`" :disabled="x.u.id === store.currentUserId" @click="tagPerson(x.u.name)">{{ x.u.name.slice(0, 1) }}</button>
      <button v-if="canManageMembers" type="button" class="avatar add" title="加入協作成員" @click="emit('add-member')"><el-icon><Plus /></el-icon></button>
    </div>
    <ul class="comments">
      <li v-for="c in list" :key="c.id" :class="{ me: isMentioningMe(c) }">
        <div class="c-head">
          <b>{{ c.author }}</b>
          <span class="muted">{{ c.role }} · {{ dateTime(c.at) }}</span>
        </div>
        <p class="c-text">{{ c.text }}</p>
        <span v-if="c.attachment" class="file"><el-icon><Paperclip /></el-icon>{{ c.attachment }}</span>
      </li>
      <li v-if="!list.length" class="muted empty-row">還沒有留言。</li>
    </ul>
    <div v-if="!readonly" class="composer">
      <el-input ref="composerRef" v-model="draft" type="textarea" :rows="3" placeholder="輸入留言；@ 提及案件參與者" />
      <div class="composer-actions">
        <el-button size="small" :icon="Paperclip">附加檔案</el-button>
        <el-button size="small" type="primary" @click="post">送出留言</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--slate-soft);
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
  flex: none;
  border: none;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.avatar.owner {
  background: var(--teal);
  color: #fff;
}

.avatar.eng {
  background: var(--amber-soft);
  color: var(--amber);
}

.avatar:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 0 0 2px var(--teal-soft);
}

.avatar:disabled {
  cursor: default;
  opacity: 0.6;
}

.avatar.add {
  background: var(--surface);
  border: 1px dashed var(--line-strong);
  color: var(--muted);
}

.avatar.add:hover {
  border-color: var(--teal);
  color: var(--teal);
}

.people-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.comments {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
}

.comments li {
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}

.comments li.me {
  background: var(--amber-soft);
  border-radius: 6px;
  padding: 6px 8px;
}

.empty-row {
  font-size: 13px;
}

.c-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13px;
}

.c-text {
  margin-top: 4px;
  white-space: pre-wrap;
}

.file {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--teal);
  font-size: 13px;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
