import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/certiflow?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'certiflow-jwt-super-secret-key-2026',
  hmacSecret: process.env.HMAC_SECRET || 'certiflow-hmac-tamper-proof-secret-2026',
  mockWhatsappUrl: process.env.MOCK_WHATSAPP_URL || 'http://localhost:3001',
  slaTimeoutMs: parseInt(process.env.SLA_TIMEOUT_MS || '60000', 10), // 1 min for demo, configurable
  certStoragePath: process.env.CERT_STORAGE_PATH || path.resolve(process.cwd(), 'certs'),
  publicAppUrl: process.env.PUBLIC_APP_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};
