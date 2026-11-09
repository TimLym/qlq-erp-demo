<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { handovers as seed, users, type HandoverCase } from '../../mock/data'

const cases = ref<HandoverCase[]>(seed.map((h) => ({ ...h })))
const tab = ref<'待交接' | '已完成'>('待交接')
const list = computed(() => cases.value.filter((h) => h.status === tab.value))
const pendingCount = computed(() => cases.value.filter((h) => h.status === '待交接').length)

const salesUsers = users.filter((u) => u.role === '業務' || u.role === '業務主管')
const bulkSuccessor = ref('')

function applyAll() {
  if (!bulkSuccessor.value) return
  cases.value.filter((h) => h.status === '待交接' && !h.successor).forEach((h) => (h.successor = bulkSuccessor.value))
  ElMessage.success('未指定的客戶已套用接手業務，可逐筆調整')
}

function complete(h: HandoverCase) {
  if (!h.successor) {
    ElMessage.warning('請先指定接手業務')
    return
  }
  h.status = '已完成'
  h.completedAt = '2026-10-08'
  ElMessage.success(`${h.customer} 已交接給 ${h.successor}，進行中商機與代辦已轉移`)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>離職業務交接</h1>
      </div>
    </div>

    <el-tabs v-model="tab">
      <el-tab-pane name="待交接">
        <template #label>待交接<span v-if="pendingCount" class="count hot tab-count">{{ pendingCount }}</span></template>
        <section class="panel">
          <div class="panel-head">
            <h2>陳冠宇<span class="muted sub">離職日 2026-10-31 · 北區業務</span></h2>
            <div class="bulk">
              <el-select v-model="bulkSuccessor" placeholder="全部指定給…" style="width: 180px" clearable>
                <el-option v-for="u in salesUsers.filter((u) => u.name !== '陳冠宇')" :key="u.id" :value="u.name" :label="`${u.name}（${u.role}）`" />
              </el-select>
              <el-button :disabled="!bulkSuccessor" @click="applyAll">套用到未指定</el-button>
            </div>
          </div>
          <table class="plain-table">
            <thead>
              <tr><th>客戶</th><th class="num">進行中商機</th><th class="num">進行中訂單</th><th>接手業務</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="h in list" :key="h.id">
                <td><b>{{ h.customer }}</b><span class="muted"> {{ h.customerDept }}</span></td>
                <td class="num">{{ h.openDeals || '—' }}</td>
                <td class="num">{{ h.openOrders || '—' }}</td>
                <td>
                  <el-select v-model="h.successor" placeholder="選擇接手人" style="width: 200px">
                    <el-option v-for="u in salesUsers.filter((u) => u.name !== h.leavingUser)" :key="u.id" :value="u.name" :label="`${u.name}（${u.role}）`" />
                  </el-select>
                </td>
                <td class="right"><el-button size="small" type="primary" plain :disabled="!h.successor" @click="complete(h)">確認交接</el-button></td>
              </tr>
              <tr v-if="!list.length"><td colspan="5" class="empty">沒有待交接的客戶。</td></tr>
            </tbody>
          </table>
        </section>
      </el-tab-pane>
      <el-tab-pane name="已完成" label="已完成／歷史">
        <section class="panel">
          <table class="plain-table">
            <thead><tr><th>客戶</th><th>離職業務</th><th>離職日</th><th>接手業務</th><th>完成日</th></tr></thead>
            <tbody>
              <tr v-for="h in list" :key="h.id">
                <td><b>{{ h.customer }}</b><span class="muted"> {{ h.customerDept }}</span></td>
                <td>{{ h.leavingUser }}</td>
                <td class="id">{{ h.leaveDate }}</td>
                <td>{{ h.successor }}</td>
                <td class="id">{{ h.completedAt }}</td>
              </tr>
              <tr v-if="!list.length"><td colspan="5" class="empty">尚無完成的交接。</td></tr>
            </tbody>
          </table>
        </section>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.tab-count {
  margin-left: 6px;
}

.sub {
  font-weight: 400;
  font-size: 13px;
  margin-left: 10px;
}

.bulk {
  display: flex;
  gap: 8px;
}

.right {
  text-align: right;
}

.empty {
  text-align: center;
  color: var(--muted);
  padding: 28px;
}

.small {
  font-size: 12px;
}

.foot {
  padding: 10px 16px;
}
</style>
