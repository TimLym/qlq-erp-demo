<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { expiryKinds, type Order, type License } from '../mock/data'
import { useAppStore } from '../stores/app'
import { useJump } from '../composables/useJump'

/** 到期項目抽屜：從到期項目頁點一筆打開；到期日只在這裡改（負責業務、業務主管、執行長） */
const props = defineProps<{ order: Order | null; license: License | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useAppStore()
const { goSo, canSo } = useJump()
const open = computed({
  get: () => !!props.order && !!props.license,
  set: (v) => {
    if (!v) emit('close')
  },
})
const canEdit = computed(() => !!props.order && store.can('/inventory/licenses', 'edit') && (['業務主管', '執行長'].includes(store.role) || (store.role === '業務' && props.order.owner === store.currentUser.name)))
const left = computed(() => (props.order && props.license ? store.licenseStatus(props.order, props.license).left : 0))
const kindLabel = computed(() => expiryKinds.find((k) => k.key === props.license?.kind)?.label ?? props.license?.kind ?? '')
const expires = ref('')
watch(
  () => props.license,
  (l) => {
    expires.value = l?.expires ?? ''
  },
  { immediate: true },
)
function save() {
  if (!props.order || !props.license || !expires.value) return
  if (expires.value !== props.license.expires) {
    store.setLicenseExpiry(props.order, props.license, expires.value)
    ElMessage.success(`${props.license.name} 到期日已改為 ${expires.value}`)
  }
  emit('close')
}
function jumpSo(soNo: string) {
  emit('close')
  goSo(soNo)
}
</script>

<template>
  <el-drawer v-model="open" size="520px" :with-header="false" destroy-on-close append-to-body>
    <div v-if="order && license" class="drawer">
      <header class="head">
        <div>
          <div class="eyebrow"><span class="tag teal">{{ kindLabel }}</span><span class="id">{{ license.sku }}</span></div>
          <h2>{{ license.name }}<span class="dept">× {{ license.qty }}</span></h2>
          <p class="muted">{{ order.customer }} · <a v-if="canSo" class="link" @click="jumpSo(order.soNo)">{{ order.soNo }}</a><template v-else>{{ order.soNo }}</template></p>
        </div>
        <el-button @click="emit('close')">關閉</el-button>
      </header>
      <div class="body">
        <dl class="kv">
          <dt>起日</dt><dd class="id">{{ license.start ?? '—' }}</dd>
          <dt>到期日</dt>
          <dd>
            <el-date-picker v-if="canEdit" v-model="expires" type="date" value-format="YYYY-MM-DD" style="width: 200px" />
            <span v-else class="id">{{ license.expires }}</span>
          </dd>
          <dt>剩餘天數</dt><dd class="num" :class="{ warn: left <= store.remindDaysOf(license.kind) && left >= 0, over: left < 0 }">{{ left }}</dd>
          <dt>負責業務</dt><dd>{{ order.owner }}</dd>
        </dl>
        <div v-if="canEdit" class="actions">
          <el-button type="primary" :disabled="!expires || expires === license.expires" @click="save">儲存</el-button>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 6px;
}

.head h2 {
  margin: 0;
  font-size: 20px;
}

.dept {
  margin-left: 8px;
  font-weight: 400;
  font-size: 15px;
  color: var(--muted);
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 24px;
}

.kv {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 12px;
  align-items: center;
  margin: 0;
  font-size: 14px;
}

.kv dt {
  color: var(--muted);
}

.kv dd {
  margin: 0;
}

.warn {
  color: var(--amber);
  font-weight: 600;
}

.over {
  color: var(--red);
  font-weight: 600;
}

.actions {
  margin-top: 18px;
}
</style>
