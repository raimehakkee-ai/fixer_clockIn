import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db';
import { dateStringToUtcDate } from '../lib/date-range';
import { ApiError } from '../lib/errors';
import { skipFor } from '../lib/pagination';
import { storage } from '../lib/storage';
import type { AuthUser } from '../types/auth-user';

export type LeaveType = 'SICK' | 'ANNUAL' | 'PERMISSION' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type LeaveAttachment = {
  buffer: Buffer;
  mime: 'image/jpeg' | 'image/png' | 'application/pdf';
};

export type CreateLeaveInput = {
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  attachment?: LeaveAttachment | null;
};

export type LeaveQuery = {
  status?: LeaveStatus;
  employeeId?: string;
  q?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
};

const leaveInclude = {
  employee: true,
  reviewedBy: { select: { id: true, email: true } },
} satisfies Prisma.LeaveRequestInclude;

export async function createLeave(input: CreateLeaveInput) {
  const startDate = dateStringToUtcDate(input.startDate);
  const endDate = dateStringToUtcDate(input.endDate);

  if (endDate < startDate) {
    throw ApiError.badRequest('Tanggal selesai harus sama atau setelah tanggal mulai.');
  }

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  });

  if (overlap) {
    throw ApiError.conflict(
      'LEAVE_OVERLAP',
      'Tanggal pengajuan beririsan dengan pengajuan lain yang masih aktif.',
      { id: overlap.id },
    );
  }

  let attachmentKey: string | null = null;
  let attachmentMime: string | null = null;

  if (input.attachment) {
    attachmentKey = await storage.save(
      input.attachment.buffer,
      input.attachment.mime,
      `leave/${input.startDate}`,
    );
    attachmentMime = input.attachment.mime;
  }

  try {
    return await prisma.leaveRequest.create({
      data: {
        employeeId: input.employeeId,
        type: input.type,
        startDate,
        endDate,
        reason: input.reason,
        attachmentKey,
        attachmentMime,
      },
      include: leaveInclude,
    });
  } catch (error) {
    if (attachmentKey) {
      await storage.delete(attachmentKey).catch(() => undefined);
    }
    throw error;
  }
}

export async function listMyLeaves(
  employeeId: string,
  query: Pick<LeaveQuery, 'status' | 'page' | 'limit'>,
) {
  const where: Prisma.LeaveRequestWhereInput = { employeeId };
  if (query.status) where.status = query.status;

  const [rows, total] = await prisma.$transaction([
    prisma.leaveRequest.findMany({
      where,
      include: leaveInclude,
      orderBy: { createdAt: 'desc' },
      skip: skipFor(query),
      take: query.limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { rows, total };
}

export async function listLeaves(query: LeaveQuery) {
  const where: Prisma.LeaveRequestWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.employeeId) where.employeeId = query.employeeId;

  if (query.to) where.startDate = { lte: dateStringToUtcDate(query.to) };
  if (query.from) where.endDate = { gte: dateStringToUtcDate(query.from) };

  if (query.q) {
    where.employee = {
      OR: [
        { fullName: { contains: query.q, mode: 'insensitive' } },
        { employeeNumber: { contains: query.q, mode: 'insensitive' } },
      ],
    };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.leaveRequest.findMany({
      where,
      include: leaveInclude,
      orderBy: { createdAt: 'desc' },
      skip: skipFor(query),
      take: query.limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { rows, total };
}

export async function getLeaveForAccess(id: string, actor: AuthUser) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: leaveInclude,
  });

  if (!leave) {
    throw ApiError.notFound('Pengajuan tidak ditemukan.');
  }

  const isOwner = actor.employeeId !== null && leave.employeeId === actor.employeeId;
  if (actor.role !== 'ADMIN' && !isOwner) {
    throw ApiError.notFound('Pengajuan tidak ditemukan.');
  }

  return leave;
}

export async function decideLeave(
  id: string,
  reviewerUserId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewNote: string | null,
) {
  const leave = await prisma.leaveRequest.findUnique({ where: { id } });

  if (!leave) {
    throw ApiError.notFound('Pengajuan tidak ditemukan.');
  }

  if (leave.status !== 'PENDING') {
    throw ApiError.conflict(
      'LEAVE_ALREADY_REVIEWED',
      'Pengajuan ini sudah diputuskan.',
    );
  }

  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      reviewedById: reviewerUserId,
      reviewedAt: new Date(),
      reviewNote,
    },
    include: leaveInclude,
  });
}

export async function cancelLeave(id: string, actor: AuthUser) {
  const leave = await getLeaveForAccess(id, actor);

  if (leave.status !== 'PENDING') {
    throw ApiError.conflict(
      'LEAVE_ALREADY_REVIEWED',
      'Hanya pengajuan yang masih PENDING dapat dibatalkan.',
    );
  }

  return prisma.leaveRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: leaveInclude,
  });
}

export async function readLeaveAttachment(id: string, actor: AuthUser) {
  const leave = await getLeaveForAccess(id, actor);

  if (!leave.attachmentKey) {
    throw ApiError.notFound('Pengajuan ini tidak memiliki lampiran.');
  }

  try {
    const buffer = await storage.read(leave.attachmentKey);
    return {
      buffer,
      mime: leave.attachmentMime ?? 'application/octet-stream',
    };
  } catch {
    throw ApiError.notFound('File lampiran tidak ditemukan.');
  }
}
