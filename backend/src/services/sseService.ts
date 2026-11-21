import { Response } from 'express';
import { redisPub, redisSub } from '../config/redis';
import { logger } from '../config/logger';

const EVENT_CHANNEL = 'certiflow:events';

class SSEService {
  private clients: Set<Response> = new Set();
  private isSubscribed = false;

  constructor() {
    this.setupRedisSubscriber();
    this.setupHeartbeat();
  }

  private setupRedisSubscriber() {
    if (this.isSubscribed) return;

    redisSub.subscribe(EVENT_CHANNEL, (err) => {
      if (err) {
        logger.error({ err }, '[SSE] Failed to subscribe to Redis events channel');
      } else {
        this.isSubscribed = true;
        logger.info('[SSE] Subscribed to Redis events channel');
      }
    });

    redisSub.on('message', (channel, message) => {
      if (channel === EVENT_CHANNEL) {
        this.broadcastToLocalClients(message);
      }
    });
  }

  private setupHeartbeat() {
    setInterval(() => {
      for (const client of this.clients) {
        client.write(': heartbeat\n\n');
      }
    }, 15000);
  }

  public addClient(res: Response) {
    this.clients.add(res);
    logger.debug(`[SSE] Client connected. Active clients: ${this.clients.size}`);

    // Send initial connected event
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      this.clients.delete(res);
      logger.debug(`[SSE] Client disconnected. Active clients: ${this.clients.size}`);
    });
  }

  public async publishEvent(eventType: string, payload: any) {
    const eventData = JSON.stringify({
      type: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    try {
      await redisPub.publish(EVENT_CHANNEL, eventData);
    } catch (err) {
      logger.error({ err }, '[SSE] Error publishing event to Redis');
      // Fallback: broadcast locally if Redis publish fails
      this.broadcastToLocalClients(eventData);
    }
  }

  private broadcastToLocalClients(rawPayload: string) {
    for (const client of this.clients) {
      client.write(`data: ${rawPayload}\n\n`);
    }
  }
}

export const sseService = new SSEService();
