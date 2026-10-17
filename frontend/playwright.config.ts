import { defineConfig } from '@playwright/test'

const python = process.platform === 'win32' ? '.venv\\Scripts\\python' : '.venv/bin/python'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome', // 설치된 Chrome 사용 (브라우저 별도 다운로드 불필요)
    trace: 'retain-on-failure',
  },
  // 이미 실행 중이면 재사용, 아니면 백엔드·프론트를 띄운다
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
})
