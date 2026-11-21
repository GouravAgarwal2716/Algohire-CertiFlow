import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

interface WhatsAppMessage {
  id: string;
  to: string;
  message: string;
  downloadUrl?: string;
  certificateNumber?: string;
  timestamp: string;
  idempotencyKey?: string;
}

interface IdempotentResponse {
  statusCode: number;
  body: any;
}

// In-memory message store and idempotency cache
const messages: WhatsAppMessage[] = [];
const idempotencyStore = new Map<string, IdempotentResponse>();

// Chaos configuration (controllable via env or runtime POST /chaos)
let chaosConfig = {
  failRate: parseFloat(process.env.FAIL_RATE || '0'),
  timeoutRate: parseFloat(process.env.TIMEOUT_RATE || '0'),
  timeoutMs: parseInt(process.env.TIMEOUT_MS || '2000', 10),
};

console.log('[Mock-WhatsApp] Initialized with chaos config:', chaosConfig);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    totalMessagesDelivered: messages.length,
    chaos: chaosConfig,
    uptime: process.uptime(),
  });
});

// Configure chaos at runtime (for test suites and live demo)
app.post('/chaos', (req: Request, res: Response) => {
  const { failRate, timeoutRate, timeoutMs } = req.body;
  if (typeof failRate === 'number') chaosConfig.failRate = Math.max(0, Math.min(1, failRate));
  if (typeof timeoutRate === 'number') chaosConfig.timeoutRate = Math.max(0, Math.min(1, timeoutRate));
  if (typeof timeoutMs === 'number') chaosConfig.timeoutMs = Math.max(0, timeoutMs);

  console.log('[Mock-WhatsApp] Chaos configuration updated:', chaosConfig);
  res.json({ status: 'updated', chaos: chaosConfig });
});

// Reset messages and idempotency store (for fresh test runs)
app.post('/reset', (_req: Request, res: Response) => {
  messages.length = 0;
  idempotencyStore.clear();
  console.log('[Mock-WhatsApp] In-memory messages and idempotency cache cleared.');
  res.json({ status: 'cleared', totalMessages: 0 });
});

// Get sent messages (newest first, with optional search/filter)
app.get('/messages', (req: Request, res: Response) => {
  const { to, cert } = req.query;
  let results = [...messages];

  if (typeof to === 'string' && to.trim()) {
    results = results.filter((m) => m.to.includes(to.trim()));
  }
  if (typeof cert === 'string' && cert.trim()) {
    results = results.filter((m) => m.certificateNumber?.includes(cert.trim()));
  }

  // Newest first
  results.reverse();

  res.json({
    count: results.length,
    messages: results,
  });
});

// Send message endpoint
app.post('/send', async (req: Request, res: Response) => {
  const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
  const { to, message, downloadUrl, certificateNumber } = req.body;

  if (!to || !message) {
    res.status(400).json({ error: 'Missing mandatory fields: "to" and "message" are required' });
    return;
  }

  // 1. Idempotency Check: if this key has already succeeded or was processed, return the exact same response
  if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
    const cached = idempotencyStore.get(idempotencyKey)!;
    console.log(`[Mock-WhatsApp] Idempotent replay for key: ${idempotencyKey}`);
    res.status(cached.statusCode).json({
      ...cached.body,
      idempotentReplay: true,
    });
    return;
  }

  // 2. Simulated Timeout Chaos
  if (chaosConfig.timeoutRate > 0 && Math.random() < chaosConfig.timeoutRate) {
    console.warn(`[Mock-WhatsApp Chaos] Simulating network timeout (${chaosConfig.timeoutMs}ms) for recipient: ${to}`);
    await new Promise((resolve) => setTimeout(resolve, chaosConfig.timeoutMs));
    // 504 Gateway Timeout simulation
    res.status(504).json({ error: 'Upstream WhatsApp Gateway Timeout' });
    return;
  }

  // 3. Simulated Failure Chaos (Transient 500 error)
  if (chaosConfig.failRate > 0 && Math.random() < chaosConfig.failRate) {
    console.warn(`[Mock-WhatsApp Chaos] Simulating transient WhatsApp API 500 failure for recipient: ${to}`);
    res.status(500).json({ error: 'Simulated transient WhatsApp network failure' });
    return;
  }

  // 4. Successful delivery
  const messageId = `wamid.${Date.now()}.${Math.random().toString(36).substring(2, 9)}`;
  const record: WhatsAppMessage = {
    id: messageId,
    to,
    message,
    downloadUrl,
    certificateNumber,
    timestamp: new Date().toISOString(),
    idempotencyKey,
  };

  messages.push(record);

  const successResponse = {
    status: 'success',
    messageId,
    to,
    certificateNumber,
    deliveredAt: record.timestamp,
  };

  // Cache in idempotency store if key provided
  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, {
      statusCode: 200,
      body: successResponse,
    });
  }

  console.log(`[Mock-WhatsApp] Message delivered -> ID: ${messageId} | Recipient: ${to} | Cert: ${certificateNumber || 'N/A'}`);
  res.status(200).json(successResponse);
});

app.listen(PORT, () => {
  console.log(`[Mock-WhatsApp] Service running on http://localhost:${PORT}`);
});
