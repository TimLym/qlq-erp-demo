import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { deals } from '../mock/data'
import { useAppStore } from '../stores/app'

/*
 * 單號可點：SO 單號開銷售訂單頁的抽屜；「預下單 D-xxx」或商機編號開 Pipeline 的商機抽屜。
 * 角色沒有目標頁的檢視權限時不跳（畫面上改成純文字，用 canSo／canDeal／canRef 判斷）。
 */
export function useJump() {
  const router = useRouter()
  const store = useAppStore()
  const canSo = computed(() => store.can('/sales/orders'))
  const canDeal = computed(() => store.can('/sales/pipeline'))
  const isSo = (ref: string) => {
    const v = ref.replace(/^預下單\s*/, '')
    return v.startsWith('SO-') || v.startsWith('PRE-')
  }
  const canRef = (ref: string) => (isSo(ref) ? canSo.value : canDeal.value)
  const goSo = (soNo: string) => {
    if (canSo.value) router.push({ path: '/sales/orders', query: { so: soNo } })
  }
  const goDealNo = (dealNo: string) => {
    const d = deals.find((x) => x.dealNo === dealNo)
    if (d && canDeal.value) router.push({ path: '/sales/pipeline', query: { deal: d.id } })
  }
  /** 依字串判斷：SO-…／PRE-… 走 SO，其餘（預下單 D-…／D-…）走商機 */
  const goRef = (ref: string) => {
    const v = ref.replace(/^預下單\s*/, '')
    if (isSo(v)) return goSo(v)
    return goDealNo(v)
  }
  return { goSo, goDealNo, goRef, canSo, canDeal, canRef }
}
