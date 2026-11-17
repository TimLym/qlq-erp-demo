<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ownServices, quotes } from '../../mock/data'
import { useAppStore } from '../../stores/app'
import { money } from '../../utils/format'

/** 自有服務項目：報價勾「自有工程」時只能從這裡選，成本帶標準成本，業務不能改（1112 會議 #10） */
const store = useAppStore()
const canEdit = computed(() => ['執行長', '系統管理員'].includes(store.role) && store.can('/admin/own-services', 'edit'))
const inUse = (code: string) => quotes.some((q) => q.lines.some((l) => l.vendor === '自有工程' && l.intSku === code))
const blank = () => ({ code: '', name: '', unit: '式', cost: 0 })
const form = ref(blank())
function add() {
  const f = form.value
  const code = f.code.trim().toUpperCase()
  if (!code || !f.name.trim() || f.cost <= 0) {
    ElMessage.warning('代碼、名稱、標準成本必填')
    return
  }
  if (ownServices.some((s) => s.code === code)) {
    ElMessage.warning('已有同代碼項目')
    return
  }
  ownServices.push({ code, name: f.name.trim(), unit: f.unit.trim() || '式', cost: f.cost, active: true })
  form.value = blank()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>自有服務項目</h1>
      </div>
    </div>
    <section class="panel">
      <table class="plain-table">
        <thead><tr><th>代碼</th><th>名稱</th><th>單位</th><th class="num">標準成本（未稅）</th><th>報價可選</th><th class="num">報價使用</th></tr></thead>
        <tbody>
          <tr v-for="s in ownServices" :key="s.code" :class="{ off: !s.active }">
            <td class="id">{{ s.code }}</td>
            <td><el-input v-if="canEdit" v-model="s.name" size="small" style="width: 220px" /><template v-else>{{ s.name }}</template></td>
            <td><el-input v-if="canEdit" v-model="s.unit" size="small" style="width: 72px" /><template v-else>{{ s.unit }}</template></td>
            <td class="num"><el-input-number v-if="canEdit" v-model="s.cost" :min="0" :step="1000" :precision="0" :controls="false" size="small" style="width: 120px" /><template v-else>{{ money(s.cost) }}</template></td>
            <td><el-switch v-model="s.active" :disabled="!canEdit" size="small" /></td>
            <td class="num">{{ inUse(s.code) ? '是' : '' }}</td>
          </tr>
          <tr v-if="canEdit" class="add">
            <td><el-input v-model="form.code" size="small" placeholder="代碼 *" style="width: 140px" /></td>
            <td><el-input v-model="form.name" size="small" placeholder="名稱 *" style="width: 220px" /></td>
            <td><el-input v-model="form.unit" size="small" style="width: 72px" /></td>
            <td class="num"><el-input-number v-model="form.cost" :min="0" :step="1000" :precision="0" :controls="false" size="small" style="width: 120px" /></td>
            <td colspan="2" class="right"><el-button size="small" type="primary" @click="add">新增</el-button></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.right {
  text-align: right;
}

tr.off td {
  color: var(--muted);
}
</style>
