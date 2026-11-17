import { reactive } from 'vue'

/* 採購主管、業務最高主管目前公司沒有人，簽核時由代理人簽（簽核進度設定的節點上指定） */
export type Role = '業務' | '業務主管' | '業務最高主管' | '執行長' | '採購' | '採購主管' | '財務主管' | '會計' | '工程主管' | '工程師' | '系統管理員'

export interface User {
  id: string
  name: string
  role: Role
  dept: string
  /** 工程師的技能標籤，派工時參考 */
  skills?: string[]
}

export const users: User[] = [
  { id: 'u-chen', name: '陳冠宇', role: '業務', dept: '北區業務' },
  { id: 'u-lin', name: '林雅婷', role: '業務主管', dept: '北區業務' },
  { id: 'u-chang', name: '張怡君', role: '業務主管', dept: '南區業務' },
  { id: 'u-wang', name: '王承恩', role: '執行長', dept: '經營管理' },
  { id: 'u-huang', name: '黃彥霖', role: '採購', dept: '採購' },
  { id: 'u-liu', name: '劉欣怡', role: '財務主管', dept: '財務' },
  { id: 'u-tsai', name: '蔡宗翰', role: '會計', dept: '財務' },
  { id: 'u-eng-mgr', name: '王志明', role: '工程主管', dept: '工程部' },
  { id: 'u-eng-lee', name: '李柏翰', role: '工程師', dept: '工程部', skills: ['Fortinet', '網路'] },
  { id: 'u-eng-wu', name: '吳佳蓉', role: '工程師', dept: '工程部', skills: ['EDR', 'CrowdStrike'] },
  { id: 'u-eng-chen', name: '陳志豪', role: '工程師', dept: '工程部', skills: ['Fortinet', 'SD-WAN'] },
]

export interface CustomerDept {
  name: string
  contact?: string
  phone?: string
  email?: string
}

export interface Customer {
  id: string
  name: string
  /** 統一編號，唯一鍵 */
  taxId: string
  industry: string
  type: '終端客戶' | '中間商'
  address?: string
  depts: CustomerDept[]
  ownerId?: string
  owner?: string
  note?: string
  status: '正常' | '停用'
  createdAt: string
  updatedAt?: string
  /** 付款條件：月結天數（30／60／120），請款條件填預計開票日時自動帶預計付款日 */
  payDays?: number
}

export const customers: Customer[] = reactive([
  { id: 'c1', payDays: 60, name: '崇光醫療體系', taxId: '04595257', industry: '醫療', type: '終端客戶', address: '台北市信義區醫療路 1 號', depts: [{ name: '資訊室', contact: '張主任', phone: '02-2700-1111', email: 'it@skmed.example' }, { name: '護理部', contact: '林督導', phone: '02-2700-1200' }], ownerId: 'u-chen', owner: '陳冠宇', note: '採購流程需經總務處議價', status: '正常', createdAt: '2025-03-12T09:00:00+08:00' },
  { id: 'c2', payDays: 30, name: '北辰物流', taxId: '27942366', industry: '物流', type: '終端客戶', address: '桃園市蘆竹區物流一路 88 號', depts: [{ name: '總管理處', contact: '王協理', phone: '03-322-5566' }, { name: '資訊部', contact: '陳經理', email: 'mis@bcl.example' }], ownerId: 'u-chen', owner: '陳冠宇', status: '正常', createdAt: '2024-11-05T09:00:00+08:00' },
  { id: 'c3', payDays: 120, name: '晴川商業銀行', taxId: '03710901', industry: '金融', type: '終端客戶', address: '台北市中山區銀行街 10 號', depts: [{ name: '資安處', contact: '李處長', phone: '02-2500-8800' }], ownerId: 'u-chen', owner: '陳冠宇', note: '金融業，上線前需資安檢核文件', status: '正常', createdAt: '2023-06-20T09:00:00+08:00' },
  { id: 'c4', payDays: 60, name: '立德大學', taxId: '52003521', industry: '教育', type: '終端客戶', address: '新竹市東區大學路 1 號', depts: [{ name: '計算機中心', contact: '黃組長', email: 'cc@lide.example' }], ownerId: 'u-chen', owner: '陳冠宇', status: '正常', createdAt: '2025-01-15T09:00:00+08:00' },
  { id: 'c5', payDays: 30, name: '鴻鼎精密', taxId: '84149710', industry: '製造', type: '終端客戶', address: '台中市西屯區精密路 66 號', depts: [{ name: '研發處', contact: '吳副理' }], ownerId: 'u-chen', owner: '陳冠宇', status: '正常', createdAt: '2026-09-28T09:00:00+08:00' },
  { id: 'c6', payDays: 30, name: '台灣聯合租賃', taxId: '23456789', industry: '租賃', type: '終端客戶', depts: [{ name: '資訊部', contact: '何經理', phone: '02-8780-1234' }], ownerId: 'u-lin', owner: '林雅婷', status: '正常', createdAt: '2024-05-08T09:00:00+08:00' },
  { id: 'c7', payDays: 30, name: '國昌建設', taxId: '16661222', industry: '營建', type: '終端客戶', depts: [{ name: '資訊部', contact: '周先生' }], ownerId: 'u-chen', owner: '陳冠宇', status: '正常', createdAt: '2026-05-30T09:00:00+08:00' },
  { id: 'c8', payDays: 60, name: '新光工程顧問', taxId: '70795122', industry: '工程顧問', type: '終端客戶', depts: [{ name: '管理部' }], ownerId: 'u-chen', owner: '陳冠宇', note: '2026-09 未成交，選擇其他代理商', status: '正常', createdAt: '2026-08-18T09:00:00+08:00' },
  { id: 'c9', name: '宏遠系統整合', taxId: '12345678', industry: '系統整合（中間商）', type: '中間商', address: '台北市內湖區科技路 200 號', depts: [{ name: '採購部', contact: '郭經理', phone: '02-2790-3000' }], ownerId: 'u-chen', owner: '陳冠宇', note: '北辰物流桃園轉運中心案的中間商', status: '正常', createdAt: '2025-09-01T09:00:00+08:00' },
])

export type PipelineStage = '規劃預算' | '報價階段' | '簡報' | 'POC中' | 'Pending' | '專案規劃' | '前置文件' | '議價' | '待接單' | 'SO已成立' | '未成交'
export const pipelineStages: PipelineStage[] = ['規劃預算', '報價階段', '簡報', 'POC中', 'Pending', '專案規劃', '前置文件', '議價', '待接單', 'SO已成立', '未成交']
/** 改階段時自動帶入的預設成交機率 */
/** 階段對應的成交機率：改階段時自動帶入 */
/** SO已成立是系統狀態：上單送審核准、SO 成立後自動帶入，使用者不能選 */
export const stageDefaultProb: Record<PipelineStage, number> = { 規劃預算: 0, 報價階段: 0.1, 簡報: 0.2, POC中: 0.4, Pending: 0.5, 專案規劃: 0.6, 前置文件: 0.7, 議價: 0.8, 待接單: 0.9, SO已成立: 0.95, 未成交: 0 }

/** 技術服務單：一個商機多張（T01、T02…），各自派工、各自狀態。已派工在畫面顯示「進行中」 */
/** 待接受：已派人，等工程師本人接受（婉拒退回重派）；全部接受才是已派工（進行中） */
export type EngStatus = '待派工' | '待接受' | '已派工' | '已完成' | '已退回' | '已取消'
export interface EngRequest {
  id: string
  /** 商機編號加流水號，例 D-2026-0928-002-T01；取消也不回收 */
  requestNo: string
  status: EngStatus
  type: '售前諮詢' | 'POC' | '現場勘查' | '部署' | '其他'
  title: string
  desc: string
  dueDate: string
  urgent: boolean
  requestedById: string
  requestedBy: string
  requestedAt: string
  assigneeIds: string[]
  assignedAt?: string
  assignedById?: string
  assignNote?: string
  /** 完成時由工程師填：服務內容、到場時間；completedAt 是完成時間 */
  workSummary?: string
  arrivedAt?: string
  completedAt?: string
  rejectReason?: string
  cancelReason?: string
  /** 工程主管先派給某一組，由組長再派人 */
  groupId?: string
  /** 已接受的工程師（待接受時用；已派工、已完成視為全部接受） */
  acceptedIds?: string[]
  /** 婉拒紀錄 */
  declines?: { userId: string; reason: string; at: string }[]
  /** 業務開單時建議的工程師與理由（非必填，主管派工參考） */
  suggestedId?: string
  suggestReason?: string
  /** 對應的自有工程項次（訂單成立時自動開的部署服務單）；有值的才算訂單的工程進度 */
  lineNo?: number
}

/** 工程組：工程主管可以派給組，由組長派人 */
export interface EngGroup {
  id: string
  name: string
  leaderId: string
  memberIds: string[]
}
export const engGroups: EngGroup[] = [
  { id: 'g-net', name: '網路資安組', leaderId: 'u-eng-lee', memberIds: ['u-eng-lee', 'u-eng-chen'] },
  { id: 'g-edr', name: '端點組', leaderId: 'u-eng-wu', memberIds: ['u-eng-wu'] },
]

/** 商機協作成員：被拉進來的人可以看留言、被 @、上傳其他附件，看不到金額與報價單 */
export interface DealMember {
  dealId: string
  userId: string
  kind: '協作成員' | '工程師'
  addedById: string
  addedAt: string
  /** 工程師因哪些服務單在商機裡；全部結案就離開成員 */
  engRequestIds?: string[]
}

export interface Deal {
  id: string
  dealNo: string
  customer: string
  customerDept: string
  endUser?: string
  via: '直接交易' | '中間商'
  /** 賣什麼：新購、授權、維護、服務 */
  kind: '新購' | '授權' | '維護' | '服務'
  /** 續約自哪一筆商機（有值就是續約案）；SO 編號從原商機的訂單讀 */
  renewalOfDealId?: string
  renewalReason?: '到期續簽' | '擴充' | '升級'
  /** 續約項目：原 SO 裡要續的序號；多個到期日不同就是 co-term */
  renewalItems?: string[]
  ownerId: string
  owner: string
  dept: string
  prob: number
  amount: number
  stage: PipelineStage
  updatedAt: string
  expectClose: string
  nextAction: string
  poc?: string
  lostReason?: string
  /** 有工程支援申請（含已完成）；實際狀態看 eng */
  needsEng: boolean
  /** 技術服務單：業務開單 → 工程主管逐張派工 → 完成；退回可補件重送，取消不重開 */
  engRequests?: EngRequest[]
  preOrder: boolean
  prepay: boolean
  /** 已提出的預付款簽核單 */
  prepayApprovalId?: string
  quoteVersions: number
  product: string
  /** 承辦人：客戶端發起需求的人（沒填就用客戶主檔該部門的聯絡人）；防撞以承辦人為主 */
  contact?: string
  /** 撞單硬要建立：和哪一筆進行中的商機同承辦人；送審時加業務最高主管裁決 */
  collision?: { withDealId: string; at: string }
  /** 階段最後一次變動的時間（閒置判斷：三個月階段沒變）；沒有就看 updatedAt */
  stageAt?: string
  /** 下一步歷史：每次改下一步留一筆 */
  nextHistory?: { at: string; by: string; text: string }[]
  /** 閒置通知已發（避免重複通知） */
  idleNotifiedAt?: string
}

