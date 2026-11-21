import express from 'express';
import cors from 'cors';
import path from 'path';
import { correlationMiddleware } from './middleware/correlation';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import batchRoutes from './routes/batch.routes';
import certRoutes from './routes/cert.routes';
import publicRoutes from './routes/public.routes';
import eventRoutes from './routes/event.routes';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(correlationMiddleware);

  // Serve sample test CSVs
  app.use('/samples', express.static(path.resolve(process.cwd(), '../samples')));
  app.use('/api/samples', express.static(path.resolve(process.cwd(), '../samples')));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'certiflow-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Mount API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/batches', batchRoutes);
  app.use('/api/certificates', certRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/events', eventRoutes);

  // Error Handler
  app.use(errorHandler);

  return app;
}
