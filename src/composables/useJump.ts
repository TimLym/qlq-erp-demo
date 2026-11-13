import { useRouter } from 'vue-router'
import { deals } from '../mock/data'

/** 單號可點：SO 單號開銷售訂單頁的抽屜；「預下單 D-xxx」或商機編號開 Pipeline 的商機抽屜 */
export function useJump() {
  const router = useRouter()
  const goSo = (soNo: string) => router.push({ path: '/sales/orders', query: { so: soNo } })
  const goDealNo = (dealNo: string) => {
    const d = deals.find((x) => x.dealNo === dealNo)
    if (d) router.push({ path: '/sales/pipeline', query: { deal: d.id } })
  }
  /** 依字串判斷：SO-… 走 SO，其餘（預下單 D-…／D-…）走商機 */
  const goRef = (ref: string) => {
    const v = ref.replace(/^預下單\s*/, '')
    if (v.startsWith('SO-') || v.startsWith('PRE-')) return goSo(v)
    return goDealNo(v)
  }
  return { goSo, goDealNo, goRef }
}
