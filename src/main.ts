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

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhTw })
app.mount('#app')
