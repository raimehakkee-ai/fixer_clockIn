import type { Request, Response } from 'express';

import { prisma } from '../db';

export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const serverTime = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      ok: true,
      db: 'ok',
      serverTime,
      version: '1',
    });
  } catch {
    res.status(503).json({
      ok: false,
      db: 'error',
      serverTime,
      version: '1',
    });
  }
}
