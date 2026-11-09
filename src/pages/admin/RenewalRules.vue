<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useAppStore } from '../../stores/app'

/*
 * 原廠續約規則：每個品牌的續約窗口、提醒、寬限與回溯規則。
 * 序號與授權頁、首頁到期代辦、續約報價都依這張表；改了即生效，正式版存 core.renewal_rule 並留異動紀錄。
 */
const store = useAppStore()
function save() {
  ElMessage.success('已儲存，序號與授權頁與到期代辦立即套用')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>原廠續約規則</h1>
      </div>
      <div class="actions"><el-button type="primary" @click="save">儲存</el-button></div>
    </div>
    <div class="panel">
      <table class="plain-table rules">
        <thead>
          <tr>
            <th>原廠</th>
            <th>SKU 前綴</th>
            <th class="num">開放續約<br /><span class="muted">到期前天數</span></th>
            <th class="num">到期代辦<br /><span class="muted">到期前天數</span></th>
            <th class="num">急件<br /><span class="muted">到期前天數</span></th>
            <th class="num">寬限<br /><span class="muted">到期後天數</span></th>
            <th class="num">回溯上限<br /><span class="muted">月</span></th>
            <th>可 co-term</th>
            <th class="num">原廠通知客戶<br /><span class="muted">到期前 / 後天數</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in store.vendorRenewalRules" :key="r.brand">
            <td><b>{{ r.brand }}</b></td>
            <td class="id">{{ r.prefixes.join('、') }}</td>
            <td class="num"><el-input-number v-model="r.openDays" :min="30" :max="365" :step="30" :controls="false" size="small" class="n" /></td>
            <td class="num"><el-input-number v-model="r.remindDays" :min="7" :max="365" :step="15" :controls="false" size="small" class="n" /></td>
            <td class="num"><el-input-number v-model="r.urgentDays" :min="0" :max="90" :step="5" :controls="false" size="small" class="n" /></td>
            <td class="num"><el-input-number v-model="r.graceDays" :min="0" :max="90" :step="5" :controls="false" size="small" class="n" /></td>
            <td class="num"><el-input-number v-model="r.backdateMonths" :min="0" :max="12" :controls="false" size="small" class="n" /></td>
            <td><el-switch v-model="r.coTerm" /></td>
            <td class="num nowrap"><el-input-number v-model="r.noticeBefore" :min="0" :max="90" :controls="false" size="small" class="n" /> / <el-input-number v-model="r.noticeAfter" :min="0" :max="90" :controls="false" size="small" class="n" /></td>
          </tr>
        </tbody>
      </table>
      <dl class="legend">
        <dt>開放續約</dt><dd>到期前這麼多天起，序號與授權頁出現「建立續約商機」。</dd>
        <dt>到期代辦</dt><dd>到期前這麼多天建「到期」代辦給負責業務與主管。</dd>
        <dt>急件</dt><dd>到期前這麼多天內標急件；過期後進寬限，寬限過了標「已失效」。</dd>
        <dt>回溯上限</dt><dd>過期後續約，原廠把新合約回溯到原到期日的上限；超過就視為新購。</dd>
        <dt>原廠通知客戶</dt><dd>原廠會在這兩個時間點直接聯絡終端客戶，業務要在之前動作。</dd>
      </dl>
    </div>
  </div>
</template>

<style scoped>
.rules th {
  line-height: 1.3;
}

.rules th .muted {
  font-weight: 400;
  font-size: 11px;
}

.rules :deep(.el-input-number.n) {
  width: 72px;
}

.rules :deep(.el-input-number.n .el-input__inner) {
  text-align: right;
}

.nowrap {
  white-space: nowrap;
}

.legend {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 4px 12px;
  margin: 16px 0 0;
  font-size: 13px;
}

.legend dt {
  color: var(--muted);
}

.legend dd {
  margin: 0;
}
</style>
