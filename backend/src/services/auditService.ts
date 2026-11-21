import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { logger } from '../config/logger';

export interface AuditLogParams {
  correlationId?: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: string | null;
  newState?: string | null;
  metadata?: any;
}

export class AuditService {
  /**
   * Appends an audit entry. Can participate in an existing Prisma transaction.
   */
  public static async record(params: AuditLogParams, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    try {
      const log = await db.auditLog.create({
        data: {
          correlationId: params.correlationId || null,
          actorId: params.actorId || null,
          actorRole: params.actorRole || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          previousState: params.previousState || null,
          newState: params.newState || null,
          metadata: params.metadata || Prisma.DbNull,
        },
      });
      return log;
    } catch (err) {
      logger.error({ err, params }, '[AuditLog] Failed to write audit log');
      throw err;
    }
  }

  public static async getLogsForEntity(entityId: string) {
    return prisma.auditLog.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
