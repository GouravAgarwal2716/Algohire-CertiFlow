import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { signUserToken, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Demo login endpoint: returns a signed cryptographic JWT for any demo persona
router.post('/demo-login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      throw new AppError(400, 'User ID is required for demo login');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'Demo user not found');
    }

    const token = signUserToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      districtId: user.districtId,
      centreId: user.centreId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        districtId: user.districtId,
        centreId: user.centreId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// List all seeded demo users for the switcher UI
router.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Current user profile
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
