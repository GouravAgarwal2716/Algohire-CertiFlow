import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: role '${req.user.role}' is not authorized to perform this action. Required: [${allowedRoles.join(', ')}]`,
      });
      return;
    }

    next();
  };
}
