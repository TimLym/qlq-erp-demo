import type { IDoesFilterPassParams, IFilterComp, IFilterParams } from 'ag-grid-community'

/*
 * 欄位標題上的勾選式篩選（AG Grid 自訂篩選）：列出幾個選項，勾了就只看符合任一個的列；選項旁顯示目前筆數。
 * 用在 SO 的「執行進度」「財務進度」：進度可以疊加，所以用「卡在哪」這類條件篩，一張單可以同時符合好幾個。
 */
export interface CheckFilterParams<T = unknown> {
  options: string[]
  match: (data: T, option: string) => boolean
}
export interface CheckFilterModel {
  values: string[]
}

export class CheckFilter<T = unknown> implements IFilterComp<T> {
  private params!: IFilterParams<T> & CheckFilterParams<T>
  private selected = new Set<string>()
  private gui!: HTMLDivElement

  init(params: IFilterParams<T> & CheckFilterParams<T>) {
    this.params = params
    this.gui = document.createElement('div')
    this.gui.className = 'check-filter'
    this.render()
  }

  private count(option: string) {
    let n = 0
    this.params.api.forEachNode((node) => {
      if (node.data && this.params.match(node.data, option)) n++
    })
    return n
  }

  private render() {
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    let total = 0
    this.params.api.forEachNode((node) => {
      if (node.data) total++
    })
    this.gui.innerHTML =
      `<p class="cf-head">全部 ${total} 筆中符合</p>` +
      this.params.options
        .map((o) => `<label class="cf-opt"><input type="checkbox" value="${esc(o)}"${this.selected.has(o) ? ' checked' : ''}><span>${esc(o)}</span><i>${this.count(o)}</i></label>`)
        .join('') + `<button type="button" class="cf-clear"${this.selected.size ? '' : ' disabled'}>清除</button>`
    this.gui.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((el) =>
      el.addEventListener('change', () => {
        if (el.checked) this.selected.add(el.value)
        else this.selected.delete(el.value)
        this.params.filterChangedCallback()
        this.gui.querySelector<HTMLButtonElement>('.cf-clear')!.disabled = !this.selected.size
      }),
    )
    this.gui.querySelector('.cf-clear')!.addEventListener('click', () => {
      this.selected.clear()
      this.params.filterChangedCallback()
      this.render()
    })
  }

  getGui() {
    return this.gui
  }

  afterGuiAttached() {
    this.render()
  }

  doesFilterPass(p: IDoesFilterPassParams<T>) {
    if (!this.selected.size || !p.data) return true
    return [...this.selected].some((o) => this.params.match(p.data!, o))
  }

  isFilterActive() {
    return this.selected.size > 0
  }

  getModel(): CheckFilterModel | null {
    return this.selected.size ? { values: [...this.selected] } : null
  }

  setModel(model: CheckFilterModel | null) {
    this.selected = new Set((model?.values ?? []).filter((v) => this.params.options.includes(v)))
    if (this.gui) this.render()
  }
}