export const deals: Deal[] = reactive([
  {
    id: 'd1', dealNo: 'D-2026-0914-003', customer: '崇光醫療體系', customerDept: '資訊室', via: '直接交易', kind: '新購',
    ownerId: 'u-chen', owner: '陳冠宇', dept: '北區業務', prob: 0.9, amount: 2_410_000, stage: '待接單',
    updatedAt: '2026-10-07T16:20:00+08:00', expectClose: '2026-10-20', nextAction: '等客戶回簽報價單，週五前追',
    nextHistory: [
      { at: '2026-09-15T09:30:00+08:00', by: '陳冠宇', text: '約資訊室主任看 HA 架構' },
      { at: '2026-09-30T17:00:00+08:00', by: '陳冠宇', text: '報價 v1 送出，等內部簽呈' },
      { at: '2026-10-07T16:20:00+08:00', by: '陳冠宇', text: '等客戶回簽報價單，週五前追' },
    ],
    poc: 'POC 完成，防火牆吞吐量符合需求', needsEng: true, preOrder: false, prepay: true, prepayApprovalId: 'a6', quoteVersions: 1,
    engRequests: [
      { id: 'er-003-T01', requestNo: 'D-2026-0914-003-T01', status: '已完成', type: 'POC', title: 'HA 切換與政策移轉驗證', desc: '兩台 200F 做 HA 切換測試，驗證既有政策移轉後吞吐量', dueDate: '2026-09-12', urgent: false, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-08-28T10:00:00+08:00', assigneeIds: ['u-eng-wu'], assignedAt: '2026-08-29T09:00:00+08:00', assignedById: 'u-eng-mgr', arrivedAt: '2026-09-12T09:30:00+08:00', completedAt: '2026-09-12T17:00:00+08:00', workSummary: '兩台 200F 完成 HA 切換測試三次，政策移轉後吞吐量 1.8 Gbps，符合需求' },
      { id: 'er-003-T02', requestNo: 'D-2026-0914-003-T02', status: '已完成', type: '現場勘查', title: '機櫃與線路確認', desc: '確認機櫃空間、電源、交換器介接與上架動線', dueDate: '2026-09-25', urgent: false, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-09-18T10:00:00+08:00', assigneeIds: ['u-eng-lee'], assignedAt: '2026-09-19T09:00:00+08:00', assignedById: 'u-eng-mgr', arrivedAt: '2026-09-25T14:00:00+08:00', completedAt: '2026-09-25T16:00:00+08:00', workSummary: '機櫃 42U 剩 6U 可用，電源與交換器介接確認，上架動線無問題' },
      { id: 'er-003-T03', requestNo: 'D-2026-0914-003-T03', status: '已派工', type: '部署', title: '總院 HA 部署', desc: 'HA 主機上架與既有政策移轉，含交換器', dueDate: '2026-11-05', urgent: false, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-09-20T10:00:00+08:00', assigneeIds: ['u-eng-lee'], assignedAt: '2026-09-22T09:30:00+08:00', assignedById: 'u-eng-mgr', assignNote: '部署時間跟客戶再約' },
    ],
    product: 'FortiGate 200F 高可用組 + 3 年 UTP',
  },
  {
    id: 'd2', dealNo: 'D-2026-0922-001', customer: '北辰物流', customerDept: '總管理處', endUser: '北辰物流 桃園轉運中心', via: '中間商', kind: '新購',
    ownerId: 'u-chen', owner: '陳冠宇', dept: '北區業務', prob: 0.95, amount: 880_000, stage: 'SO已成立',
    updatedAt: '2026-10-06T11:05:00+08:00', expectClose: '2026-11-05', nextAction: '合約變更 v2 等客戶回簽，回簽後重審送審',
    needsEng: true, preOrder: false, prepay: false, quoteVersions: 2,
    engRequests: [
      { id: 'er-d2-T01', requestNo: 'SO-2026-1001-013-T01', lineNo: 3, status: '待派工', type: '部署', title: '安裝建置與政策移轉', desc: '訂單成立自動開立：對應項次 3「安裝建置與政策移轉」', dueDate: '2026-11-28', urgent: false, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-10-01T10:00:00+08:00', assigneeIds: [] },
    ],
    product: 'Palo Alto PA-440 x2 + Threat Prevention',
  },
  {
    id: 'd3', dealNo: 'D-2026-0901-007', customer: '晴川商業銀行', customerDept: '資安處', via: '直接交易', kind: '授權',
    ownerId: 'u-chen', owner: '陳冠宇', dept: '北區業務', prob: 0.9, amount: 1_320_000, stage: '待接單',
    updatedAt: '2026-10-05T09:40:00+08:00', expectClose: '2026-10-10', nextAction: '上單簽核中，採購稽核成本',
    needsEng: false, preOrder: true, prepay: false, quoteVersions: 1,
    product: 'FortiAnalyzer 續約 + 原廠維護 1 年',
  },
  {
    id: 'd4', dealNo: 'D-2026-0928-002', customer: '立德大學', customerDept: '計算機中心', via: '直接交易', kind: '新購',
    ownerId: 'u-chen', owner: '陳冠宇', dept: '北區業務', prob: 0.4, amount: 3_900_000, stage: 'POC中',
    updatedAt: '2026-10-07T18:00:00+08:00', expectClose: '2026-12-15', nextAction: '10/14 到校進行 EDR 試用部署',
    poc: '試用 200 端點，兩週', needsEng: true, preOrder: false, prepay: false, quoteVersions: 1,
    engRequests: [
      { id: 'er-002-T01', suggestedId: 'u-eng-wu', suggestReason: '去年立德的 EDR 規劃是她做的，熟校方環境', requestNo: 'D-2026-0928-002-T01', status: '待派工', type: 'POC', title: 'EDR 試用部署', desc: 'POC 兩週：部署 200 端點 EDR、匯出報表給校方', dueDate: '2026-10-14', urgent: true, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-10-06T14:00:00+08:00', assigneeIds: [] },
      { id: 'er-002-T02', groupId: 'g-net', requestNo: 'D-2026-0928-002-T02', status: '待派工', type: '現場勘查', title: '校園網路與 AD 確認', desc: '確認校方 AD、網路區段與測試教室位置', dueDate: '2026-10-12', urgent: false, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-10-07T09:30:00+08:00', assigneeIds: [] },
    ],
    product: 'CrowdStrike Falcon 1,500 端點',
  },
  {
    id: 'd5', dealNo: 'D-2026-1002-004', customer: '鴻鼎精密', customerDept: '研發處', via: '直接交易', kind: '新購',
    ownerId: 'u-chen', owner: '陳冠宇', dept: '北區業務', prob: 0, amount: 560_000, stage: '規劃預算',
    updatedAt: '2026-10-03T14:30:00+08:00', stageAt: '2026-07-21T10:00:00+08:00', expectClose: '2026-11-30', nextAction: '確認 OT 網段隔離需求，約 10/16 訪談',
    nextHistory: [
      { at: '2026-07-21T10:00:00+08:00', by: '陳冠宇', text: '研發處提出 OT 網段需求，安排初訪' },
      { at: '2026-08-26T15:20:00+08:00', by: '陳冠宇', text: '客戶預算延到第四季，九月再追' },
      { at: '2026-10-03T14:30:00+08:00', by: '陳冠宇', text: '確認 OT 網段隔離需求，約 10/16 訪談' },
    ],
    needsEng: true, preOrder: false, prepay: false, quoteVersions: 0,
    engRequests: [
      { id: 'er-004-T01', requestNo: 'D-2026-1002-004-T01', status: '已退回', type: '現場勘查', title: 'OT 防火牆現場勘查', desc: '研發處 OT 區段防火牆現場勘查', dueDate: '2026-10-20', urgent: false, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-10-03T11:00:00+08:00', assigneeIds: [], rejectReason: '需求範圍與現場拓樸未附，請補上再送' },
      { id: 'er-004-T02', requestNo: 'D-2026-1002-004-T02', status: '已取消', type: '售前諮詢', title: 'OT 網路規劃諮詢', desc: 'OT 與 IT 分段規劃建議', dueDate: '2026-10-15', urgent: false, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-10-03T11:10:00+08:00', assigneeIds: [], cancelReason: '客戶改由原維運商提供規劃' },
    ],
    product: '工控防火牆 FortiGate Rugged 60F',
  },
  {
    id: 'd6', dealNo: 'D-2026-0915-005', customer: '崇光醫療體系', customerDept: '護理部', via: '直接交易', kind: '新購',
    ownerId: 'u-lin', owner: '林雅婷', dept: '北區業務', prob: 0.1, amount: 600_000, stage: '報價階段',
    updatedAt: '2026-10-06T17:10:00+08:00', expectClose: '2026-10-31', nextAction: '補 NAC 授權數量後更新報價',
    needsEng: false, preOrder: false, prepay: false, quoteVersions: 1,
    product: 'FortiNAC 500 端點授權 + FortiAP 231F x10',
  },
  {
    id: 'd7', dealNo: 'D-2026-0820-001', customer: '台灣聯合租賃', customerDept: '資訊部', via: '直接交易', kind: '授權',
    ownerId: 'u-lin', owner: '林雅婷', dept: '北區業務', prob: 0.95, amount: 640_000, stage: 'SO已成立',
    updatedAt: '2026-09-29T10:00:00+08:00', expectClose: '2026-09-30', nextAction: 'SO 成立，等原廠授權序號',
    needsEng: false, preOrder: false, prepay: false, quoteVersions: 1,
    product: 'Sophos XGS 2100 續約 2 年',
  },
  {
    id: 'd8', dealNo: 'D-2026-0930-006', customer: '北辰物流', customerDept: '資訊部', via: '直接交易', kind: '新購',
    ownerId: 'u-lin', owner: '林雅婷', dept: '北區業務', prob: 0.8, amount: 1_150_000, stage: '議價',
    updatedAt: '2026-10-07T09:15:00+08:00', expectClose: '2026-11-20', nextAction: '客戶要求 SD-WAN 方案比較',
    needsEng: true, preOrder: true, prepay: false, quoteVersions: 1,
    engRequests: [
      { id: 'er-006-T01', requestNo: 'D-2026-0930-006-T01', status: '已完成', type: '現場勘查', title: '六分點線路確認', desc: '六個分點線路與設備位置確認', dueDate: '2026-09-30', urgent: false, requestedById: 'u-lin', requestedBy: '林雅婷', requestedAt: '2026-09-22T09:00:00+08:00', assigneeIds: ['u-eng-wu'], assignedAt: '2026-09-23T10:00:00+08:00', assignedById: 'u-eng-mgr', arrivedAt: '2026-09-30T09:00:00+08:00', completedAt: '2026-09-30T18:00:00+08:00', workSummary: '六個分點線路與設備位置確認完成，兩個分點需加裝 PoE 交換器' },
      { id: 'er-006-T02', requestNo: 'D-2026-0930-006-T02', lineNo: 3, status: '已派工', type: '部署', title: '六分點 SD-WAN 安裝', desc: '六分點 SD-WAN 安裝與設定', dueDate: '2026-11-20', urgent: false, requestedById: 'u-lin', requestedBy: '林雅婷', requestedAt: '2026-10-02T09:00:00+08:00', assigneeIds: ['u-eng-lee'], assignedAt: '2026-10-03T10:00:00+08:00', assignedById: 'u-eng-mgr' },
      { id: 'er-006-T03', acceptedIds: [], requestNo: 'D-2026-0930-006-T03', status: '待接受', type: '售前諮詢', title: '第三分點 VPN 走法', desc: '第三分點 VPN 路由與切換方式確認，回覆客戶', dueDate: '2026-10-15', urgent: false, requestedById: 'u-lin', requestedBy: '林雅婷', requestedAt: '2026-10-05T09:00:00+08:00', assigneeIds: ['u-eng-wu'], assignedAt: '2026-10-05T11:00:00+08:00', assignedById: 'u-eng-mgr' },
    ],
    product: 'FortiGate 100F x6 SD-WAN',
  },
  {
    id: 'd9', dealNo: 'D-2026-0905-002', customer: '新光工程顧問', customerDept: '管理部', via: '直接交易', kind: '新購',
    ownerId: 'u-chen', owner: '陳冠宇', dept: '北區業務', prob: 0, amount: 310_000, stage: '未成交',
    updatedAt: '2026-09-26T15:45:00+08:00', expectClose: '2026-09-30', nextAction: '客戶選擇其他代理商，價差 8%',
    needsEng: false, preOrder: false, prepay: false, quoteVersions: 1,
    product: 'FortiGate 60F x3',
  },
  {
    id: 'd10', dealNo: 'D-2026-0620-002', customer: '國昌建設', customerDept: '資訊部', via: '直接交易', kind: '新購',
    ownerId: 'u-chen', owner: '陳冠宇', dept: '北區業務', prob: 0.95, amount: 1_080_000, stage: 'SO已成立',
    updatedAt: '2026-07-15T10:00:00+08:00', expectClose: '2026-07-15', nextAction: '已出貨，等客戶簽收',
    needsEng: true, preOrder: false, prepay: false, quoteVersions: 1,
    engRequests: [
      { id: 'er-002-T01', requestNo: 'D-2026-0620-002-T01', lineNo: 3, status: '已完成', type: '部署', title: '防火牆主機安裝', desc: '防火牆主機安裝與授權啟用', dueDate: '2026-08-15', urgent: false, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-07-05T10:00:00+08:00', assigneeIds: ['u-eng-lee'], assignedAt: '2026-07-06T09:00:00+08:00', assignedById: 'u-eng-mgr', arrivedAt: '2026-08-14T10:00:00+08:00', completedAt: '2026-08-14T17:00:00+08:00', workSummary: '防火牆主機安裝上架、授權啟用、政策匯入並驗證通過' },
      { id: 'er-002-T02', requestNo: 'D-2026-0620-002-T02', status: '已派工', type: '其他', title: '上線後健檢', desc: '檢查授權、告警與備份設定', dueDate: '2026-11-06', urgent: false, requestedById: 'u-chen', requestedBy: '陳冠宇', requestedAt: '2026-10-01T10:00:00+08:00', assigneeIds: ['u-eng-wu'], assignedAt: '2026-10-02T09:00:00+08:00', assignedById: 'u-eng-mgr' },
    ],
    product: 'FortiGate 100F x2 + UTP 3 年',
  },
  {
    id: 'd11', dealNo: 'D-2026-0410-004', customer: '立德大學', customerDept: '計算機中心', via: '直接交易', kind: '新購',
    ownerId: 'u-lin', owner: '林雅婷', dept: '北區業務', prob: 0.95, amount: 480_000, stage: 'SO已成立',
    updatedAt: '2026-05-20T10:00:00+08:00', expectClose: '2026-05-15', nextAction: '已結案；2027-05 到期前續約',
    needsEng: false, preOrder: false, prepay: false, quoteVersions: 1,
    product: 'Sophos Central 教育授權 800 端點',
  },
  {
    id: 'd12', dealNo: 'D-2026-1007-001', customer: '立德大學', customerDept: '計算機中心', via: '直接交易', kind: '授權',
    renewalOfDealId: 'd11', renewalReason: '到期續簽', renewalItems: ['lic-o4-1'],
    ownerId: 'u-lin', owner: '林雅婷', dept: '北區業務', prob: 0.1, amount: 450_000, stage: '報價階段',
    updatedAt: '2026-10-07T11:20:00+08:00', expectClose: '2027-05-15', nextAction: '原廠續約報價 2027-03 出，先確認端點數有沒有增加',
    needsEng: false, preOrder: false, prepay: false, quoteVersions: 0,
    product: 'Sophos Central 教育授權 800 端點 續約 1 年',
  },
  {
    id: 'd13', dealNo: 'D-2026-1015-003', customer: '國昌建設', customerDept: '資訊部', via: '直接交易', kind: '新購',
    ownerId: 'u-chen', owner: '陳冠宇', dept: '北區業務', prob: 0.8, amount: 210_000, stage: '議價',
    updatedAt: '2026-10-22T16:00:00+08:00', expectClose: '2026-11-15', nextAction: '客戶要求 60F 單價再降，等原廠回覆專案價',
    needsEng: false, preOrder: false, prepay: false, quoteVersions: 1,
    product: '工地監控網段 FortiGate 60F x4',
  },
  {
    id: 'd14', dealNo: 'D-2026-1012-005', customer: '立德大學', customerDept: '計算機中心', via: '直接交易', kind: '新購',
    ownerId: 'u-lin', owner: '林雅婷', dept: '北區業務', prob: 0.7, amount: 1_600_000, stage: '前置文件',
    updatedAt: '2026-10-25T11:00:00+08:00', expectClose: '2026-12-20', nextAction: '總務處 12 月開標，開標後正式下單',
    needsEng: false, preOrder: false, prepay: false, quoteVersions: 1,
    product: 'Sophos XGS 4500 校園防火牆汰換',
  },
])

/** 對外項次：客戶看得到的品項與報價（未稅） */
export interface QuoteItem {
  no: number
  /** 對客戶 SKU */
  custSku: string
  /** 對客戶產品名稱 */
  custName: string
  desc: string
  qty: number
  /** 未稅單價；含稅發起時由含稅單價換算（可能有小數，合計再四捨五入） */
  unitPrice: number
  /** 含稅發起時業務輸入的含稅單價 */
  unitPriceTax?: number
}

/** 內部項次：對應某個對外項次，給採購與成本用；一個對外項次可以配多個內部項次 */
export interface QuoteLine {
  no: number
  /** 對應的對外項次 */
  itemNo: number
  /** 內部產品名稱（PO 與庫存用） */
  extName: string
  /** 原廠 SKU */
  vendorSku: string
  intSku: string
  qty: number
  /** 供應商：草稿勾「自有工程」或上傳廠商報價單時決定；還沒決定是空字串 */
  vendor: string
  /** 業務填寫的未稅單位成本（採購部分），尚未填則為 null */
  unitCost: number | null
  vendorQuoteFile?: string
  /** 廠商還在議價：送審時和「已上傳報價單」二擇一，簽核畫面標出來讓採購知道 */
  bargaining?: boolean
  /** 這個項次有多少數量改用公司庫存（成本依品項參考成本，不是批次成本） */
  stockQty?: number
  /** 庫存夠卻堅持另行採購的理由，主管裁決 */
  insistReason?: string
  /** 項次性質：硬體→出貨後產生保固；授權→出貨時登錄到期；維護合約／服務合約→SO 成立產生到期項目，驗收起算；單次服務（教育訓練、安裝）不產生到期項目 */
  nature?: LineNature
  /** 期間（月）：授權、維護合約、服務合約用 */
  months?: number
}

export type LineNature = '硬體' | '授權' | '維護合約' | '服務合約' | '單次服務'
/** 會產生到期項目的性質（單次服務不會） */
export const hasExpiry = (n: LineNature) => n !== '單次服務'
/** 沒填性質的舊資料用品名與料號推 */
export function natureOf(l: Pick<QuoteLine, 'nature' | 'extName' | 'intSku'>): LineNature {
  if (l.nature) return l.nature
  if (/維護|保固|MA\b|Support|FortiCare/i.test(l.extName)) return '維護合約'
  if (/顧問|代管|託管|SLA|服務合約|年度服務/i.test(l.extName)) return '服務合約'
  if (/授權|License|RNW|續約|端點|-\d+$/i.test(l.extName) || /SDW|UTP|TP-|RNW|EDU|INSIGHT/i.test(l.intSku)) return '授權'
  if (/安裝|部署|建置|服務|勘查|健檢|訓練|導入/i.test(l.extName) || /^SVC-/i.test(l.intSku)) return '單次服務'
  return '硬體'
}
/** 加月數（YYYY-MM-DD） */
export function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export function addMonths(ymd: string, months: number): string {
  const d = new Date(ymd)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}
/** 硬體保固月數（依料號，沒設定就 36） */
export const warrantyMonths: Record<string, number> = reactive({ 'FTN-FG100F': 36, 'FTN-FG60F': 36, 'FTN-FG200F': 36, 'FTN-FS148F': 60, 'SPH-XGS2100': 36 })
export const warrantyOf = (sku: string) => warrantyMonths[sku] ?? 36
/** 到期類型：系統管理員維護；預設提醒天數可在個人設定覆寫 */
export interface ExpiryKind {
  key: string
  label: string
  defaultRemindDays: number
}
export const expiryKinds: ExpiryKind[] = reactive([
  { key: '授權', label: '授權', defaultRemindDays: 90 },
  { key: '保固', label: '保固', defaultRemindDays: 60 },
  { key: '維護合約', label: '維護合約', defaultRemindDays: 120 },
  { key: '服務合約', label: '服務合約', defaultRemindDays: 120 },
])

export interface Quote {
  id: string
  dealId: string
  version: number
  date: string
  /** 草稿可改；客戶回簽後成為「報價回簽」，內容鎖定 */
  status: '草稿' | '報價回簽'
  /** 上單送審送出的時間；有值表示這版已鎖定送審 */
  submittedAt?: string
  items: QuoteItem[]
  lines: QuoteLine[]
  note?: string
  /** 上單送審：客戶回簽檔、送審理由、請款條件 */
  signbackFile?: string
  submitReason?: string
  milestones?: Milestone[]
  draftSavedAt?: string
  /** 未稅發起（預設）或含稅發起：含稅發起時合計以含稅加總，未稅由含稅總額換算，避免逐項換算的尾差 */
  taxMode?: '未稅' | '含稅'
}

export const TAX_RATE = 0.05
type TaxQuote = Pick<Quote, 'items'> & { taxMode?: Quote['taxMode'] }
/** 售價合計（未稅）：對外項次；含稅發起時＝含稅總計 ÷ 1.05 四捨五入 */
export const quoteTotal = (q: TaxQuote) =>
  q.taxMode === '含稅' ? Math.round(q.items.reduce((s, i) => s + i.qty * (i.unitPriceTax ?? 0), 0) / (1 + TAX_RATE)) : q.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
/** 含稅總計：含稅發起時直接加總含稅單價；未稅發起時未稅合計 × 1.05 四捨五入 */
export const quoteTaxTotal = (q: TaxQuote) =>
  q.taxMode === '含稅' ? q.items.reduce((s, i) => s + i.qty * (i.unitPriceTax ?? 0), 0) : Math.round(quoteTotal(q) * (1 + TAX_RATE))
/** 單一對外項次的含稅小計 */
export const itemTaxTotal = (q: Pick<Quote, 'taxMode'>, i: QuoteItem) => (q.taxMode === '含稅' ? i.qty * (i.unitPriceTax ?? 0) : Math.round(i.qty * i.unitPrice * (1 + TAX_RATE)))
/** 內部項次的成本：用庫存的部分依品項參考成本，採購部分依業務填的成本 */
export function lineCost(l: QuoteLine): number {
  const stockPart = Math.min(l.stockQty ?? 0, l.qty)
  return stockPart * (transferOf(l.intSku) ?? 0) + (l.qty - stockPart) * (l.unitCost ?? 0)
}
export const quoteCost = (q: Pick<Quote, 'lines'>) => q.lines.reduce((s, l) => s + lineCost(l), 0)

/** 種子資料：一列同時是對外與內部項次，轉成兩層（示範一對多的版本另外手寫） */
interface FlatLine { no: number; extName: string; vendorSku: string; intSku: string; qty: number; unitPrice: number; vendor: string; unitCost: number | null; vendorQuoteFile?: string; nature?: LineNature; months?: number }
function flat(lines: FlatLine[]): Pick<Quote, 'items' | 'lines'> {
  return {
    items: lines.map((l) => ({ no: l.no, custSku: l.vendorSku === '-' ? '' : l.vendorSku, custName: l.extName, desc: '', qty: l.qty, unitPrice: l.unitPrice })),
    lines: lines.map((l) => ({ no: l.no, itemNo: l.no, extName: l.extName, vendorSku: l.vendorSku, intSku: l.intSku, qty: l.qty, vendor: l.vendor, unitCost: l.unitCost, vendorQuoteFile: l.vendorQuoteFile, nature: l.nature, months: l.months })),
  }
}

export const dealMembers: DealMember[] = reactive([
  { dealId: 'd1', userId: 'u-huang', kind: '協作成員', addedById: 'u-chen', addedAt: '2026-09-25T10:00:00+08:00' },
  { dealId: 'd1', userId: 'u-eng-wu', kind: '工程師', addedById: 'u-eng-mgr', addedAt: '2026-08-29T09:00:00+08:00', engRequestIds: ['er-003-T01'] },
  { dealId: 'd1', userId: 'u-eng-lee', kind: '工程師', addedById: 'u-eng-mgr', addedAt: '2026-09-19T09:00:00+08:00', engRequestIds: ['er-003-T02', 'er-003-T03'] },
  { dealId: 'd3', userId: 'u-tsai', kind: '協作成員', addedById: 'u-chen', addedAt: '2026-10-01T15:00:00+08:00' },
  { dealId: 'd8', userId: 'u-eng-lee', kind: '工程師', addedById: 'u-eng-mgr', addedAt: '2026-10-03T10:00:00+08:00', engRequestIds: ['er-006-T02'] },
  { dealId: 'd8', userId: 'u-eng-wu', kind: '工程師', addedById: 'u-eng-mgr', addedAt: '2026-09-23T10:00:00+08:00', engRequestIds: ['er-006-T01', 'er-006-T03'] },
  { dealId: 'd10', userId: 'u-eng-lee', kind: '工程師', addedById: 'u-eng-mgr', addedAt: '2026-07-06T09:00:00+08:00', engRequestIds: ['er-002-T01'] },
  { dealId: 'd10', userId: 'u-eng-wu', kind: '工程師', addedById: 'u-eng-mgr', addedAt: '2026-10-02T09:00:00+08:00', engRequestIds: ['er-002-T02'] },
])

export const quotes: Quote[] = reactive([
  {
    id: 'q1-1', dealId: 'd1', version: 1, date: '2026-10-03', status: '草稿',
    items: [
      { no: 1, custSku: 'FG-200F-HA', custName: '次世代防火牆主機 200F（HA 一組）', desc: '含 HA 線材與上架', qty: 2, unitPrice: 495_000 },
      { no: 2, custSku: 'FC-10-F200F-950-02-36', custName: 'UTP 威脅防護授權 3 年', desc: '', qty: 2, unitPrice: 590_000 },
      { no: 3, custSku: '', custName: '安裝建置與移轉服務', desc: '含舊設備政策移轉', qty: 1, unitPrice: 150_000 },
      { no: 4, custSku: 'FS-148F-POE', custName: '核心交換器 48 埠 PoE', desc: '', qty: 2, unitPrice: 45_000 },
    ],
    lines: [
      { no: 1, itemNo: 1, extName: '次世代防火牆主機 200F', vendorSku: 'FG-200F', intSku: 'FTN-FG200F', qty: 2, vendor: '原廠台灣總代理 A', unitCost: 430_000, vendorQuoteFile: 'A-Quote-20260930.pdf' },
      { no: 2, itemNo: 1, extName: 'HA 線材與上架套件', vendorSku: 'SP-CABLE-HA', intSku: 'FTN-HA-KIT', qty: 2, vendor: '原廠台灣總代理 A', unitCost: 6_000, vendorQuoteFile: 'A-Quote-20260930.pdf' },
      { no: 3, itemNo: 2, extName: 'UTP 威脅防護授權 3 年', vendorSku: 'FC-10-F200F-950-02-36', intSku: 'FTN-UTP-200F-36', qty: 2, months: 36, vendor: '原廠台灣總代理 A', unitCost: 530_000, vendorQuoteFile: 'A-Quote-20260930.pdf' },
      { no: 4, itemNo: 3, extName: '安裝建置與移轉服務', vendorSku: '-', intSku: 'SVC-INSTALL-L2', qty: 1, vendor: '自有工程', unitCost: 95_000 },
      { no: 5, itemNo: 4, extName: '核心交換器 48 埠 PoE', vendorSku: 'FS-148F-POE', intSku: 'FTN-FS148F', qty: 2, vendor: '通路商 B', unitCost: null },
    ],
  },
  {
    id: 'q2-1', dealId: 'd2', version: 1, date: '2026-09-23', status: '報價回簽', submittedAt: '2026-09-23T10:00:00', signbackFile: '北辰物流-回簽-v1.pdf',
    ...flat([
      { no: 1, extName: '次世代防火牆 PA-440（HA 一組）', vendorSku: 'PAN-PA-440', intSku: 'PAN-PA440', qty: 2, unitPrice: 310_000, vendor: '原廠台灣總代理 C', unitCost: 300_000, vendorQuoteFile: 'C-Quote-20260920.pdf' },
      { no: 2, extName: 'Threat Prevention 授權 1 年', vendorSku: 'PAN-PA-440-TP', intSku: 'PAN-TP-440-12', qty: 2, months: 12, unitPrice: 110_000, vendor: '原廠台灣總代理 C', unitCost: 108_000, vendorQuoteFile: 'C-Quote-20260920.pdf' },
      { no: 3, extName: '安裝建置與政策移轉', vendorSku: '-', intSku: 'SVC-INSTALL-L1', qty: 1, unitPrice: 40_000, vendor: '自有工程', unitCost: 46_400 },
    ]),
  },
  {
    id: 'q2-2', dealId: 'd2', version: 2, date: '2026-10-07', status: '草稿', note: '合約變更：中間商要求再降 3%，主機與授權調價，等客戶回簽',
    ...flat([
      { no: 1, extName: '次世代防火牆 PA-440（HA 一組）', vendorSku: 'PAN-PA-440', intSku: 'PAN-PA440', qty: 2, unitPrice: 300_700, vendor: '原廠台灣總代理 C', unitCost: 300_000, vendorQuoteFile: 'C-Quote-20260920.pdf' },
      { no: 2, extName: 'Threat Prevention 授權 1 年', vendorSku: 'PAN-PA-440-TP', intSku: 'PAN-TP-440-12', qty: 2, months: 12, unitPrice: 106_100, vendor: '原廠台灣總代理 C', unitCost: 108_000, vendorQuoteFile: 'C-Quote-20260920.pdf' },
      { no: 3, extName: '安裝建置與政策移轉', vendorSku: '-', intSku: 'SVC-INSTALL-L1', qty: 1, unitPrice: 40_000, vendor: '自有工程', unitCost: 46_000 },
    ]),
  },
  {
    id: 'q4-1', dealId: 'd4', version: 1, date: '2026-09-30', status: '草稿',
    ...flat([
      { no: 1, extName: 'CrowdStrike Falcon Insight EDR 授權 1 年', vendorSku: 'CS-FALCON-INSIGHT-1Y', intSku: 'CS-INSIGHT-12', qty: 1_500, months: 12, unitPrice: 2_200, vendor: '通路商 D', unitCost: null },
      { no: 2, extName: '全校部署與教育訓練', vendorSku: '-', intSku: 'SVC-DEPLOY-L3', qty: 1, unitPrice: 600_000, vendor: '自有工程', unitCost: null },
    ]),
  },
  {
    id: 'q3-1', dealId: 'd3', version: 1, date: '2026-09-18', status: '報價回簽', submittedAt: '2026-10-05T09:40:00+08:00', signbackFile: '晴川商業銀行-回簽-v1.pdf',
    ...flat([
      { no: 1, extName: 'FortiAnalyzer 300G 續約授權', vendorSku: 'FC-10-L0300-247-02-12', intSku: 'FTN-FAZ300G-RNW', qty: 1, months: 12, unitPrice: 720_000, vendor: '原廠台灣總代理 A', unitCost: 612_000, vendorQuoteFile: 'A-Quote-20260915.pdf' },
      { no: 2, extName: '原廠 24x7 維護 1 年', vendorSku: 'FC-10-L0300-210-02-12', intSku: 'FTN-FAZ300G-247', qty: 1, months: 12, unitPrice: 600_000, vendor: '原廠台灣總代理 A', unitCost: 540_000, vendorQuoteFile: 'A-Quote-20260915.pdf' },
    ]),
  },
  {
    id: 'q7-1', dealId: 'd7', version: 1, date: '2026-09-20', status: '報價回簽', submittedAt: '2026-09-28T17:30:00+08:00', signbackFile: '台灣聯合租賃-回簽-v1.pdf',
    ...flat([
      { no: 1, extName: 'Sophos XGS 2100 續約授權 2 年', vendorSku: 'XGS2100-RNW-24', intSku: 'SPH-XGS2100-RNW-24', qty: 1, months: 24, unitPrice: 640_000, vendor: '原廠台灣總代理 A', unitCost: 548_000, vendorQuoteFile: 'A-Quote-20260918.pdf' },
    ]),
  },
  {
    id: 'q9-1', dealId: 'd9', version: 1, date: '2026-09-12', status: '草稿',
    ...flat([
      { no: 1, extName: '次世代防火牆 60F', vendorSku: 'FG-60F', intSku: 'FTN-FG60F', qty: 3, unitPrice: 78_000, vendor: '原廠台灣總代理 A', unitCost: 74_000, vendorQuoteFile: 'A-Quote-20260910.pdf' },
      { no: 2, extName: '安裝設定', vendorSku: '-', intSku: 'SVC-INSTALL-L1', qty: 1, unitPrice: 76_000, vendor: '自有工程', unitCost: 76_000 },
    ]),
  },
  {
    id: 'q10-1', dealId: 'd10', version: 1, date: '2026-07-02', status: '報價回簽', submittedAt: '2026-07-10T10:00:00+08:00', signbackFile: '國昌建設-回簽-v1.pdf',
    ...flat([
      { no: 1, extName: '次世代防火牆 100F', vendorSku: 'FG-100F', intSku: 'FTN-FG100F', qty: 2, unitPrice: 330_000, vendor: '原廠台灣總代理 A', unitCost: 276_000, vendorQuoteFile: 'A-Quote-20260630.pdf' },
      { no: 2, extName: 'UTP 威脅防護授權 3 年', vendorSku: 'FC-10-F100F-950-02-36', intSku: 'FTN-UTP-100F-36', qty: 2, months: 36, unitPrice: 180_000, vendor: '原廠台灣總代理 A', unitCost: 156_000, vendorQuoteFile: 'A-Quote-20260630.pdf' },
      { no: 3, extName: '安裝建置', vendorSku: '-', intSku: 'SVC-INSTALL-L2', qty: 1, unitPrice: 60_000, vendor: '自有工程', unitCost: 48_000 },
    ]),
  },
  {
    id: 'q11-1', dealId: 'd11', version: 1, date: '2026-04-28', status: '報價回簽', submittedAt: '2026-04-28T10:00:00', signbackFile: '立德大學-回簽-v1.pdf',
    ...flat([
      { no: 1, extName: 'Sophos Central 教育授權 800 端點 1 年', vendorSku: 'SC-EDU-800', intSku: 'SPH-SC-EDU-800', qty: 1, months: 12, unitPrice: 480_000, vendor: '通路商 B', unitCost: 420_000, vendorQuoteFile: 'B-Quote-20260425.pdf' },
    ]),
  },
  {
    id: 'q6-1', dealId: 'd6', version: 1, date: '2026-10-06', status: '草稿',
    /* 同品項拆多廠商（1112 會議 #9）：FortiAP 10 台，原廠總代理 A 6 台、通路商 B 4 台，一個對外項次配兩個內部項次 */
    items: [
      { no: 1, custSku: 'FC-10-FNAC-500', custName: 'FortiNAC 端點授權 500 點', desc: '', qty: 1, unitPrice: 360_000 },
      { no: 2, custSku: '', custName: '部署與政策設定', desc: '', qty: 1, unitPrice: 60_000 },
      { no: 3, custSku: 'FAP-231F', custName: '無線基地台 FortiAP 231F', desc: '護理站與病房走廊', qty: 10, unitPrice: 18_000 },
    ],
    lines: [
      { no: 1, itemNo: 1, extName: 'FortiNAC 端點授權 500 點', vendorSku: 'FC-10-FNAC-500', intSku: 'FTN-FNAC-500', qty: 1, months: 12, nature: '授權', vendor: '原廠台灣總代理 A', unitCost: null },
      { no: 2, itemNo: 2, extName: '安裝建置與移轉服務', vendorSku: '-', intSku: 'SVC-INSTALL-L2', qty: 1, nature: '單次服務', vendor: '自有工程', unitCost: 95_000 },
      { no: 3, itemNo: 3, extName: 'FortiAP 231F', vendorSku: 'FAP-231F-T', intSku: 'FTN-FAP231F', qty: 6, vendor: '原廠台灣總代理 A', unitCost: 14_000 },
      { no: 4, itemNo: 3, extName: 'FortiAP 231F', vendorSku: 'FAP-231F-T', intSku: 'FTN-FAP231F', qty: 4, vendor: '通路商 B', unitCost: 13_200 },
    ],
  },
  {
    id: 'q8-1', dealId: 'd8', version: 1, date: '2026-10-09', status: '報價回簽', signbackFile: '北辰物流資訊部-回簽-v1.pdf',
    ...flat([
      { no: 1, extName: '次世代防火牆 100F（SD-WAN 分點）', vendorSku: 'FG-100F', intSku: 'FTN-FG100F', qty: 6, unitPrice: 152_000, vendor: '原廠台灣總代理 A', unitCost: 138_000, vendorQuoteFile: 'A-Quote-20261001.pdf' },
      { no: 2, extName: 'SD-WAN 授權 1 年', vendorSku: 'FC-10-F100F-SDW-12', intSku: 'FTN-SDW-100F-12', qty: 6, months: 12, unitPrice: 30_000, vendor: '原廠台灣總代理 A', unitCost: 25_000, vendorQuoteFile: 'A-Quote-20261001.pdf' },
      { no: 3, extName: '六分點安裝與 SD-WAN 設定', vendorSku: '-', intSku: 'SVC-INSTALL-L3', qty: 1, unitPrice: 58_000, vendor: '自有工程', unitCost: 45_000 },
    ]),
  },
  {
    id: 'q13-1', dealId: 'd13', version: 1, date: '2026-10-20', status: '報價回簽', signbackFile: '國昌建設工地監控-回簽-v1.pdf',
    ...flat([
      { no: 1, extName: '次世代防火牆 60F', vendorSku: 'FG-60F', intSku: 'FTN-FG60F', qty: 4, unitPrice: 45_000, vendor: '原廠台灣總代理 A', unitCost: 38_000, vendorQuoteFile: 'A-Quote-20261019.pdf' },
      { no: 2, extName: '工地網段安裝設定', vendorSku: '-', intSku: 'SVC-INSTALL-L1', qty: 1, unitPrice: 30_000, vendor: '自有工程', unitCost: 22_000 },
    ]),
  },
  {
    id: 'q14-1', dealId: 'd14', version: 1, date: '2026-10-24', status: '報價回簽', signbackFile: '立德大學計算機中心-回簽-v1.pdf',
    ...flat([
      { no: 1, extName: 'Sophos XGS 4500 防火牆', vendorSku: 'XGS4500', intSku: 'SPH-XGS4500', qty: 1, unitPrice: 1_280_000, vendor: '通路商 B', unitCost: 1_090_000, vendorQuoteFile: 'B-Quote-20261023.pdf' },
      { no: 2, extName: 'Xstream Protection 授權 1 年', vendorSku: 'XGS4500-XP-12', intSku: 'SPH-XGS4500-XP-12', qty: 1, months: 12, unitPrice: 320_000, vendor: '通路商 B', unitCost: 268_000, vendorQuoteFile: 'B-Quote-20261023.pdf' },
    ]),
  },
])

/* 請款里程碑：上單送審時定條件，SO 成立後在訂單與專案可改；已請款的期數鎖定 */
/** 每一期：待請款 →（業務申請）已申請 →（會計開票）已開票 →（收款沖帳）已收款 */
export type MilestoneStatus = '待請款' | '已申請' | '已開票' | '已收款'
export interface Milestone {
  label: string
  /** 未稅金額 */
  amount: number
  status: MilestoneStatus
  /** 預計開票日、預計付款日：SO 每一期都要填，到期沒開票／沒收款會提醒 */
  planInvoiceAt?: string
  planPayAt?: string
  requestedAt?: string
  invoiceNo?: string
  invoicedAt?: string
  paidAt?: string
  /** 業務通知會計收款／催收的時間與備註（入帳仍由會計做） */
  collectRequestedAt?: string
  collectNote?: string
}
/**
 * 訂單執行進度改用百分比（utils/execProgress.ts）：接單 → 供應商採購（到客戶％）＋工程％ → 驗收。
 * 結案＝已驗收、全部收款、工程結案，三項都成立（順序不限）。
 */
export function isOrderClosed(o: Pick<Order, 'acceptedAt' | 'milestones' | 'engClosedAt'>): boolean {
  return !!o.acceptedAt && o.milestones.length > 0 && o.milestones.every((m) => m.status === '已收款') && !!o.engClosedAt
}
export const milestoneTemplates: { key: string; label: string; parts: { label: string; pct: number }[] }[] = [
  { key: 'once', label: '驗收後一次請款', parts: [{ label: '驗收後一次請款', pct: 100 }] },
  { key: '30-70', label: '簽約 30%／驗收 70%', parts: [{ label: '簽約後 30%', pct: 30 }, { label: '驗收後 70%', pct: 70 }] },
  { key: '50-50', label: '到貨 50%／驗收 50%', parts: [{ label: '到貨後 50%', pct: 50 }, { label: '驗收後 50%', pct: 50 }] },
]
/**
 * 零頭處理（1112 會議 #11）：
 * last＝四捨五入，尾差落最後一期；floor＝每期去掉千元以下零頭，零頭補到下一期（一路帶到最後一期）；
 * tax＝前面各期湊成含稅整千，差額落最後一期。合計一定等於 total。
 */
export type MilestoneRounding = 'last' | 'floor' | 'tax'
export const milestoneRoundings: { key: MilestoneRounding; label: string }[] = [
  { key: 'last', label: '尾差落最後一期' },
  { key: 'floor', label: '去零頭補下一期' },
  { key: 'tax', label: '各期含稅湊整千' },
]
export function splitByPct(total: number, pcts: number[], rounding: MilestoneRounding = 'last'): number[] {
  let used = 0
  let carry = 0
  return pcts.map((pct, i) => {
    if (i === pcts.length - 1) return total - used
    const raw = (total * pct) / 100
    let amount = Math.round(raw)
    if (rounding === 'floor') {
      amount = Math.floor((raw + carry) / 1000) * 1000
      carry = raw + carry - amount
    }
    if (rounding === 'tax') {
      const target = Math.round((raw * (1 + TAX_RATE)) / 1000) * 1000
      amount = Math.round(target / (1 + TAX_RATE))
    }
    amount = Math.min(Math.max(amount, 0), total - used)
    used += amount
    return amount
  })
}
/** 依模板拆金額，合計一定等於 total */
export function milestonesFromTemplate(key: string, total: number, rounding: MilestoneRounding = 'last'): Milestone[] {
  const t = milestoneTemplates.find((x) => x.key === key) ?? milestoneTemplates[0]!
  const amounts = splitByPct(total, t.parts.map((p) => p.pct), rounding)
  return t.parts.map((p, i) => ({ label: p.label, amount: amounts[i]!, status: '待請款' as const }))
}
/** 請款條件的檢查：至少一期、名稱不空、金額大於 0、合計等於訂單金額 */
export function milestoneProblems(ms: Milestone[], total: number, requireDates = false): string[] {
  const list: string[] = []
  if (!ms.length) list.push('請款條件至少一期')
  if (ms.some((m) => !m.label.trim())) list.push('請款期數名稱未填')
  if (ms.some((m) => m.amount <= 0)) list.push('請款金額須大於 0')
  if (requireDates && ms.some((m) => m.status !== '已收款' && (!m.planInvoiceAt || !m.planPayAt))) list.push('每一期都要填預計開票日與預計付款日')
  const sum = ms.reduce((s, m) => s + m.amount, 0)
  if (ms.length && sum !== total) list.push(`請款合計 ${sum.toLocaleString()} 與訂單金額 ${total.toLocaleString()} 不符`)
  return list
}

export interface Order {
  /** 含稅總計：SO 成立時從核准版報價單帶入（含稅發起的報價單以它為準，不再由未稅換算） */
  taxTotal?: number
  id: string
  soNo: string
  dealId: string
  dealNo: string
  customer: string
  product: string
  owner: string
  amount: number
  cost: number
  /** 整案驗收：貨都到客戶、工程 100% 後由業務按，附客戶驗收單；保固、維護、服務合約從驗收日起算 */
  acceptedAt?: string
  acceptFile?: string
  acceptedBy?: string
  /** 送審時鎖定的報價版本 */
  quoteId?: string
  /** 合約變更中的新報價版本（草稿→報價回簽→重審送審），核准後併入 quoteId */
  changeQuoteId?: string
  /** PO 核准後寫回的實際成本（PO 金額合計加自有工程），與送審時的預估成本並列 */
  actualCost?: number
  milestones: Milestone[]
  licenses: License[]
  /** 流程紀錄：執行階段、財務階段、合約變更每走一步寫一筆（新的在前） */
  log?: OrderLog[]
  /** 訂單明細：SO 成立（與合約變更核准）時從核准版報價單快照，之後報價版本再變也不影響 */
  lines?: OrderLine[]
  /** 工程結案日：工程提出結案後才算整案結案 */
  engClosedAt?: string
  /** 保證單：客戶已回簽但還不能算業績（還要議價、要先預下單、還沒正式合約）；議價完上單核准才轉正式 SO（草案，待客戶確認） */
  phase?: '正式' | '保證單'
  guaranteeReason?: GuaranteeReason
  /** 保證單編號（PRE-…）；轉正式 SO 後保留，追得到來源 */
  guaranteeNo?: string
  /** 保證單作廢 */
  voidedAt?: string
  voidReason?: string
  /** 改由其他商機承接時，承接的商機 */
  succeededByDealId?: string
  /** 合約結束日（可能從驗收完成起算）；過了就不能再合約變更 */
  contractEndAt?: string
}

export type GuaranteeReason = '議價中' | '預下單' | '尚無正式合約'
export const guaranteeReasons: GuaranteeReason[] = ['議價中', '預下單', '尚無正式合約']
export const isGuarantee = (o: Pick<Order, 'phase'>) => o.phase === '保證單'

/** SO 訂單明細：對外項次＋底下的內部項次，內容是成立當下的快照 */
export interface OrderLine {
  no: number
  sku: string
  name: string
  desc: string
  qty: number
  /** 未稅單價 */
  unitPrice: number
  internal: { no: number; intSku: string; name: string; vendorSku: string; qty: number; unitCost: number | null; vendor: string; nature: LineNature; months?: number; stockQty?: number }[]
}

/* ---------- 財務：含稅金額（各期含稅換算，對齊以含稅為準；開票、收款進度見 utils/execProgress.ts） ---------- */
export const withTax = (n: number) => Math.round(n * (1 + TAX_RATE))
/** 訂單含稅總計：SO 成立時帶入的含稅總計為準，沒有才由未稅換算 */
export const orderTaxTotal = (o: Pick<Order, 'amount' | 'taxTotal'>) => o.taxTotal ?? withTax(o.amount)
/** 每期含稅金額：逐期換算，最後一期吸收和含稅總計的差額，各期加總一定等於含稅總計 */
export function milestoneTaxes(o: Pick<Order, 'amount' | 'taxTotal' | 'milestones'>): number[] {
  const arr = o.milestones.map((m) => withTax(m.amount))
  if (arr.length) arr[arr.length - 1]! += orderTaxTotal(o) - arr.reduce((n, x) => n + x, 0)
  return arr
}
/**
 * 實際成本（1113 決定：獎金用實際成本）：採購項次用 PO 實際成本、庫存項次用出貨批次成本、自有工程用標準成本；
 * 還沒下 PO 或還沒出貨的數量先用報價預估成本補上（settled=false）。
 */
export function orderActualCost(o: Pick<Order, 'id' | 'soNo' | 'cost' | 'lines'>): { cost: number; settled: boolean } {
  if (!o.lines?.length) return { cost: o.cost, settled: false }
  const pos = purchaseOrders.filter((p) => p.soNo === o.soNo || p.orderId === o.id)
  const poNos = new Set(pos.map((p) => p.poNo))
  /* PO 成本先以「料號＋供應商」配對（同品項拆多廠商時各算各的），配不到再只看料號 */
  const poLeft = new Map<string, { qty: number; cost: number }[]>()
  const poBySku = new Map<string, { qty: number; cost: number }[]>()
  pos.forEach((p) => p.lines.forEach((l) => {
    const x = { qty: l.qty, cost: l.unitCost }
    poLeft.set(`${l.intSku}|${p.vendor}`, [...(poLeft.get(`${l.intSku}|${p.vendor}`) ?? []), x])
    poBySku.set(l.intSku, [...(poBySku.get(l.intSku) ?? []), x])
  }))
  const stockLeft = new Map<string, { qty: number; cost: number }[]>()
  shipments.filter((s) => s.orderId === o.id).forEach((s) => s.lines.forEach((l) => {
    const lot = stock.find((x) => x.batch === l.batch)
    if (lot?.poNo && poNos.has(lot.poNo)) return
    stockLeft.set(l.sku, [...(stockLeft.get(l.sku) ?? []), { qty: l.qty, cost: l.unitCost }])
  }))
  const take = (pool: Map<string, { qty: number; cost: number }[]>, sku: string, want: number) => {
    let qty = 0
    let cost = 0
    for (const x of pool.get(sku) ?? []) {
      if (qty >= want) break
      const t = Math.min(x.qty, want - qty)
      x.qty -= t
      qty += t
      cost += t * x.cost
    }
    return { qty, cost }
  }
  let total = 0
  let settled = true
  const goods = o.lines.flatMap((x) => x.internal).filter((l) => {
    if (l.vendor !== '自有工程') return true
    total += l.qty * (l.unitCost ?? 0)
    return false
  })
  /* 兩輪：先全部依料號＋供應商配 PO，剩下的才只看料號，避免一行把另一家廠商的 PO 吃掉 */
  const first = goods.map((l) => take(poLeft, `${l.intSku}|${l.vendor}`, l.qty))
  goods.forEach((l, i) => {
    const a2 = take(poBySku, l.intSku, l.qty - first[i]!.qty)
    const a = { qty: first[i]!.qty + a2.qty, cost: first[i]!.cost + a2.cost }
    const b = take(stockLeft, l.intSku, l.qty - a.qty)
    const rest = l.qty - a.qty - b.qty
    if (rest > 0) settled = false
    total += a.cost + b.cost + rest * (l.unitCost ?? transferOf(l.intSku) ?? 0)
  })
  return { cost: Math.round(total), settled }
}
/** 到了預計開票日還沒通知開票的期數 */
export const dueToRequest = (o: Pick<Order, 'milestones'>, today: string) => o.milestones.filter((m) => m.status === '待請款' && !!m.planInvoiceAt && m.planInvoiceAt <= today)
/** 過了預計付款日還沒收款的期數 */
export const overduePay = (o: Pick<Order, 'milestones'>, today: string) => o.milestones.filter((m) => m.status === '已開票' && !!m.planPayAt && m.planPayAt < today)

export function orderLinesFromQuote(q: Pick<Quote, 'items' | 'lines'>): OrderLine[] {
  return q.items.map((i) => ({
    no: i.no,
    sku: i.custSku,
    name: i.custName,
    desc: i.desc,
    qty: i.qty,
    unitPrice: i.unitPrice,
    internal: q.lines
      .filter((l) => l.itemNo === i.no)
      .map((l) => ({ no: l.no, intSku: l.intSku, name: l.extName, vendorSku: l.vendorSku, qty: l.qty, unitCost: l.unitCost, vendor: l.vendor, nature: natureOf(l), months: l.months, stockQty: l.stockQty })),
  }))
}

/** 到期項目：授權（出貨時登錄）、保固（出貨自動算，驗收起算）、維護／服務合約（SO 成立產生，驗收起算）；序號不記 */
/** 到期日是正式日期（未起算的授權是「—」） */
export const hasExpiryDate = (l: Pick<License, 'expires'>) => /^\d{4}-\d{2}-\d{2}$/.test(l.expires)
export interface License {
  id: string
  kind: string
  sku: string
  name: string
  qty: number
  /** 起日；還沒驗收的保固／維護／服務合約先空著，驗收時補上並重算到期日 */
  start?: string
  /** 期間（月），驗收時重算到期日用 */
  months?: number
  expires: string
}

export interface OrderLog {
  at: string
  by: string
  track: '執行' | '財務' | '合約'
  text: string
}

export const orders: Order[] = reactive([
  {
    id: 'o1', soNo: 'SO-2026-0929-012', dealId: 'd7', dealNo: 'D-2026-0820-001', customer: '台灣聯合租賃', product: 'Sophos XGS 2100 續約 2 年',
    owner: '林雅婷', amount: 640_000, cost: 548_000, actualCost: 548_000, quoteId: 'q7-1',
    milestones: [{ label: '授權交付後一次請款', amount: 640_000, status: '待請款', planInvoiceAt: '2026-10-25', planPayAt: '2026-11-24' }],
    licenses: [],
    log: [
      { at: '2026-10-03T10:20:00+08:00', by: '劉欣怡', track: '執行', text: 'PO 2026-10-01-003 核准（直送客戶）' },
      { at: '2026-09-29T11:00:00+08:00', by: '劉欣怡', track: '執行', text: '核准通過 SO 成立（事後追認）' },
    ],
  },
  {
    id: 'o3', soNo: 'SO-2026-0712-004', dealId: 'd10', dealNo: 'D-2026-0620-002', customer: '國昌建設', product: 'FortiGate 100F x2 + UTP 3 年',
    owner: '陳冠宇', amount: 1_080_000, cost: 912_000, actualCost: 960_000, quoteId: 'q10-1',
    contractEndAt: '2029-09-05',
    milestones: [{ label: '到貨後 50%', amount: 540_000, status: '已開票', planInvoiceAt: '2026-08-20', planPayAt: '2026-09-20', requestedAt: '2026-08-20', invoiceNo: 'AB-10234567', invoicedAt: '2026-08-22' }, { label: '驗收後 50%', amount: 540_000, status: '待請款', planInvoiceAt: '2026-09-30', planPayAt: '2026-10-30' }],
    licenses: [
      { id: 'lic-o3-1', kind: '授權', sku: 'FTN-UTP-100F-36', name: 'UTP 威脅防護授權 3 年', qty: 2, start: '2026-09-05', months: 36, expires: '2029-09-05' },
      { id: 'lic-o3-2', kind: '保固', sku: 'FTN-FG100F', name: 'FortiGate 100F 硬體保固', qty: 2, months: 36, expires: '2029-09-05' },
    ],
    log: [
      { at: '2026-09-25T15:00:00+08:00', by: '蔡宗翰', track: '財務', text: '第 1 期「到貨後 50%」收款 540,000' },
      { at: '2026-09-05T14:30:00+08:00', by: '黃彥霖', track: '執行', text: '出貨單 S-2026-0905-001 建立' },
      { at: '2026-08-22T10:10:00+08:00', by: '蔡宗翰', track: '財務', text: '第 1 期「到貨後 50%」開立發票 AB-10234567' },
      { at: '2026-08-20T09:40:00+08:00', by: '陳冠宇', track: '財務', text: '第 1 期「到貨後 50%」申請請款' },
      { at: '2026-07-18T16:00:00+08:00', by: '黃彥霖', track: '執行', text: 'PO 2026-07-12-001 到貨入庫，批次 B-2026-0718-01' },
      { at: '2026-07-12T11:30:00+08:00', by: '劉欣怡', track: '執行', text: 'PO 2026-07-12-001 核准' },
      { at: '2026-07-12T09:30:00+08:00', by: '劉欣怡', track: '執行', text: '核准通過 SO 成立' },
    ],
  },
  {
    id: 'o4', soNo: 'SO-2026-0515-001', dealId: 'd11', dealNo: 'D-2026-0410-004', customer: '立德大學', product: 'Sophos Central 教育授權 800 端點',
    owner: '林雅婷', amount: 480_000, cost: 420_000, actualCost: 420_000, quoteId: 'q11-1', engClosedAt: '2026-06-02', acceptedAt: '2026-06-02', acceptFile: '立德-驗收單.pdf', acceptedBy: '林雅婷',
    contractEndAt: '2027-05-26',
    milestones: [{ label: '一次請款', amount: 480_000, status: '已收款', planInvoiceAt: '2026-05-20', planPayAt: '2026-06-30', requestedAt: '2026-05-20', invoiceNo: 'AB-09876543', invoicedAt: '2026-05-22', paidAt: '2026-06-30' }],
    licenses: [{ id: 'lic-o4-1', kind: '授權', sku: 'SPH-SC-EDU-800', name: 'Sophos Central 教育授權 800 端點 1 年', qty: 1, start: '2026-05-26', months: 12, expires: '2027-05-26' }],
    log: [
      { at: '2026-06-30T14:00:00+08:00', by: '蔡宗翰', track: '財務', text: '第 1 期「一次請款」收款 480,000，訂單結案' },
      { at: '2026-06-02T11:30:00+08:00', by: '林雅婷', track: '執行', text: '整案驗收（附客戶驗收單 立德-驗收單.pdf）' },
      { at: '2026-06-02T11:20:00+08:00', by: '林雅婷', track: '執行', text: '出貨單 S-2026-0526-001 客戶簽收（紙本掃描上傳）' },
      { at: '2026-05-26T09:30:00+08:00', by: '黃彥霖', track: '執行', text: '出貨單 S-2026-0526-001 建立' },
      { at: '2026-05-22T10:00:00+08:00', by: '蔡宗翰', track: '財務', text: '第 1 期「一次請款」開立發票 AB-09876543' },
      { at: '2026-05-20T15:10:00+08:00', by: '林雅婷', track: '財務', text: '第 1 期「一次請款」申請請款' },
      { at: '2026-05-20T10:00:00+08:00', by: '黃彥霖', track: '執行', text: 'PO 2026-05-16-002 到貨入庫，批次 B-2026-0520-01' },
      { at: '2026-05-16T09:30:00+08:00', by: '劉欣怡', track: '執行', text: 'PO 2026-05-16-002 核准' },
      { at: '2026-05-15T10:00:00+08:00', by: '劉欣怡', track: '執行', text: '核准通過 SO 成立' },
    ],
  },
  {
    id: 'o5', soNo: 'SO-2026-1001-013', dealId: 'd2', dealNo: 'D-2026-0922-001', customer: '北辰物流', product: 'Palo Alto PA-440 x2 + Threat Prevention',
    owner: '陳冠宇', amount: 880_000, cost: 862_400, quoteId: 'q2-1', changeQuoteId: 'q2-2',
    milestones: [{ label: '驗收後一次請款', amount: 880_000, status: '待請款', planInvoiceAt: '2026-12-15', planPayAt: '2027-01-14' }],
    licenses: [],
    log: [
      { at: '2026-10-07T09:30:00+08:00', by: '陳冠宇', track: '合約', text: '開始合約變更，自 v1 複製為 v2 草稿' },
      { at: '2026-10-01T10:00:00+08:00', by: '劉欣怡', track: '執行', text: '核准通過 SO 成立' },
    ],
  },
  {
    id: 'o6', soNo: 'PRE-2026-1010-001', guaranteeNo: 'PRE-2026-1010-001', phase: '保證單', guaranteeReason: '預下單',
    dealId: 'd8', dealNo: 'D-2026-0930-006', customer: '北辰物流', product: 'FortiGate 100F x6 SD-WAN',
    owner: '林雅婷', amount: 1_150_000, cost: 1_023_000, quoteId: 'q8-1',
    milestones: [{ label: '驗收後一次請款', amount: 1_150_000, status: '待請款', planInvoiceAt: '2026-12-20', planPayAt: '2027-01-19' }],
    licenses: [],
    log: [{ at: '2026-10-10T10:00:00+08:00', by: '林雅婷', track: '合約', text: '客戶回簽 v1，因「預下單」轉保證單 PRE-2026-1010-001：原廠交期長，先向原廠下單鎖貨' }],
  },
  {
    id: 'o7', soNo: 'PRE-2026-1022-002', guaranteeNo: 'PRE-2026-1022-002', phase: '保證單', guaranteeReason: '議價中',
    dealId: 'd13', dealNo: 'D-2026-1015-003', customer: '國昌建設', product: '工地監控網段 FortiGate 60F x4',
    owner: '陳冠宇', amount: 210_000, cost: 174_000, quoteId: 'q13-1',
    milestones: [{ label: '驗收後一次請款', amount: 210_000, status: '待請款', planInvoiceAt: '2026-11-30', planPayAt: '2026-12-30' }],
    licenses: [],
    log: [{ at: '2026-10-22T16:00:00+08:00', by: '陳冠宇', track: '合約', text: '客戶回簽 v1，因「議價中」轉保證單 PRE-2026-1022-002：客戶回簽後要求 60F 單價再降' }],
  },
  {
    id: 'o8', soNo: 'PRE-2026-1025-003', guaranteeNo: 'PRE-2026-1025-003', phase: '保證單', guaranteeReason: '尚無正式合約',
    dealId: 'd14', dealNo: 'D-2026-1012-005', customer: '立德大學', product: 'Sophos XGS 4500 校園防火牆汰換',
    owner: '林雅婷', amount: 1_600_000, cost: 1_358_000, quoteId: 'q14-1',
    milestones: [{ label: '驗收後一次請款', amount: 1_600_000, status: '待請款', planInvoiceAt: '2027-01-15', planPayAt: '2027-03-15' }],
    licenses: [],
    log: [{ at: '2026-10-25T11:00:00+08:00', by: '林雅婷', track: '合約', text: '客戶回簽 v1，因「尚無正式合約」轉保證單 PRE-2026-1025-003：計算機中心先回簽，正式訂單由總務處開標後下單' }],
  },
])
/* 種子訂單的訂單明細：從核准版報價單快照 */
orders.forEach((o) => {
  const q = quotes.find((x) => x.id === o.quoteId)
  if (q && !o.lines) o.lines = orderLinesFromQuote(q)
})

export interface ApprovalDiff {
  field: string
  before: string
  after: string
}

/** 簽核單每一關「誰來簽」：送審時依路由設定算出的候選人快照 */
export interface ApprovalStep {
  role: Role
  mode: '任一人' | '依申請人' | '指定人'
  /** 沒有＝該角色任一人 */
  candidateIds?: string[]
  label: string
  /** 該角色沒有人，由代理人簽 */
  proxy?: boolean
}

export interface Approval {
  id: string
  type: '上單' | 'PO' | '預付' | '供應商建檔' | '品項參考成本' | '申請'
  title: string
  refNo: string
  dealId?: string
  submitterId: string
  submitter: string
  submittedAt: string
  amount: number
  cost?: number
  /** 上單：送審的報價版本與請款條件；最後一關核准時用來產生 SO */
  quoteId?: string
  milestones?: Milestone[]
  route: Role[]
  /** 與 route 同長度；舊資料沒有就是每關任一人 */
  steps?: ApprovalStep[]
  currentStep: number
  /** 已收回：送件人在第一關回應前自己收回 */
  status: '待簽核' | '已核准' | '已退回' | '已收回'
  postHoc?: boolean
  /** 送審時依簽核規則算出的審核標示（低毛利、成本異動…） */
  flags?: string[]
  reason?: string
  diff?: ApprovalDiff[]
  /** 駁回＝回上一關重簽；退回＝整張作廢、送件人修改後重送；收回＝送件人在第一關回應前自己收回 */
  /** step：核准的是第幾關（駁回回上一關時同一人可重簽同一關）；userId：判斷是不是同一個人 */
  history: { role: Role; name: string; userId?: string; step?: number; action: '送出' | '核准' | '駁回' | '退回' | '收回'; at: string; note?: string }[]
}

export const approvals: Approval[] = [
  {
    id: 'a1', type: '上單', title: '晴川商業銀行 FortiAnalyzer 續約 + 原廠維護', refNo: 'D-2026-0901-007', dealId: 'd3',
    submitterId: 'u-chen', submitter: '陳冠宇', submittedAt: '2026-10-05T09:40:00+08:00', amount: 1_320_000, cost: 1_152_000, quoteId: 'q3-1',
    milestones: [{ label: '簽約後 30%', amount: 396_000, status: '待請款' }, { label: '交付後 70%', amount: 924_000, status: '待請款' }],
    route: ['業務主管', '採購', '採購主管'], currentStep: 1, status: '待簽核',
    steps: [{ role: '業務主管', mode: '依申請人', candidateIds: ['u-lin'], label: '依申請人部門（北區業務）：林雅婷' }, { role: '採購', mode: '任一人', label: '任一位採購' }, { role: '採購主管', mode: '任一人', candidateIds: ['u-liu'], label: '代理 劉欣怡（缺採購主管）', proxy: true }],
    reason: '客戶年度續約，已取得回簽。',
    history: [
      { role: '業務', name: '陳冠宇', action: '送出', at: '2026-10-05T09:40:00+08:00' },
      { role: '業務主管', name: '林雅婷', userId: 'u-lin', step: 0, action: '核准', at: '2026-10-06T09:30:00+08:00', note: '毛利正常，請採購稽核成本' },
    ],
  },
  {
    id: 'a3', type: '上單', title: '台灣聯合租賃 Sophos XGS 續約（事後追認）', refNo: 'D-2026-0820-001', dealId: 'd7',
    submitterId: 'u-lin', submitter: '林雅婷', submittedAt: '2026-09-28T17:30:00+08:00', amount: 640_000, cost: 548_000, quoteId: 'q7-1',
    route: ['業務主管', '採購', '採購主管'], currentStep: 2, status: '待簽核', postHoc: true,
    steps: [{ role: '業務主管', mode: '依申請人', candidateIds: ['u-lin'], label: '依申請人部門（北區業務）：林雅婷' }, { role: '採購', mode: '任一人', label: '任一位採購' }, { role: '採購主管', mode: '任一人', candidateIds: ['u-liu'], label: '代理 劉欣怡（缺採購主管）', proxy: true }],
    reason: '授權到期前客戶口頭確認，已先向原廠下單，補上單程序。',
    history: [
      { role: '業務', name: '林雅婷', action: '送出', at: '2026-09-28T17:30:00+08:00' },
      { role: '業務主管', name: '林雅婷', userId: 'u-lin', step: 0, action: '核准', at: '2026-09-28T17:35:00+08:00', note: '自送自簽，標示事後追認' },
      { role: '採購', name: '黃彥霖', userId: 'u-huang', step: 1, action: '核准', at: '2026-09-29T10:00:00+08:00', note: '稽核完成，回填成本 548,000' },
    ],
  },
  {
    id: 'a4', type: 'PO', title: 'PO 2026-10-06-002 原廠台灣總代理 A', refNo: '2026-10-06-002',
    submitterId: 'u-huang', submitter: '黃彥霖', submittedAt: '2026-10-06T16:00:00+08:00', amount: 1_152_000,
    route: ['財務主管'], currentStep: 0, status: '待簽核',
    reason: '對應預下單 D-2026-0901-007（上單簽核中），付款條件 T/T 30 天。',
    history: [{ role: '採購', name: '黃彥霖', action: '送出', at: '2026-10-06T16:00:00+08:00' }],
  },
  {
    id: 'a5', type: '供應商建檔', title: '新供應商：雲端資安服務 C', refNo: 'V-2026-0018',
    submitterId: 'u-chen', submitter: '陳冠宇', submittedAt: '2026-10-02T10:30:00+08:00', amount: 0,
    route: ['會計', '採購', '執行長'], currentStep: 1, status: '待簽核',
    reason: '立德大學 EDR 案需要 MDR 服務夥伴。',
    history: [
      { role: '業務', name: '陳冠宇', action: '送出', at: '2026-10-02T10:30:00+08:00' },
      { role: '會計', name: '蔡宗翰', action: '核准', at: '2026-10-03T09:10:00+08:00', note: '銀行帳號與統編核對無誤' },
    ],
  },
  {
    id: 'a6', type: '預付', title: '預付款：崇光醫療 FortiGate 200F 主機', refNo: 'D-2026-0914-003', dealId: 'd1',
    submitterId: 'u-chen', submitter: '陳冠宇', submittedAt: '2026-10-07T17:00:00+08:00', amount: 430_000,
    route: ['業務主管', '財務主管'], currentStep: 0, status: '待簽核',
    reason: '原廠缺貨，先預付一台主機鎖定交期。',
    history: [{ role: '業務', name: '陳冠宇', action: '送出', at: '2026-10-07T17:00:00+08:00' }],
  },
  {
    id: 'a7', type: '上單', title: '國昌建設 FortiGate 100F x2', refNo: 'D-2026-0620-002', dealId: 'd10',
    submitterId: 'u-chen', submitter: '陳冠宇', submittedAt: '2026-07-10T10:00:00+08:00', amount: 1_080_000, cost: 912_000, quoteId: 'q10-1',
    route: ['業務主管', '採購', '財務主管'], currentStep: 3, status: '已核准',
    history: [
      { role: '業務', name: '陳冠宇', action: '送出', at: '2026-07-10T10:00:00+08:00' },
      { role: '業務主管', name: '林雅婷', action: '核准', at: '2026-07-10T13:00:00+08:00' },
      { role: '採購', name: '黃彥霖', action: '核准', at: '2026-07-11T09:30:00+08:00', note: '稽核完成' },
      { role: '財務主管', name: '劉欣怡', action: '核准', at: '2026-07-12T09:30:00+08:00' },
    ],
  },
  {
    id: 'a8', type: '上單', title: '新光工程顧問 FortiGate 60F x3', refNo: 'D-2026-0905-002', dealId: 'd9',
    submitterId: 'u-chen', submitter: '陳冠宇', submittedAt: '2026-09-20T10:00:00+08:00', amount: 310_000, cost: 298_000, quoteId: 'q9-1',
    route: ['業務主管', '採購', '財務主管'], currentStep: 0, status: '已退回',
    history: [
      { role: '業務', name: '陳冠宇', action: '送出', at: '2026-09-20T10:00:00+08:00' },
      { role: '業務主管', name: '林雅婷', action: '退回', at: '2026-09-20T16:40:00+08:00', note: '毛利 3.9% 低於門檻，請確認是否有庫存可用' },
    ],
  },
]

export interface Comment {
  id: string
  dealId: string
  author: string
  role: Role
  at: string
  text: string
  /** 被提及的人（userId），未讀提及用這個算 */
  mentionIds?: string[]
  attachment?: string
}

export const comments: Comment[] = [
  { id: 'c-d8-1', dealId: 'd8', author: '林雅婷', role: '業務主管', at: '2026-10-05T09:10:00+08:00', text: '@李柏翰 六個分點的 IP 規劃表放在其他附件，請先看一下第三分點的 VPN 走法。', mentionIds: ['u-eng-lee'] },
  { id: 'c-d8-2', dealId: 'd8', author: '林雅婷', role: '業務主管', at: '2026-10-07T16:40:00+08:00', text: '@李柏翰 客戶問 11/20 前能不能先做兩個分點，其餘月底，請回一下。', mentionIds: ['u-eng-lee'] },
  { id: 'c1', dealId: 'd1', author: '陳冠宇', role: '業務', at: '2026-10-03T15:30:00+08:00', text: '報價單已寄給資訊室王主任，口頭說下週簽。@黃彥霖 交換器那條請幫忙確認通路商 B 的成本，我還沒收到報價。', mentionIds: ['u-huang'] },
  { id: 'c2', dealId: 'd1', author: '黃彥霖', role: '採購', at: '2026-10-06T10:12:00+08:00', text: '通路商 B 回覆 FS-148F-POE 單價 39,500，今天會把報價單傳上來。', attachment: 'B-Quote-FS148F.pdf' },
  { id: 'c3', dealId: 'd1', author: '林雅婷', role: '業務主管', at: '2026-10-07T09:00:00+08:00', text: '週會：這案 HA 組要確認原廠交期，缺貨的話考慮預付鎖貨。' },
  { id: 'c4', dealId: 'd2', author: '林雅婷', role: '業務主管', at: '2026-10-06T11:30:00+08:00', text: '負毛利要走執行長，請在送審理由寫清楚後續 EDR 案的預估金額。' },
  { id: 'c5', dealId: 'd4', author: '陳冠宇', role: '業務', at: '2026-10-07T18:00:00+08:00', text: '10/14 到校部署試用，@王志明 需要一位工程師隨行，已送工程支援申請。', mentionIds: ['u-eng-mgr'] },
]

export interface Todo {
  id: string
  kind: '簽核' | '稽核' | '付款' | '簽收' | '回覆' | '到期' | '補件' | '下單' | '派工' | '工程'
  title: string
  refNo: string
  due?: string
  forRoles: Role[]
  forUserIds?: string[]
  approvalId?: string
  dealId?: string
  route?: string
  /** 進入代辦的時間，用於「長期未處理」篩選 */
  createdAt?: string
  /** 工程代辦對應的服務單 */
  engRequestId?: string
}

export const todos: Todo[] = [
  { id: 't-eng-d4-1', kind: '派工', title: '【急件】待派工 T01｜POC｜立德大學 EDR 試用部署', refNo: 'D-2026-0928-002', due: '2026-10-14', forRoles: ['工程主管'], dealId: 'd4', engRequestId: 'er-002-T01', route: '/sales/pipeline?deal=d4', createdAt: '2026-10-06T14:00:00+08:00' },
  { id: 't-eng-d4-2', kind: '派工', title: '待派工（網路資安組）T02｜現場勘查｜立德大學 校園網路與 AD 確認', refNo: 'D-2026-0928-002', due: '2026-10-12', forRoles: ['工程師'], forUserIds: ['u-eng-lee'], dealId: 'd4', engRequestId: 'er-002-T02', route: '/sales/pipeline?deal=d4', createdAt: '2026-10-07T09:30:00+08:00' },
  { id: 't-eng-d2-1', kind: '派工', title: '待派工 T01｜部署｜北辰物流 安裝建置與政策移轉', refNo: 'D-2026-0922-001', due: '2026-11-28', forRoles: ['工程主管'], dealId: 'd2', engRequestId: 'er-d2-T01', route: '/engineering/services?deal=d2', createdAt: '2026-10-01T10:00:00+08:00' },
  { id: 't-eng-d1-3', kind: '工程', title: '工程支援 T03｜部署｜崇光醫療 總院 HA 部署', refNo: 'D-2026-0914-003', due: '2026-11-05', forRoles: ['工程師'], forUserIds: ['u-eng-lee'], dealId: 'd1', engRequestId: 'er-003-T03', route: '/sales/pipeline?deal=d1', createdAt: '2026-09-22T09:30:00+08:00' },
  { id: 't-eng-d8-2', kind: '工程', title: '工程支援 T02｜部署｜北辰物流 六分點 SD-WAN 安裝', refNo: 'D-2026-0930-006', due: '2026-11-20', forRoles: ['工程師'], forUserIds: ['u-eng-lee'], dealId: 'd8', engRequestId: 'er-006-T02', route: '/sales/pipeline?deal=d8', createdAt: '2026-10-03T10:00:00+08:00' },
  { id: 't-eng-d8-3', kind: '工程', title: '待接受 T03｜售前諮詢｜北辰物流 第三分點 VPN 走法', refNo: 'D-2026-0930-006', due: '2026-10-15', forRoles: ['工程師'], forUserIds: ['u-eng-wu'], dealId: 'd8', engRequestId: 'er-006-T03', route: '/sales/pipeline?deal=d8', createdAt: '2026-10-05T11:00:00+08:00' },
  { id: 't-eng-d10-2', kind: '工程', title: '工程支援 T02｜其他｜國昌建設 上線後健檢', refNo: 'D-2026-0620-002', due: '2026-11-06', forRoles: ['工程師'], forUserIds: ['u-eng-wu'], dealId: 'd10', engRequestId: 'er-002-T02', route: '/sales/pipeline?deal=d10', createdAt: '2026-10-02T09:00:00+08:00' },
  { id: 't3', kind: '簽核', title: '預付款：崇光醫療 FortiGate 200F 主機', refNo: 'D-2026-0914-003', due: '2026-10-08', forRoles: ['業務主管'], approvalId: 'a6', createdAt: '2026-10-07T17:00:00+08:00' },
  { id: 't4', kind: '稽核', title: '上單稽核：晴川商業銀行，回填料號與成本', refNo: 'D-2026-0901-007', forRoles: ['採購'], approvalId: 'a1', createdAt: '2026-10-05T09:40:00+08:00' },
  { id: 't5', kind: '簽核', title: '供應商建檔：雲端資安服務 C', refNo: 'V-2026-0018', forRoles: ['採購'], approvalId: 'a5', createdAt: '2026-10-03T09:10:00+08:00' },
  { id: 't6', kind: '簽核', title: 'PO 2026-10-06-002 原廠台灣總代理 A', refNo: '2026-10-06-002', due: '2026-10-08', forRoles: ['財務主管'], approvalId: 'a4', createdAt: '2026-10-06T16:00:00+08:00' },
  { id: 't-h2', kind: '簽核', title: '預留貨：崇光醫療體系 FTN-FS148F × 2（30 天）', refNo: 'D-2026-0914-003', forRoles: ['採購'], dealId: 'd1', route: '/inventory', createdAt: '2026-11-02T15:40:00+08:00' },
  { id: 't7', kind: '簽核', title: '上單（事後追認）：台灣聯合租賃 Sophos 續約', refNo: 'D-2026-0820-001', forRoles: ['採購主管'], forUserIds: ['u-liu'], approvalId: 'a3', createdAt: '2026-09-29T10:00:00+08:00' },
  { id: 't8', kind: '回覆', title: '陳冠宇在崇光醫療案提及你：確認通路商 B 成本', refNo: 'D-2026-0914-003', forRoles: ['採購'], dealId: 'd1', createdAt: '2026-10-03T15:30:00+08:00' },
  { id: 't9', kind: '補件', title: '崇光醫療報價單第 4 項仍缺廠商報價單', refNo: 'D-2026-0914-003', forRoles: ['業務'], forUserIds: ['u-chen'], dealId: 'd1', route: '/sales/pipeline?deal=d1&tab=quotes', createdAt: '2026-10-03T16:00:00+08:00' },
  { id: 't10b', kind: '下單', title: '建立 PO：北辰物流 Palo Alto PA-440 x2 + Threat Prevention', refNo: 'SO-2026-1001-013', forRoles: ['採購'], route: '/purchase/po?so=SO-2026-1001-013', createdAt: '2026-10-01T10:05:00+08:00' },
  { id: 't10', kind: '簽收', title: '國昌建設出貨單待客戶簽收', refNo: 'SO-2026-0712-004', due: '2026-10-10', forRoles: ['業務'], forUserIds: ['u-chen'], route: '/sales/orders', createdAt: '2026-09-26T09:00:00+08:00' },
  { id: 't13', kind: '付款', title: '原廠台灣總代理 A 第一期款 10/15 到期', refNo: '2026-09-12-004', due: '2026-10-15', forRoles: ['會計', '財務主管'], createdAt: '2026-10-01T09:00:00+08:00' },
]

export interface Notification {
  id: string
  kind: '提及' | '下單完成' | '收款到帳' | '退回' | '核准' | '系統' | '派工'
  text: string
  at: string
  read: boolean
  forRoles: Role[]
  /** 指定給特定人（@ 提及） */
  forUserIds?: string[]
  /** 對應的簽核單：「去處理」直接打開它 */
  approvalId?: string
}

export const notifications: Notification[] = [
  { id: 'n1', kind: '下單完成', text: '採購已向原廠台灣總代理 A 下單：台灣聯合租賃 Sophos XGS 續約（PO 2026-10-01-003）', at: '2026-10-07T16:40:00+08:00', read: false, forRoles: ['業務', '業務主管'] },
  { id: 'n2', kind: '提及', text: '黃彥霖在崇光醫療案回覆了你的提及：通路商 B 單價 39,500', at: '2026-10-06T10:12:00+08:00', read: false, forRoles: ['業務'] },
  { id: 'n3', kind: '收款到帳', text: '國昌建設第一期款 540,000 已到帳，請款里程碑更新', at: '2026-10-03T11:20:00+08:00', read: true, forRoles: ['業務', '業務主管', '會計', '財務主管'] },
  { id: 'n4', kind: '退回', text: '林雅婷退回新光工程顧問上單：毛利 3.9% 低於門檻', at: '2026-09-20T16:40:00+08:00', read: true, forRoles: ['業務'] },
  { id: 'n5', kind: '系統', text: '過渡期同步完成：拉取現行 ERP 42 筆，對照失敗 2 筆待確認', at: '2026-10-08T06:00:00+08:00', read: false, forRoles: ['系統管理員', '業務主管'] },
  { id: 'n6', kind: '核准', text: '蔡宗翰核准供應商建檔：雲端資安服務 C，進入採購關卡', at: '2026-10-03T09:10:00+08:00', read: true, forRoles: ['業務', '採購'] },
  { id: 'n7', kind: '系統', text: '陳冠宇送出負毛利上單：北辰物流 PA-440，毛利 -1.0%', at: '2026-10-07T15:10:00+08:00', read: false, forRoles: ['業務主管', '執行長'] },
]

export interface PoLine {
  no: number
  extName: string
  intSku: string
  vendorSku: string
  qty: number
  unitCost: number
  /** 路線：進公司倉（入庫後出貨單出貨）或直送客戶（不入庫，登記送達即算到客戶）；沒填視為公司倉 */
  route?: '公司倉' | '直送'
  /** 來源：訂單（報價）的內部項次號碼；同料號出現在多個項次時，進度歸給這一個 */
  srcLineNo?: number
  /** 已到貨數量（公司倉） */
  received?: number
  /** 直送已送達客戶的數量、日期與送達證明 */
  delivered?: number
  deliveredAt?: string
  deliveryProof?: string
  /** 到貨時分給哪張 SO 或公司庫存 */
  allocations?: { target: string; qty: number; at: string }[]
}

export interface PurchaseOrder {
  id: string
  poNo: string
  vendor: string
  /** 對應 SO 編號；預下單為「預下單 D-…」 */
  soNo: string
  customer: string
  dealId?: string
  orderId?: string
  amount: number
  terms: string
  status: '待核准' | '已下單' | '已到貨'
  createdAt: string
  prepaid?: number
  expectedAt?: string
  preOrder?: boolean
  approvalId?: string
  /** 原廠簽回的 PO 檔案 */
  signbackFile?: string
  /** 案子沒成立轉公司庫存時，保留原本的商機與保證單（關聯路徑追溯用） */
  sourceDealId?: string
  sourceGuaranteeNo?: string
  receivedAt?: string
  lines: PoLine[]
}

export const purchaseOrders: PurchaseOrder[] = reactive([
  {
    id: 'po1', poNo: '2026-10-06-002', vendor: '原廠台灣總代理 A', soNo: '預下單 D-2026-0901-007', customer: '晴川商業銀行', dealId: 'd3',
    amount: 1_152_000, terms: 'T/T 30 天', status: '待核准', createdAt: '2026-10-06', expectedAt: '2026-11-03', preOrder: true, approvalId: 'a4',
    lines: [
      { no: 1, extName: 'FortiAnalyzer 300G 續約授權', intSku: 'FTN-FAZ300G-RNW', vendorSku: 'FC-10-L0300-247-02-12', qty: 1, unitCost: 612_000 },
      { no: 2, extName: '原廠 24x7 維護 1 年', intSku: 'FTN-FAZ300G-247', vendorSku: 'FC-10-L0300-210-02-12', qty: 1, unitCost: 540_000 },
    ],
  },
  {
    id: 'po2', poNo: '2026-10-01-003', vendor: '原廠台灣總代理 A', soNo: 'SO-2026-0929-012', customer: '台灣聯合租賃', dealId: 'd7', orderId: 'o1',
    amount: 548_000, terms: 'T/T 30 天', status: '已下單', createdAt: '2026-10-01', expectedAt: '2026-10-24', signbackFile: 'A-PO-2026-10-01-003-簽回.pdf',
    lines: [{ no: 1, extName: 'Sophos XGS 2100 續約授權 2 年', intSku: 'SPH-XGS2100-RNW-24', vendorSku: 'XGS2100-RNW-24', qty: 1, unitCost: 548_000, route: '直送' }],
  },
  {
    id: 'po3', poNo: '2026-09-12-004', vendor: '原廠台灣總代理 A', soNo: '預下單 D-2026-0930-006', customer: '北辰物流', dealId: 'd8',
    amount: 720_000, terms: '分期：30% / 70%', status: '已下單', createdAt: '2026-09-12', prepaid: 216_000, expectedAt: '2026-10-20', preOrder: true, signbackFile: 'A-PO-2026-09-12-004-簽回.pdf',
    lines: [{ no: 1, extName: '次世代防火牆 100F（SD-WAN 分點）', intSku: 'FTN-FG100F', vendorSku: 'FG-100F', qty: 6, unitCost: 120_000 }],
  },
  {
    id: 'po4', poNo: '2026-07-12-001', vendor: '原廠台灣總代理 A', soNo: 'SO-2026-0712-004', customer: '國昌建設', dealId: 'd10', orderId: 'o3',
    amount: 912_000, terms: 'T/T 45 天', status: '已到貨', createdAt: '2026-07-12', expectedAt: '2026-08-05', receivedAt: '2026-07-18', signbackFile: 'A-PO-2026-07-12-001-簽回.pdf',
    lines: [
      { no: 1, extName: '次世代防火牆 100F', intSku: 'FTN-FG100F', vendorSku: 'FG-100F', qty: 2, unitCost: 300_000, received: 2, allocations: [{ target: 'SO-2026-0712-004', qty: 2, at: '2026-07-18' }] },
      { no: 2, extName: 'UTP 威脅防護授權 3 年', intSku: 'FTN-UTP-100F-36', vendorSku: 'FC-10-F100F-950-02-36', qty: 2, unitCost: 156_000, received: 2, allocations: [{ target: 'SO-2026-0712-004', qty: 2, at: '2026-07-18' }] },
    ],
  },
  {
    id: 'po5', poNo: '2026-05-16-002', vendor: '通路商 B', soNo: 'SO-2026-0515-001', customer: '立德大學', dealId: 'd11', orderId: 'o4',
    amount: 420_000, terms: '月結 30 天', status: '已到貨', createdAt: '2026-05-16', expectedAt: '2026-05-30', receivedAt: '2026-05-20', signbackFile: 'B-PO-2026-05-16-002-簽回.pdf',
    lines: [{ no: 1, extName: 'Sophos Central 教育授權 800 端點 1 年', intSku: 'SPH-SC-EDU-800', vendorSku: 'SC-EDU-800', qty: 1, unitCost: 420_000, received: 1, allocations: [{ target: 'SO-2026-0515-001', qty: 1, at: '2026-05-20' }] }],
  },
])

/** 品項參考成本（標準成本）：用公司庫存時業務毛利依此計算；由採購依「現在向原廠買要多少」維護，與批次成本的差額歸庫存損益 */
export const transferPrices: Record<string, number> = reactive({
  'FTN-FG100F': 190_000,
  'FTN-FG60F': 46_000,
  'FTN-FS148F': 40_000,
  'SPH-XGS2100': 132_000,
  'SPH-XGS2100-RNW-24': 548_000,
  'FTN-FG200F': 430_000,
  'PAN-PA440': 300_000,
})
export const transferOf = (sku: string): number | undefined => transferPrices[sku]

/** 品項參考成本異動：採購提出、財務主管核准後生效 */
export interface TransferChange {
  id: string
  sku: string
  name: string
  from?: number
  to: number
  reason: string
  promoUntil?: string
  requestedBy: string
  at: string
  status: '待核准' | '已核准' | '已退回'
  approvalId?: string
}
export const transferChanges: TransferChange[] = reactive([
  { id: 'tp1', sku: 'FTN-FG100F', name: 'FortiGate 100F', from: 185_000, to: 190_000, reason: '原廠 9 月牌價調整', requestedBy: '黃彥霖', at: '2026-09-10T10:00:00+08:00', status: '已核准' },
  { id: 'tp2', sku: 'SPH-XGS2100', name: 'Sophos XGS 2100', from: 128_000, to: 132_000, reason: '匯率調整', requestedBy: '黃彥霖', at: '2026-08-02T10:00:00+08:00', status: '已核准' },
])

/** 供應商主檔：建檔審核（會計 → 採購 → 執行長）通過才是正式供應商 */
export interface Vendor {
  id: string
  vendorNo: string
  name: string
  taxId: string
  contact?: string
  phone?: string
  email?: string
  terms: string
  products?: string
  /** 銀行帳號只存遮罩 */
  bank?: { bankName: string; accountMasked: string }
  /** 變更中的銀行資料，核准後才取代 bank */
  pendingBank?: { bankName: string; accountMasked: string }
  status: '正式' | '非正式' | '停用'
  appliedBy?: string
  appliedAt?: string
  approvalId?: string
  note?: string
  /** 建檔或變更時附的文件（登記表、存摺封面等），附件總覽查得到 */
  docs?: string[]
}
/** 原廠續約規則：依品牌，授權到期頁、到期代辦、續約報價都看這張表 */
export interface VendorRenewalRule {
  brand: string
  /** 料號前綴，用來判斷序號屬於哪個原廠 */
  prefixes: string[]
  /** 到期前幾天開放建續約商機 */
  openDays: number
  /** 到期前幾天建到期代辦 */
  remindDays: number
  /** 到期前幾天標急件 */
  urgentDays: number
  /** 過期後寬限天數 */
  graceDays: number
  /** 過期後續約，原廠回溯到原到期日的上限（月）；0 表示不回溯、視為新購 */
  backdateMonths: number
  coTerm: boolean
  /** 原廠直接通知終端客戶：到期前／後幾天 */
  noticeBefore: number
  noticeAfter: number
}
export const vendorRenewalRules: VendorRenewalRule[] = reactive([
  { brand: 'Fortinet', prefixes: ['FTN', 'FG', 'FC', 'FS'], openDays: 120, remindDays: 90, urgentDays: 30, graceDays: 10, backdateMonths: 6, coTerm: true, noticeBefore: 30, noticeAfter: 30 },
  { brand: 'Sophos', prefixes: ['SPH', 'SC', 'XGS'], openDays: 120, remindDays: 90, urgentDays: 30, graceDays: 10, backdateMonths: 0, coTerm: true, noticeBefore: 30, noticeAfter: 30 },
  { brand: 'Palo Alto', prefixes: ['PAN', 'PA'], openDays: 120, remindDays: 120, urgentDays: 30, graceDays: 0, backdateMonths: 0, coTerm: true, noticeBefore: 30, noticeAfter: 0 },
  { brand: 'CrowdStrike', prefixes: ['CS'], openDays: 120, remindDays: 90, urgentDays: 30, graceDays: 0, backdateMonths: 0, coTerm: false, noticeBefore: 30, noticeAfter: 0 },
])
export const ruleForSku = (sku: string) => vendorRenewalRules.find((r) => r.prefixes.some((p) => sku.toUpperCase().startsWith(p + '-') || sku.toUpperCase().startsWith(p))) ?? vendorRenewalRules[0]!

export const vendors: Vendor[] = reactive([
  { id: 'v1', vendorNo: 'V-2024-0001', name: '原廠台灣總代理 A', taxId: '20951234', contact: '林經理', phone: '02-2766-1000', email: 'order@dist-a.example', terms: 'T/T 30 天', products: 'Fortinet、FortiAnalyzer、Sophos', bank: { bankName: '玉山銀行', accountMasked: '080***4421' }, status: '正式' },
  { id: 'v2', vendorNo: 'V-2024-0005', name: '通路商 B', taxId: '53887012', contact: '鄭先生', phone: '02-8792-3300', terms: '月結 30 天', products: 'FortiSwitch、Sophos Central 教育授權', bank: { bankName: '中國信託', accountMasked: '822***9031' }, status: '正式' },
  { id: 'v3', vendorNo: 'V-2025-0009', name: '原廠台灣總代理 C', taxId: '42210987', contact: '黃協理', phone: '02-2175-6600', terms: 'T/T 30 天', products: 'Palo Alto', bank: { bankName: '台北富邦', accountMasked: '012***7788' }, status: '正式' },
  { id: 'v4', vendorNo: 'V-2025-0012', name: '通路商 D', taxId: '66120345', contact: '許小姐', terms: 'T/T 45 天', products: 'CrowdStrike', bank: { bankName: '國泰世華', accountMasked: '013***1150' }, status: '正式' },
  { id: 'v5', vendorNo: 'V-2026-0018', name: '雲端資安服務 C', taxId: '90125566', contact: '陳經理', email: 'sales@cloudsec-c.example', terms: 'T/T 30 天', products: 'SentinelOne、雲端 WAF', status: '非正式', appliedBy: '陳冠宇', appliedAt: '2026-10-02T10:30:00+08:00', approvalId: 'a5', note: '緊急案：建檔核准前可先報價，不可建 PO 與付款', docs: ['雲端資安服務C-設立登記表.pdf', '雲端資安服務C-存摺封面.pdf'] },
])

/** 出貨單：從到貨的批次依先進先出挑貨、登錄序號、扣庫存；之後客戶簽收 */
export interface Shipment {
  id: string
  shipNo: string
  soNo: string
  orderId: string
  customer: string
  at: string
  by: string
  note?: string
  lines: { sku: string; name: string; qty: number; batch: string; unitCost: number; expires?: string }[]
  status: '已出貨' | '已簽收'
  signedAt?: string
  method?: string
  /** 簽收檔（iPad 簽名圖、線上簽收圖或紙本掃描），對應 attachments 的 出貨簽收 */
  signFile?: string
}
export const shipments: Shipment[] = reactive([
  { id: 'sh1', shipNo: 'S-2026-0905-001', soNo: 'SO-2026-0712-004', orderId: 'o3', customer: '國昌建設', at: '2026-09-05', by: '黃彥霖', lines: [{ sku: 'FTN-FG100F', name: 'FortiGate 100F', qty: 2, batch: 'B-2026-0718-01', unitCost: 185_000 }, { sku: 'FTN-UTP-100F-36', name: 'UTP 威脅防護授權 3 年', qty: 2, batch: 'B-2026-0718-01', unitCost: 156_000, expires: '2029-09-05' }], status: '已出貨' },
  { id: 'sh2', shipNo: 'S-2026-0526-001', soNo: 'SO-2026-0515-001', orderId: 'o4', customer: '立德大學', at: '2026-05-26', by: '黃彥霖', lines: [{ sku: 'SPH-SC-EDU-800', name: 'Sophos Central 教育授權 800 端點', qty: 1, batch: 'B-2026-0520-01', unitCost: 420_000, expires: '2027-05-26' }], status: '已簽收', signedAt: '2026-06-02', method: '紙本掃描上傳', signFile: '立德-簽收單掃描.pdf' },
])

/** 行政申請：報帳、請假、公務車、用印名片請購共用一個模組 */
export type AppType = '報帳與代墊款' | '請假與出勤' | '公務車預約' | '用印名片與請購'
export interface Application {
  id: string
  appNo: string
  type: AppType
  title: string
  applicantId: string
  applicant: string
  applicantRole: Role
  at: string
  fields: Record<string, string | number>
  files: string[]
  amount?: number
  status: '待簽核' | '已核准' | '已退回' | '已預約'
  approvalId?: string
}
export const applications: Application[] = reactive<Application[]>([
  { id: 'app1', appNo: 'EXP-2026-1003-001', type: '報帳與代墊款', title: '報帳與代墊款：交通 1,280', applicantId: 'u-chen', applicant: '陳冠宇', applicantRole: '業務', at: '2026-10-03T18:00:00+08:00', fields: { kind: '交通', date: '2026-10-03', amount: 1280, desc: '拜訪崇光醫療體系，計程車來回' }, files: ['exp-receipt-1003.jpg'], amount: 1280, status: '已核准' },
  { id: 'app2', appNo: 'VEH-2026-1009-001', type: '公務車預約', title: '公務車預約：公務車 A（ABC-1234）', applicantId: 'u-lin', applicant: '林雅婷', applicantRole: '業務主管', at: '2026-10-07T09:10:00+08:00', fields: { car: '公務車 A（ABC-1234）', purpose: '北辰物流桃園轉運中心會勘', from: '2026-10-09', to: '2026-10-09', customer: '北辰物流' }, files: [], status: '已預約' },
])

export interface StockItem {
  sku: string
  name: string
  batch: string
  qty: number
  unitCost: number
  location: string
  receivedAt: string
  reserved: number
  /** 保留給哪張 SO */
  reservedFor?: string
  /** 來自哪張 PO */
  poNo?: string
}

export const stock: StockItem[] = reactive([
  { sku: 'FTN-FG100F', name: 'FortiGate 100F', batch: 'B-2026-0905-02', qty: 2, unitCost: 182_000, location: '內湖倉', receivedAt: '2026-09-05', reserved: 0 },
  { sku: 'FTN-FG60F', name: 'FortiGate 60F', batch: 'B-2026-0611-01', qty: 1, unitCost: 42_000, location: '內湖倉', receivedAt: '2026-06-11', reserved: 0 },
  { sku: 'FTN-FG60F', name: 'FortiGate 60F', batch: 'B-2026-0611-01-H1', qty: 4, unitCost: 42_000, location: '內湖倉', receivedAt: '2026-06-11', reserved: 4, reservedFor: 'D-2026-1015-003' },
  { sku: 'FTN-FS148F', name: 'FortiSwitch 148F-POE', batch: 'B-2026-0820-01', qty: 4, unitCost: 39_000, location: '內湖倉', receivedAt: '2026-08-20', reserved: 0 },
  { sku: 'SPH-XGS2100', name: 'Sophos XGS 2100', batch: 'B-2026-0302-01', qty: 1, unitCost: 128_000, location: '內湖倉', receivedAt: '2026-03-02', reserved: 0 },
])

export interface Announcement {
  id: string
  title: string
  body: string
  author: string
  at: string
  pinned?: boolean
}

export const announcements: Announcement[] = [
  { id: 'an1', title: '10/15 起上單送審改用新系統，舊系統只讀', body: '業務請於 10/15 前把進行中的報價搬到新系統；舊系統保留查詢三個月。有問題找資訊室。', author: '王承恩', at: '2026-10-06T09:00:00+08:00', pinned: true },
  { id: 'an2', title: '第四季原廠促銷價格表已更新', body: 'FortiGate 全系列 Q4 促銷價已放在附件中心「價格表」，報價請以新表為準。', author: '黃彥霖', at: '2026-10-02T14:30:00+08:00' },
  { id: 'an3', title: '10/10 國慶日休假，客服值班表', body: '當天由北區業務輪值接客戶電話，值班表見內文。', author: '劉欣怡', at: '2026-09-30T17:00:00+08:00' },
]

export type AttachmentType = '客戶回簽' | '廠商報價單' | '廠商簽回' | '出貨簽收' | '驗收單' | '報價單 PDF' | '行政申請' | '供應商文件' | '其他'

export interface Attachment {
  id: string
  type: AttachmentType
  refNo: string
  party: string
  fileName: string
  /** 其他附件的顯示名稱（合約書、會議紀錄這類由上傳者命名） */
  title?: string
  uploader: string
  at: string
  sizeKb: number
  scan: '通過' | '隔離'
  hash: string
  voided?: boolean
}

export const attachments: Attachment[] = [
  { id: 'f1', type: '廠商報價單', refNo: 'D-2026-0914-003', party: '原廠台灣總代理 A', fileName: 'A-Quote-20260930.pdf', uploader: '陳冠宇', at: '2026-10-03T15:20:00+08:00', sizeKb: 412, scan: '通過', hash: '9f3a…c21e' },
  { id: 'f2', type: '廠商報價單', refNo: 'D-2026-0914-003', party: '通路商 B', fileName: 'B-Quote-FS148F.pdf', uploader: '黃彥霖', at: '2026-10-06T10:12:00+08:00', sizeKb: 188, scan: '通過', hash: '1c77…8b04' },
  { id: 'f3', type: '報價單 PDF', refNo: 'D-2026-0914-003 v1', party: '崇光醫療體系', fileName: 'QT-D-2026-0914-003-v1.pdf', uploader: '陳冠宇', at: '2026-10-03T15:31:00+08:00', sizeKb: 96, scan: '通過', hash: 'e02d…77aa' },
  { id: 'f4', type: '客戶回簽', refNo: 'D-2026-0901-007', party: '晴川商業銀行', fileName: '晴川商業銀行-回簽-v1.pdf', uploader: '陳冠宇', at: '2026-10-05T09:30:00+08:00', sizeKb: 1340, scan: '通過', hash: '5b19…0d3f' },
  { id: 'f5', type: '客戶回簽', refNo: 'D-2026-0820-001', party: '台灣聯合租賃', fileName: '台灣聯合租賃-回簽-v1.pdf', uploader: '林雅婷', at: '2026-09-28T17:10:00+08:00', sizeKb: 2210, scan: '通過', hash: 'a8c0…4e61' },
  { id: 'f6', type: '廠商簽回', refNo: '2026-10-01-003', party: '原廠台灣總代理 A', fileName: 'PO-2026-10-01-003-signed.pdf', uploader: '黃彥霖', at: '2026-10-07T16:30:00+08:00', sizeKb: 520, scan: '通過', hash: '3d4f…92c8' },
  { id: 'f8', type: '出貨簽收', refNo: 'SO-2026-0515-001', party: '立德大學', fileName: '立德-簽收單掃描.pdf', uploader: '林雅婷', at: '2026-06-02T14:00:00+08:00', sizeKb: 880, scan: '通過', hash: 'c9a3…15d0' },
  { id: 'f8b', type: '驗收單', refNo: 'SO-2026-0515-001', party: '立德大學', fileName: '立德-驗收單.pdf', uploader: '林雅婷', at: '2026-06-02T14:05:00+08:00', sizeKb: 640, scan: '通過', hash: 'a71e…02c4' },
  { id: 'f9', type: '其他', refNo: 'D-2026-0928-002', party: '立德大學', fileName: 'EDR-POC-計畫書.docx', uploader: '陳冠宇', at: '2026-10-07T18:05:00+08:00', sizeKb: 310, scan: '通過', hash: '0b6e…3a9c' },
  { id: 'f11', type: '客戶回簽', refNo: 'D-2026-0922-001', party: '北辰物流', fileName: '北辰物流-回簽-v1.pdf', uploader: '陳冠宇', at: '2026-09-26T16:40:00+08:00', sizeKb: 1180, scan: '通過', hash: '7a2e…c0b1' },
  { id: 'f12', type: '客戶回簽', refNo: 'D-2026-0620-002', party: '國昌建設', fileName: '國昌建設-回簽-v1.pdf', uploader: '陳冠宇', at: '2026-07-09T15:20:00+08:00', sizeKb: 1260, scan: '通過', hash: '2c9d…41f8' },
  { id: 'f13', type: '客戶回簽', refNo: 'D-2026-0410-004', party: '立德大學', fileName: '立德大學-回簽-v1.pdf', uploader: '林雅婷', at: '2026-05-06T10:15:00+08:00', sizeKb: 990, scan: '通過', hash: 'd5e7…9a30' },
  { id: 'f14', type: '廠商報價單', refNo: 'D-2026-0922-001 v1', party: '原廠台灣總代理 C', fileName: 'C-Quote-20260920.pdf', uploader: '陳冠宇', at: '2026-09-21T09:30:00+08:00', sizeKb: 402, scan: '通過', hash: '8b1f…d2a7' },
  { id: 'f15', type: '廠商報價單', refNo: 'D-2026-0901-007 v1', party: '原廠台灣總代理 A', fileName: 'A-Quote-20260915.pdf', uploader: '陳冠宇', at: '2026-09-16T11:00:00+08:00', sizeKb: 388, scan: '通過', hash: '4e63…7b19' },
  { id: 'f16', type: '廠商報價單', refNo: 'D-2026-0820-001 v1', party: '原廠台灣總代理 A', fileName: 'A-Quote-20260918.pdf', uploader: '林雅婷', at: '2026-09-19T14:10:00+08:00', sizeKb: 356, scan: '通過', hash: 'a19c…52e0' },
  { id: 'f17', type: '廠商報價單', refNo: 'D-2026-0905-002 v1', party: '原廠台灣總代理 A', fileName: 'A-Quote-20260910.pdf', uploader: '陳冠宇', at: '2026-09-11T10:20:00+08:00', sizeKb: 301, scan: '通過', hash: 'c7d0…3f64' },
  { id: 'f18', type: '廠商報價單', refNo: 'D-2026-0620-002 v1', party: '原廠台灣總代理 A', fileName: 'A-Quote-20260630.pdf', uploader: '陳冠宇', at: '2026-07-01T09:45:00+08:00', sizeKb: 420, scan: '通過', hash: 'e8a2…1c55' },
  { id: 'f19', type: '廠商報價單', refNo: 'D-2026-0410-004 v1', party: '通路商 B', fileName: 'B-Quote-20260425.pdf', uploader: '林雅婷', at: '2026-04-26T13:30:00+08:00', sizeKb: 214, scan: '通過', hash: '0f4b…8e92' },
  { id: 'f22', type: '客戶回簽', refNo: 'D-2026-1015-003', party: '國昌建設', fileName: '國昌建設工地監控-回簽-v1.pdf', uploader: '陳冠宇', at: '2026-10-22T15:30:00+08:00', sizeKb: 980, scan: '通過', hash: '3b7f…e21c' },
  { id: 'f23', type: '廠商報價單', refNo: 'D-2026-1015-003 v1', party: '原廠台灣總代理 A', fileName: 'A-Quote-20261019.pdf', uploader: '陳冠宇', at: '2026-10-19T14:00:00+08:00', sizeKb: 290, scan: '通過', hash: '7d02…4f9a' },
  { id: 'f24', type: '客戶回簽', refNo: 'D-2026-1012-005', party: '立德大學', fileName: '立德大學計算機中心-回簽-v1.pdf', uploader: '林雅婷', at: '2026-10-25T10:30:00+08:00', sizeKb: 1120, scan: '通過', hash: 'a5c3…19be' },
  { id: 'f25', type: '廠商報價單', refNo: 'D-2026-1012-005 v1', party: '通路商 B', fileName: 'B-Quote-20261023.pdf', uploader: '林雅婷', at: '2026-10-23T16:20:00+08:00', sizeKb: 344, scan: '通過', hash: 'c81e…6d07' },
  { id: 'f21', type: '客戶回簽', refNo: 'D-2026-0930-006', party: '北辰物流', fileName: '北辰物流資訊部-回簽-v1.pdf', uploader: '林雅婷', at: '2026-10-10T09:40:00+08:00', sizeKb: 1210, scan: '通過', hash: '9c1e…a7d2' },
  { id: 'f20', type: '廠商報價單', refNo: 'D-2026-0930-006 v1', party: '原廠台灣總代理 A', fileName: 'A-Quote-20261001.pdf', uploader: '林雅婷', at: '2026-10-02T10:00:00+08:00', sizeKb: 377, scan: '通過', hash: '6d2a…b4c3' },
  { id: 'f10', type: '其他', refNo: 'D-2026-0922-001', party: '北辰物流', fileName: '中間商議價紀錄.xlsx', uploader: '陳冠宇', at: '2026-10-01T10:40:00+08:00', sizeKb: 45, scan: '通過', hash: 'f41d…6e07', voided: true },
]

export interface HandoverCase {
  id: string
  customer: string
  customerDept: string
  leavingUser: string
  leaveDate: string
  openDeals: number
  openOrders: number
  successor?: string
  status: '待交接' | '已完成'
  completedAt?: string
}

export const handovers: HandoverCase[] = [
  { id: 'h1', customer: '崇光醫療體系', customerDept: '資訊室', leavingUser: '陳冠宇', leaveDate: '2026-10-31', openDeals: 1, openOrders: 0, status: '待交接' },
  { id: 'h2', customer: '北辰物流', customerDept: '總管理處', leavingUser: '陳冠宇', leaveDate: '2026-10-31', openDeals: 1, openOrders: 0, status: '待交接' },
  { id: 'h3', customer: '晴川商業銀行', customerDept: '資安處', leavingUser: '陳冠宇', leaveDate: '2026-10-31', openDeals: 0, openOrders: 1, status: '待交接' },
  { id: 'h4', customer: '立德大學', customerDept: '計算機中心', leavingUser: '陳冠宇', leaveDate: '2026-10-31', openDeals: 1, openOrders: 0, status: '待交接' },
  { id: 'h5', customer: '鴻鼎精密', customerDept: '研發處', leavingUser: '陳冠宇', leaveDate: '2026-10-31', openDeals: 1, openOrders: 0, status: '待交接' },
  { id: 'h6', customer: '國昌建設', customerDept: '資訊部', leavingUser: '周柏翰', leaveDate: '2026-06-30', openDeals: 0, openOrders: 1, successor: '陳冠宇', status: '已完成', completedAt: '2026-06-25' },
]

/* ---------- 預留貨（1112 會議 #7）：業務在報價階段申請保留庫存，採購核准；到期自動釋放、到期前 3 天提醒 ---------- */
export interface StockHold {
  id: string
  dealId: string
  dealNo: string
  sku: string
  qty: number
  /** 申請天數；採購核准時可縮短 */
  days: number
  status: '待核准' | '保留中' | '已轉 SO' | '已釋放' | '已退回'
  requesterId: string
  requester: string
  requestedAt: string
  approvedAt?: string
  approver?: string
  /** 保留到哪一天（含） */
  expiresAt?: string
  /** 保留在哪些批次（先進先出，不夠就跨批；部分保留時拆出子批，每批只屬於一個對象） */
  allocs?: { batch: string; qty: number }[]
  note?: string
}
/** 預留貨的「今天」（示範資料固定日期） */
export const HOLD_TODAY = '2026-11-03'
/** 閒置：三個月（90 天）階段沒變；示範資料以 2026-11-03 為今天 */
export const IDLE_DAYS = 90
export const IDLE_TODAY = '2026-11-03'
export const stageIdleDays = (d: Pick<Deal, 'stage' | 'stageAt' | 'updatedAt'>) =>
  d.stage === 'SO已成立' || d.stage === '未成交' ? 0 : Math.floor((new Date(IDLE_TODAY).getTime() - new Date(d.stageAt ?? d.updatedAt).getTime()) / 86400000)
export const isIdle = (d: Pick<Deal, 'stage' | 'stageAt' | 'updatedAt'>) => stageIdleDays(d) >= IDLE_DAYS
export const stockHolds: StockHold[] = reactive([
  { id: 'h1', dealId: 'd13', dealNo: 'D-2026-1015-003', sku: 'FTN-FG60F', qty: 4, days: 15, status: '保留中', requesterId: 'u-chen', requester: '陳冠宇', requestedAt: '2026-10-20T10:12:00+08:00', approvedAt: '2026-10-21T09:05:00+08:00', approver: '黃彥霖', expiresAt: '2026-11-05', allocs: [{ batch: 'B-2026-0611-01-H1', qty: 4 }] },
  { id: 'h2', dealId: 'd1', dealNo: 'D-2026-0914-003', sku: 'FTN-FS148F', qty: 2, days: 30, status: '待核准', requesterId: 'u-chen', requester: '陳冠宇', requestedAt: '2026-11-02T15:40:00+08:00' },
])

/* ---------- 自有服務項目（1112 會議 #10）：自有工程的品項與標準成本由系統管理維護，業務只能選 ---------- */
export interface OwnService {
  code: string
  name: string
  unit: string
  /** 標準成本（未稅） */
  cost: number
  active: boolean
}
export const ownServices: OwnService[] = reactive([
  { code: 'SVC-INSTALL-L1', name: '基本安裝設定', unit: '式', cost: 22_000, active: true },
  { code: 'SVC-INSTALL-L2', name: '安裝建置與移轉服務', unit: '式', cost: 95_000, active: true },
  { code: 'SVC-INSTALL-L3', name: '多點安裝與 SD-WAN 設定', unit: '式', cost: 45_000, active: true },
  { code: 'SVC-DEPLOY-L3', name: '大型部署與教育訓練', unit: '式', cost: 420_000, active: true },
  { code: 'SVC-ONSITE-DAY', name: '駐點工程師（人天）', unit: '人天', cost: 8_000, active: true },
  { code: 'SVC-HEALTH', name: '設備健檢報告', unit: '次', cost: 12_000, active: true },
  { code: 'SVC-TRAIN', name: '教育訓練（半天）', unit: '場', cost: 15_000, active: false },
])
