import { Router, Request, Response } from 'express';
import { sseService } from '../services/sseService';

const router = Router();

// Server-Sent Events (SSE) Stream
router.get('/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.flushHeaders();
  sseService.addClient(res);
});

export default router;
