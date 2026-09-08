import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

// Fail-closed: exige JWT_SECRET explicitamente configurado no ambiente ou .env.
// Impede segredos estáticos versionados e mascara de falhas de configuração.
if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET não está definido. Configure JWT_SECRET via variável de ambiente ou arquivo .env para executar os testes E2E com segurança (fail-closed).'
  );
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3001',
    viewport: { width: 1280, height: 720 },
    trace: 'on',
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    screenshot: 'on',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      NODE_ENV: 'development',
      JWT_SECRET: process.env.JWT_SECRET,
    },
  },
});
