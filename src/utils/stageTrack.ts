import { execStages, financeStages, financeStageOf, isOrderClosed, type Order } from '../mock/data'

/*
 * 階段的共同視覺語法（列表階段欄、SO 抽屜行動列、Pipeline 階段條共用）：
 * 文字說「現在在哪一階段」、分段軌道說「整體走到哪」、色彩說「狀態正不正常」。
 * tone：initial 剛開始（灰）、normal 正常進行（teal）、waiting 等外部回應（amber）、complete 業務完成（olive）、
 *       closed 正式結案（olive 全滿＋勾號）、exception 合約變更中（原階段不變，當前格 amber 斜紋）。
 */
export type StageTone = 'initial' | 'normal' | 'waiting' | 'complete' | 'closed' | 'exception'
export type StageSize = 'cell' | 'drawer' | 'pipeline'

export function segmentClasses(total: number, current: number, tone: StageTone): string[] {
  return Array.from({ length: total }, (_, i) => {
    if (tone === 'closed') return 'stage-segment is-complete'
    if (i < current) return 'stage-segment is-complete'
    if (i === current) return tone === 'exception' ? 'stage-segment is-current is-exception' : 'stage-segment is-current'
    return 'stage-segment is-pending'
  })
}

/** 給 AG Grid 這類只能吐 HTML 字串的地方用；Vue 端用 StageTrack.vue，樣式都在 style.css */
export function stageTrackHtml(total: number, current: number, tone: StageTone, size: StageSize): string {
  return `<span class="stage-track stage-track--${size} tone-${tone}" style="--stage-count:${total}">${segmentClasses(total, current, tone).map((c) => `<i class="${c}"></i>`).join('')}</span>`
}

/** 執行階段的語氣：結案 → closed；合約變更 → exception；接單 → initial；全部出貨等驗收 → waiting；驗收 → complete */
export function execToneOf(o: Pick<Order, 'stageIndex' | 'milestones' | 'changeQuoteId'>): StageTone {
  if (isOrderClosed(o)) return 'closed'
  if (o.changeQuoteId) return 'exception'
  const name = execStages[o.stageIndex]
  if (name === '接單') return 'initial'
  if (name === '全部出貨') return 'waiting'
  if (name === '驗收') return 'complete'
  return 'normal'
}

/** 財務階段的語氣：全部收款 → complete（結案時 closed）；有期數等會計開票 → waiting；待請款 → initial */
export function finToneOf(o: Pick<Order, 'stageIndex' | 'milestones'>): StageTone {
  if (isOrderClosed(o)) return 'closed'
  const idx = financeStageOf(o.milestones)
  if (idx === financeStages.length - 1) return 'complete'
  if (o.milestones.some((m) => m.status === '已申請')) return 'waiting'
  if (idx === 0) return 'initial'
  return 'normal'
}
