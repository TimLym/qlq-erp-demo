<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { pageOf, permMatrix } from '../mock/permissions'

/** 沒有權限：直接打網址或舊書籤進到這個角色不能看的頁面時 */
const store = useAppStore()
const route = useRoute()
const router = useRouter()
const from = computed(() => (typeof route.query.from === 'string' ? route.query.from : ''))
const page = computed(() => pageOf(from.value.split('?')[0] ?? ''))
/* 切換到可代理的角色就能進的話，提示切換 */
const viaSwitch = computed(() => (page.value ? store.switchableRoles.find((x) => (permMatrix[x.role]?.[page.value!.path] ?? 'none') !== 'none') : undefined))
function switchAndGo() {
  const t = viaSwitch.value
  if (!t) return
  store.switchRole({ role: t.role, forUserId: t.forUserId, source: t.source })
  router.replace(from.value)
}
</script>

<template>
  <div class="page">
    <section class="panel denied">
      <h1>沒有權限</h1>
      <dl class="kv">
        <dt>頁面</dt><dd>{{ page ? `${page.group} → ${page.label}` : from }}</dd>
        <dt>需要</dt><dd>這一頁的「檢視」權限</dd>
        <dt>目前角色</dt><dd>{{ store.currentUser.name }}・{{ store.role }}</dd>
      </dl>
      <div class="acts">
        <el-button v-if="viaSwitch" type="primary" @click="switchAndGo">切換為{{ viaSwitch.label }}並前往</el-button>
        <el-button @click="router.replace('/')">回首頁</el-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.denied {
  max-width: 560px;
  margin: 48px auto;
  padding: 28px 32px;
}

.denied h1 {
  margin: 0 0 16px;
  font-size: 22px;
}

.kv {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 8px 12px;
  margin: 0 0 20px;
}

.kv dt {
  color: var(--muted);
}

.kv dd {
  margin: 0;
}

.acts {
  display: flex;
  gap: 8px;
}
</style>
