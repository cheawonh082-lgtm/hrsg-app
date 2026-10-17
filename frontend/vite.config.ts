import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // 백엔드는 127.0.0.1에만 바인딩하고 프론트 dev 서버가 프록시한다 (PRD §1.6 LAN 모드 포함)
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
