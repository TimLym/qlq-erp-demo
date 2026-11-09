<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { themes } from '../theme'
import { expiryKinds } from '../mock/data'

const store = useAppStore()

const manager = computed(() => {
  if (store.role === '業務') return '林雅婷（業務主管）'
  if (store.role === '業務主管' || store.role === '採購' || store.role === '財務主管') return '王承恩（執行長）'
  if (store.role === '會計') return '劉欣怡（財務主管）'
  return '—'
})

const notify = ref({ mention: true, orderDone: true, payment: true })

/* 到期提醒天數：本地草稿，按儲存才寫回；空白＝用類型預設 */
type RemindDraft = Record<string, number | null>
const createRemindDraft = (): RemindDraft => Object.fromEntries(expiryKinds.map((k) => [k.key, store.remindDays[k.key] ?? null]))
const remindDraft = ref<RemindDraft>(createRemindDraft())
watch(() => store.currentUserId, () => (remindDraft.value = createRemindDraft()))
function saveRemindDays() {
  for (const k of expiryKinds) store.setRemindDays(k.key, remindDraft.value[k.key] ?? null)
  ElMessage.success('到期提醒天數已儲存')
}
</script>

<template>
  <div class="page settings">
    <div class="page-head">
      <div>
        <h1>個人設定</h1>
      </div>
    </div>

    <div class="two top">
      <section class="panel">
        <div class="panel-head"><h2>基本資料</h2></div>
        <dl class="kv info">
          <dt>姓名</dt><dd>{{ store.currentUser.name }}</dd>
          <dt>角色</dt><dd>{{ store.role }}</dd>
          <dt>部門</dt><dd>{{ store.currentUser.dept }}</dd>
          <dt>直屬主管</dt><dd>{{ manager }}</dd>
        </dl>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>通知偏好</h2></div>
        <div class="panel-body prefs">
          <el-checkbox v-model="notify.mention">有人 @ 我</el-checkbox>
          <el-checkbox v-model="notify.orderDone">採購下單完成</el-checkbox>
          <el-checkbox v-model="notify.payment">收款到帳</el-checkbox>
          <div class="save"><el-button type="primary" @click="ElMessage.success('通知偏好已儲存')">儲存</el-button></div>
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>配色主題</h2><span class="muted">目前：{{ themes.find((t) => t.id === store.theme)?.label }}</span></div>
      <div class="themes">
        <button
          v-for="t in themes"
          :key="t.id"
          type="button"
          class="theme"
          :class="{ on: store.theme === t.id }"
          :aria-pressed="store.theme === t.id"
          @click="store.setTheme(t.id)"
        >
          <span class="preview" :style="{ background: t.swatch.paper, borderColor: store.theme === t.id ? t.swatch.accent : undefined }">
            <span class="p-rail" :style="{ background: t.swatch.accent }"></span>
            <span class="p-body">
              <span class="p-bar" :style="{ background: t.swatch.surface, borderColor: t.swatch.ink + '22' }"></span>
              <span class="p-row" :style="{ background: t.swatch.surface, borderColor: t.swatch.ink + '22' }"><i :style="{ background: t.swatch.ink }"></i><i :style="{ background: t.swatch.accent }"></i></span>
              <span class="p-row" :style="{ background: t.swatch.surface, borderColor: t.swatch.ink + '22' }"><i :style="{ background: t.swatch.ink }"></i></span>
            </span>
          </span>
          <span class="t-label">
            <b>{{ t.label }}<el-icon v-if="store.theme === t.id" class="check"><Check /></el-icon></b>
            <span class="muted">{{ t.note }}</span>
          </span>
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>到期提醒天數</h2></div>
      <div class="panel-body remind-form">
        <div class="remind-grid remind-grid-head">
          <span>類型</span>
          <span>系統預設</span>
          <span>我的設定</span>
          <span>目前生效</span>
        </div>
        <div v-for="k in expiryKinds" :key="k.key" class="remind-grid remind-grid-row">
          <div class="remind-label">{{ k.label }}</div>
          <div class="remind-default num">{{ k.defaultRemindDays }} 天</div>
          <div class="remind-input">
            <el-input-number :model-value="remindDraft[k.key] ?? undefined" :min="0" :max="365" :controls="false" :placeholder="String(k.defaultRemindDays)" @update:model-value="(v: number | undefined) => (remindDraft[k.key] = v ?? null)" />
            <span class="muted">天</span>
          </div>
          <div class="remind-effective">
            <span class="tag" :class="remindDraft[k.key] == null ? 'slate' : 'teal'">{{ remindDraft[k.key] == null ? '系統預設' : '自訂' }}</span>
            <span class="num">{{ remindDraft[k.key] ?? k.defaultRemindDays }} 天</span>
          </div>
        </div>
        <div class="remind-actions">
          <el-button type="primary" @click="saveRemindDays">儲存</el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 區塊之間一律 16px，由 flex gap 控制 */
.settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings > .page-head {
  margin-bottom: 0;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 0;
}

@media (max-width: 900px) {
  .two {
    grid-template-columns: 1fr;
  }
}

/* 到期提醒天數：設定表格 */
.remind-form {
  padding-top: 0;
}

.remind-grid {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(100px, 0.7fr) minmax(180px, 1fr) minmax(170px, 1fr);
  column-gap: 20px;
  align-items: center;
}

.remind-grid-head {
  min-height: 42px;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  font-size: 13px;
  font-weight: 500;
}

.remind-grid-row {
  min-height: 58px;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
}

.remind-label {
  color: var(--muted);
}

.remind-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remind-input :deep(.el-input-number) {
  width: 120px;
}

.remind-effective {
  display: flex;
  align-items: center;
  gap: 10px;
}

.remind-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
}

@media (max-width: 760px) {
  .remind-grid-head {
    display: none;
  }

  .remind-grid-row {
    grid-template-columns: 1fr auto;
    gap: 10px 16px;
    padding: 14px 0;
  }

  .remind-label {
    color: var(--ink);
    font-weight: 600;
  }

  .remind-default {
    color: var(--muted);
    text-align: right;
  }

  .remind-input {
    grid-column: 1;
  }

  .remind-effective {
    grid-column: 2;
    justify-content: flex-end;
  }
}


.info {
  padding: 12px 16px 14px;
  grid-template-columns: 90px 1fr;
}




.themes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
  padding: 16px;
}

.theme {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: var(--ink);
}

.preview {
  display: flex;
  height: 110px;
  border: 2px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}

.theme:hover .preview {
  border-color: var(--line-strong);
}

.p-rail {
  width: 24%;
}

.p-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}

.p-bar {
  height: 12px;
  border: 1px solid;
  border-radius: 3px;
}

.p-row {
  height: 18px;
  border: 1px solid;
  border-radius: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
}

.p-row i {
  display: block;
  height: 5px;
  border-radius: 2px;
  opacity: 0.8;
}

.p-row i:first-child {
  width: 40%;
}

.p-row i:nth-child(2) {
  width: 20%;
}

.t-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.t-label b {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.check {
  color: var(--teal);
}

.prefs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.divider {
  height: 1px;
  background: var(--line);
  margin: 8px 0;
}

.save {
  margin-top: 10px;
}

.favs {
  font-size: 14px;
}

.small {
  font-size: 12px;
}

.right {
  text-align: right;
}

@media (max-width: 900px) {
  .two {
    grid-template-columns: 1fr;
  }
}
</style>
