import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 用相對路徑建置，放在 GitHub Pages 的子路徑也能載入
  base: './',
  plugins: [vue()],
})
