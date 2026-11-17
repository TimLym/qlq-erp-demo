import { createRouter, createWebHashHistory } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('../pages/Home.vue'), meta: { title: '首頁' } },
    { path: '/notifications', component: () => import('../pages/Notifications.vue'), meta: { title: '通知中心' } },
    { path: '/settings', component: () => import('../pages/Settings.vue'), meta: { title: '個人設定' } },
    { path: '/files', redirect: '/approvals/files' },
    { path: '/admin/handover', component: () => import('../pages/admin/Handover.vue'), meta: { title: '離職業務交接' } },
    { path: '/approvals', component: () => import('../pages/approvals/ApprovalCenter.vue'), meta: { title: '簽核中心', tab: 'pending' } },
    { path: '/approvals/mine', component: () => import('../pages/approvals/ApprovalCenter.vue'), meta: { title: '簽核中心', tab: 'mine' } },
    { path: '/approvals/history', component: () => import('../pages/approvals/ApprovalCenter.vue'), meta: { title: '簽核中心', tab: 'history' } },
    { path: '/approvals/signoff', component: () => import('../pages/approvals/ApprovalCenter.vue'), meta: { title: '簽核中心', tab: 'signoff' } },
    { path: '/approvals/files', component: () => import('../pages/approvals/ApprovalCenter.vue'), meta: { title: '簽核中心', tab: 'files' } },
    { path: '/sales/pipeline', component: () => import('../pages/sales/Pipeline.vue'), meta: { title: '潛在商機（Pipeline）' } },
    { path: '/sales/submit', redirect: (to) => ({ path: '/sales/pipeline', query: { deal: to.query.deal, tab: 'quotes', quote: to.query.quote } }) },
    { path: '/sales/orders', component: () => import('../pages/sales/Orders.vue'), meta: { title: '銷售訂單（SO）' } },
    { path: '/sales/customers', component: () => import('../pages/sales/Customers.vue'), meta: { title: '客戶管理（CRM）' } },
    { path: '/sales/performance', component: () => import('../pages/sales/Performance.vue'), meta: { title: '業績與獎金' } },
    { path: '/purchase/vendors', component: () => import('../pages/purchase/Vendors.vue'), meta: { title: '供應商主檔' } },
    { path: '/inventory/shipments', component: () => import('../pages/inventory/Shipments.vue'), meta: { title: '出貨單' } },
    { path: '/inventory/licenses', component: () => import('../pages/inventory/Licenses.vue'), meta: { title: '到期項目' } },
    { path: '/apps', component: () => import('../pages/apps/Apps.vue'), meta: { title: '行政申請' } },
    { path: '/apps/:type', redirect: (to) => ({ path: '/apps', query: { tab: String(to.params.type) } }) },
    { path: '/ext/verify/:code', component: () => import('../pages/ext/ExtVerify.vue'), meta: { title: '報價單驗證', ext: true } },
    { path: '/ext/sign/:token', component: () => import('../pages/ext/ExtSign.vue'), meta: { title: '出貨簽收', ext: true } },
    { path: '/purchase/po', component: () => import('../pages/purchase/PoList.vue'), meta: { title: '採購單' } },
    { path: '/purchase/allocate', component: () => import('../pages/purchase/Allocate.vue'), meta: { title: 'PO 分配' } },
    { path: '/purchase/transfer-prices', component: () => import('../pages/purchase/TransferPrices.vue'), meta: { title: '料號與品項參考成本' } },
    { path: '/inventory', component: () => import('../pages/inventory/Stock.vue'), meta: { title: '庫存查詢' } },
    { path: '/admin/approval-rules', component: () => import('../pages/admin/ApprovalRules.vue'), meta: { title: '簽核進度設定' } },
    { path: '/admin/expiry-kinds', component: () => import('../pages/admin/ExpiryKinds.vue'), meta: { title: '到期類型' } },
    { path: '/admin/own-services', component: () => import('../pages/admin/OwnServices.vue'), meta: { title: '自有服務項目' } },
    { path: '/admin/permissions', component: () => import('../pages/admin/Permissions.vue'), meta: { title: '角色與權限' } },
    { path: '/denied', component: () => import('../pages/Denied.vue'), meta: { title: '沒有權限' } },
    { path: '/:pathMatch(.*)*', component: () => import('../pages/Planned.vue'), meta: { title: '規劃中' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

/* 守門：這個角色沒有這一頁的檢視權限就到「沒有權限」頁（外部頁不管） */
router.beforeEach((to) => {
  if (to.meta.ext || to.path === '/denied') return true
  const store = useAppStore()
  if (store.can(to.path)) return true
  return { path: '/denied', query: { from: to.fullPath } }
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? ''
  document.title = title ? `${title} | 銓立光 ERP` : '銓立光 ERP'
})

export default router
