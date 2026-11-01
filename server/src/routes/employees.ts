import { Router } from 'express';
import { z } from 'zod';

import { writeAudit } from '../lib/audit';
import { toEmployeeDto } from '../lib/dto';
import { ApiError } from '../lib/errors';
import { paginated } from '../lib/pagination';
import { idParam } from '../lib/params';
import { actor } from '../lib/request-user';
import {
  emailSchema,
  paginationSchema,
  passwordSchema,
} from '../lib/validation';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/require-role';
import * as employees from '../services/employee-service';

const createEmployeeSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  employeeNumber: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(2).max(150),
  department: z.string().trim().max(100).nullable().optional(),
  position: z.string().trim().max(100).nullable().optional(),
  officeLocationId: z.string().uuid().nullable().optional(),
});

const updateEmployeeSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150).optional(),
    department: z.string().trim().max(100).nullable().optional(),
    position: z.string().trim().max(100).nullable().optional(),
    officeLocationId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Minimal satu field harus diisi.',
  });

const statusSchema = z.object({ isActive: z.boolean() });
const resetPasswordSchema = z.object({ newPassword: passwordSchema });

const listQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

export const employeesRouter = Router();

employeesRouter.use(authenticate);

employeesRouter.get('/me', async (req, res) => {
  const current = actor(req);

  if (!current.employeeId) {
    throw ApiError.notFound('Akun ini tidak memiliki data karyawan.');
  }

  const employee = await employees.getEmployeeById(current.employeeId);
  res.json({ employee: toEmployeeDto(employee) });
});

employeesRouter.get('/', requireRole('ADMIN'), async (req, res) => {
  const query = listQuerySchema.parse(req.query);

  const { rows, total } = await employees.listEmployees({
    q: query.q,
    page: query.page,
    limit: query.limit,
    includeInactive: query.includeInactive === 'true',
  });

  res.json(paginated(rows.map(toEmployeeDto), total, query));
});

employeesRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const body = createEmployeeSchema.parse(req.body);
  const employee = await employees.createEmployee(body);
  const current = actor(req);

  await writeAudit({
    actorUserId: current.id,
    action: 'EMPLOYEE_CREATED',
    entityType: 'employee',
    entityId: employee.id,
    metadata: { employeeNumber: employee.employeeNumber },
    req,
  });

  res.status(201).json({ employee: toEmployeeDto(employee) });
});

employeesRouter.get('/:id', requireRole('ADMIN'), async (req, res) => {
  const employee = await employees.getEmployeeById(idParam(req));
  res.json({ employee: toEmployeeDto(employee) });
});

employeesRouter.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const body = updateEmployeeSchema.parse(req.body);
  const employee = await employees.updateEmployee(idParam(req), body);
  const current = actor(req);

  await writeAudit({
    actorUserId: current.id,
    action: 'EMPLOYEE_UPDATED',
    entityType: 'employee',
    entityId: employee.id,
    metadata: { fields: Object.keys(body).join(',') },
    req,
  });

  res.json({ employee: toEmployeeDto(employee) });
});

employeesRouter.patch('/:id/status', requireRole('ADMIN'), async (req, res) => {
  const body = statusSchema.parse(req.body);
  const employee = await employees.setEmployeeStatus(idParam(req), body.isActive);
  const current = actor(req);

  await writeAudit({
    actorUserId: current.id,
    action: 'EMPLOYEE_STATUS_CHANGED',
    entityType: 'employee',
    entityId: employee.id,
    metadata: { isActive: body.isActive },
    req,
  });

  res.json({ employee: toEmployeeDto(employee) });
});

employeesRouter.post(
  '/:id/reset-password',
  requireRole('ADMIN'),
  async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    await employees.resetEmployeePassword(idParam(req), body.newPassword);
    const current = actor(req);

    await writeAudit({
      actorUserId: current.id,
      action: 'PASSWORD_RESET',
      entityType: 'employee',
      entityId: idParam(req),
      metadata: {},
      req,
    });

    res.status(204).send();
  },
);

employeesRouter.post(
  '/:id/reset-device',
  requireRole('ADMIN'),
  async (req, res) => {
    const current = actor(req);
    const revokedDevices = await employees.resetEmployeeDevice(
      idParam(req),
      current.id,
    );

    await writeAudit({
      actorUserId: current.id,
      action: 'DEVICE_RESET',
      entityType: 'employee',
      entityId: idParam(req),
      metadata: { revokedDevices },
      req,
    });

    res.json({ revokedDevices });
  },
);
