<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ALL_ROLES, pageDefs, permMatrix, permLog, permLabel, isLocked, type PermLevel } from '../../mock/permissions'
import type { Role } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { dateTime } from '../../utils/format'

/*
 * 角色與權限：角色 × 頁面一張表，每格無／檢視／操作。執行長、系統管理員可改，按儲存即生效並留異動紀錄。
 * 這裡只管頁面；看得到哪幾張單由資料範圍決定（例如工程師要被派工或拉入協作才看得到那張 SO）。
 */
const store = useAppStore()
const canEdit = computed(() => store.can('/admin/permissions', 'edit') && ['執行長', '系統管理員'].includes(store.role))
type Draft = Record<Role, Record<string, PermLevel>>
const clone = (): Draft => JSON.parse(JSON.stringify(permMatrix))
const draft = ref<Draft>(clone())
watch(() => permLog.length, () => { draft.value = clone() })
const dirty = computed(() => ALL_ROLES.some((r) => pageDefs.some((p) => draft.value[r][p.path] !== permMatrix[r][p.path])))
const groups = computed(() => {
  const m = new Map<string, typeof pageDefs>()
  pageDefs.forEach((p) => { if (!m.has(p.group)) m.set(p.group, []); m.get(p.group)!.push(p) })
  return [...m.entries()]
})
const LEVELS: PermLevel[] = ['none', 'view', 'edit']
/* 點一格依序切換 無 → 檢視 → 操作 */
function cycle(r: Role, path: string) {
  if (!canEdit.value || isLocked(r, path)) return
  const cur = draft.value[r][path] ?? 'none'
  draft.value[r][path] = LEVELS[(LEVELS.indexOf(cur) + 1) % LEVELS.length]!
}
function save() {
  let n = 0
  ALL_ROLES.forEach((r) => pageDefs.forEach((p) => {
    const to = draft.value[r][p.path]!
    if (to !== permMatrix[r][p.path]) {
      store.setPermission(r, p.path, to)
      n++
    }
  }))
  ElMessage.success(`已儲存 ${n} 格，立即生效`)
}
function discard() {
  draft.value = clone()
}
const pageLabel = (path: string) => pageDefs.find((p) => p.path === path)?.label ?? path
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>角色與權限</h1>
      </div>
      <div v-if="canEdit" class="actions">
        <el-button :disabled="!dirty" @click="discard">放棄變更</el-button>
        <el-button type="primary" :disabled="!dirty" @click="save">儲存</el-button>
      </div>
    </div>
    <div class="legend">
      <span class="cell edit">操作</span><span class="cell view">檢視</span><span class="cell none">無</span>
    </div>
    <section class="panel matrix-wrap">
      <table class="matrix">
        <thead>
          <tr>
            <th class="page-col">頁面</th>
            <th v-for="r in ALL_ROLES" :key="r" class="role-col">{{ r }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="[g, pages] in groups" :key="g">
            <tr class="group-row"><td :colspan="ALL_ROLES.length + 1">{{ g }}</td></tr>
            <tr v-for="p in pages" :key="p.path">
              <td class="page-col">{{ p.label }}</td>
              <td v-for="r in ALL_ROLES" :key="r" class="c">
                <button
                  type="button"
                  class="cell"
                  :class="[draft[r][p.path], { changed: draft[r][p.path] !== permMatrix[r][p.path], locked: isLocked(r, p.path) }]"
                  :disabled="!canEdit || isLocked(r, p.path)"
                  :aria-label="`${r}・${p.label}：${permLabel[draft[r][p.path] ?? 'none']}`"
                  @click="cycle(r, p.path)"
                >{{ isLocked(r, p.path) ? '固定' : permLabel[draft[r][p.path] ?? 'none'] }}</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>
    <section class="panel log">
      <div class="panel-head"><h2>異動紀錄</h2></div>
      <table v-if="permLog.length" class="plain-table">
        <thead><tr><th>時間</th><th>修改人</th><th>角色</th><th>頁面</th><th>變更</th></tr></thead>
        <tbody>
          <tr v-for="(x, i) in permLog" :key="i">
            <td class="id">{{ dateTime(x.at) }}</td>
            <td>{{ x.by }}</td>
            <td>{{ x.role }}</td>
            <td>{{ pageLabel(x.path) }}</td>
            <td>{{ permLabel[x.from] }} → {{ permLabel[x.to] }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted small empty">還沒有異動。</p>
    </section>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.legend .cell {
  cursor: default;
}

.matrix-wrap {
  overflow-x: auto;
  margin-bottom: 16px;
}

.matrix {
  border-collapse: collapse;
  font-size: 13px;
  min-width: 100%;
}

.matrix th,
.matrix td {
  padding: 4px 6px;
  border-bottom: 1px solid var(--line);
  text-align: center;
  white-space: nowrap;
}

.matrix th {
  position: sticky;
  top: 0;
  background: var(--surface);
  font-weight: 600;
}

.matrix .page-col {
  text-align: left;
  position: sticky;
  left: 0;
  background: var(--surface);
  min-width: 170px;
  z-index: 1;
}

.group-row td {
  text-align: left;
  background: var(--paper);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.cell {
  display: inline-block;
  min-width: 44px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.cell.edit {
  background: var(--teal-soft);
  color: var(--ink);
  border-color: var(--teal);
}

.cell.view {
  background: var(--paper);
  color: var(--ink);
  border-color: var(--line);
}

.cell.none {
  background: transparent;
  color: var(--muted);
}

.cell.changed {
  box-shadow: 0 0 0 2px var(--amber);
}

.cell.locked,
.cell:disabled {
  cursor: default;
  opacity: 0.75;
}

.empty {
  padding: 12px 16px;
}
</style>
