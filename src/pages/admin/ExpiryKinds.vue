<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { expiryKinds, orders } from '../../mock/data'
import { useAppStore } from '../../stores/app'

/** 到期類型：系統管理員維護；每種類型有預設提醒天數，個人設定可以覆寫 */
const store = useAppStore()
const canEdit = computed(() => ['執行長', '系統管理員'].includes(store.role))
const newLabel = ref('')
const newDays = ref(90)
const inUse = (key: string) => orders.some((o) => o.licenses.some((l) => l.kind === key))
function add() {
  const label = newLabel.value.trim()
  if (!label) {
    ElMessage.warning('類型名稱必填')
    return
  }
  if (expiryKinds.some((k) => k.key === label)) {
    ElMessage.warning('已有同名類型')
    return
  }
  expiryKinds.push({ key: label, label, defaultRemindDays: newDays.value })
  newLabel.value = ''
  newDays.value = 90
}
function remove(key: string) {
  if (inUse(key)) return
  expiryKinds.splice(expiryKinds.findIndex((k) => k.key === key), 1)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>到期類型</h1>
      </div>
    </div>
    <section class="panel">
      <table class="plain-table">
        <thead><tr><th>類型</th><th class="num">預設提醒天數</th><th class="num">使用中</th><th></th></tr></thead>
        <tbody>
          <tr v-for="k in expiryKinds" :key="k.key">
            <td><el-input v-if="canEdit" v-model="k.label" size="small" style="width: 200px" /><template v-else>{{ k.label }}</template></td>
            <td class="num"><el-input-number v-if="canEdit" v-model="k.defaultRemindDays" :min="0" :max="365" :controls="false" size="small" style="width: 90px" /><template v-else>{{ k.defaultRemindDays }}</template></td>
            <td class="num">{{ orders.reduce((n, o) => n + o.licenses.filter((l) => l.kind === k.key).length, 0) }}</td>
            <td class="right"><el-button v-if="canEdit" size="small" text :disabled="inUse(k.key)" @click="remove(k.key)">刪除</el-button></td>
          </tr>
          <tr v-if="canEdit" class="add">
            <td><el-input v-model="newLabel" size="small" placeholder="類型名稱 *" style="width: 200px" /></td>
            <td class="num"><el-input-number v-model="newDays" :min="0" :max="365" :controls="false" size="small" style="width: 90px" /></td>
            <td></td>
            <td class="right"><el-button size="small" type="primary" @click="add">新增</el-button></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.right { text-align: right; }
</style>
