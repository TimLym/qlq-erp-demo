import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'

import App from './App.vue'
import router from './router'
import './style.css'

ModuleRegistry.registerModules([AllCommunityModule])

/* 表單不做原生送出：單一輸入框按 Enter 時瀏覽器會送出表單、整頁重新載入，示範資料會不見 */
document.addEventListener('submit', (e) => e.preventDefault(), true)
/* 數字欄位：點進去整格選取，打字直接取代原值，不會變成 01000 這類接在後面的數字 */
document.addEventListener('focusin', (e) => {
  const t = e.target as HTMLInputElement | null
  if (t?.tagName === 'INPUT' && t.closest('.el-input-number')) requestAnimationFrame(() => t.select())
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhTw })
app.mount('#app')
