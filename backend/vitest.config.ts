import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: 'postgresql://certiflow:certiflow_secret@localhost:5432/certiflow?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'certiflow-test-jwt-secret',
      HMAC_SECRET: 'certiflow-test-hmac-secret',
      MOCK_WHATSAPP_URL: 'http://localhost:3001',
      CERT_STORAGE_PATH: './certs_test',
      PUBLIC_APP_URL: 'http://localhost:5173',
      API_URL: 'http://localhost:3000',
      SLA_TIMEOUT_MS: '500',
      PORT: '0',
      NODE_ENV: 'test',
    },
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
