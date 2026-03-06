import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths' // 1. import plugin

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths() // 2. เพิ่มลงใน plugins
  ],
  // ไม่ต้องใส่ resolve alias แล้วครับ สะดวกกว่าเยอะ!
})
