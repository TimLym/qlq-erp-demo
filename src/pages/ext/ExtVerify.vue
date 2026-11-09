<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { quotes, deals } from '../../mock/data'

const route = useRoute()
const code = computed(() => String(route.params.code ?? ''))
const quote = computed(() => quotes.find((q) => q.id === code.value && q.status !== '草稿'))
const deal = computed(() => (quote.value ? deals.find((d) => d.id === quote.value!.dealId) : undefined))
const hash = computed(() => (quote.value ? `sha256:${Array.from(quote.value.id + quote.value.date).map((c) => c.charCodeAt(0).toString(16)).join('').padEnd(24, 'a').slice(0, 24)}…` : ''))
</script>

<template>
  <div class="ext">
    <div class="card">
      <div class="brand">銓立光科技 · 報價單驗證</div>
      <template v-if="quote && deal">
        <div class="ok">✓ 此報價單由系統核發</div>
        <dl>
          <dt>報價單號</dt><dd class="id">{{ deal.dealNo }}-Q{{ quote.version }}</dd>
          <dt>核發日期</dt><dd class="id">{{ quote.date }}</dd>
          <dt>客戶</dt><dd>{{ deal.customer }}</dd>
          <dt>版本狀態</dt><dd>{{ quote.submittedAt ? '已簽約' : '有效' }}</dd>
          <dt>文件雜湊</dt><dd class="id">{{ hash }}</dd>
        </dl>
        <p class="muted">本頁只顯示核發資訊，不顯示金額明細。若您手上的報價單金額與業務告知不符，請直接聯絡銓立光。</p>
      </template>
      <template v-else>
        <div class="bad">✕ 查無此文件</div>
        <p class="muted">驗證碼 {{ code || '（空）' }} 不存在或已作廢。請確認 QR Code 是否完整，或聯絡銓立光業務。</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ext { min-height: 100vh; display: grid; place-items: center; background: #eef2f1; padding: 24px; font-family: 'Noto Sans TC', system-ui, sans-serif; }
.card { background: #fff; border-radius: 12px; padding: 28px 32px; max-width: 480px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,.08); color: #16211b; }
.brand { font-size: 13px; color: #5d6b66; margin-bottom: 14px; }
.ok { font-size: 20px; font-weight: 700; color: #0f766e; margin-bottom: 14px; }
.bad { font-size: 20px; font-weight: 700; color: #b3261e; margin-bottom: 14px; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin: 0 0 14px; font-size: 14px; }
dt { color: #5d6b66; }
dd { margin: 0; }
.id { font-variant-numeric: tabular-nums; }
.muted { color: #5d6b66; font-size: 13px; margin: 0; }
</style>
