import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './env';
import { ApiError } from './lib/errors';
import { errorHandler } from './middleware/error';
import { attendanceRouter } from './routes/attendance';
import { auditLogsRouter } from './routes/audit-logs';
import { authRouter } from './routes/auth';
import { devicesRouter } from './routes/devices';
import { employeesRouter } from './routes/employees';
import { healthHandler } from './routes/health';
import { leaveRequestsRouter } from './routes/leave-requests';
import { officeLocationsRouter } from './routes/office-locations';
import { reportsRouter } from './routes/reports';
import { shiftsRouter } from './routes/shifts';

function parseTrustProxy(value: string): boolean | number {
  if (value === 'false') return false;
  if (value === 'true') return true;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));

  app.use((req: Request, res: Response, next: NextFunction) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new ApiError(403, 'FORBIDDEN', 'Origin tidak diizinkan.'));
      },
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      exposedHeaders: ['X-Request-Id', 'Retry-After'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.NODE_ENV === 'test' ? 'tiny' : 'dev', { skip: () => env.NODE_ENV === 'test' }));

  app.get('/api/v1/health', healthHandler);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/employees', employeesRouter);
  app.use('/api/v1/devices', devicesRouter);
  app.use('/api/v1/office-locations', officeLocationsRouter);
  app.use('/api/v1/shifts', shiftsRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/leave-requests', leaveRequestsRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/audit-logs', auditLogsRouter);

  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notFound('Endpoint tidak ditemukan.'));
  });

  app.use(errorHandler);

  return app;
}
