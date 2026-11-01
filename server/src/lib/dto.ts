import { inclusiveDays } from './date-range';

type DeviceShape = {
  id: string;
  platform: string;
  deviceName: string | null;
  status: 'ACTIVE' | 'REVOKED';
  registeredAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
};

export function toDeviceDto(device: DeviceShape) {
  return {
    id: device.id,
    platform: device.platform,
    deviceName: device.deviceName,
    status: device.status,
    registeredAt: device.registeredAt.toISOString(),
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    revokedAt: device.revokedAt?.toISOString() ?? null,
  };
}

type EmployeeShape = {
  id: string;
  employeeNumber: string;
  fullName: string;
  department: string | null;
  position: string | null;
  officeLocationId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    role: 'EMPLOYEE' | 'ADMIN';
    isActive: boolean;
  };
  officeLocation?: { id: string; name: string } | null;
  devices?: DeviceShape[];
};

export function toEmployeeDto(employee: EmployeeShape) {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    fullName: employee.fullName,
    department: employee.department,
    position: employee.position,
    officeLocationId: employee.officeLocationId,
    isActive: employee.isActive,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
    user: {
      id: employee.user.id,
      email: employee.user.email,
      role: employee.user.role,
      isActive: employee.user.isActive,
    },
    officeLocation: employee.officeLocation
      ? { id: employee.officeLocation.id, name: employee.officeLocation.name }
      : null,
    devices: employee.devices?.map(toDeviceDto) ?? [],
  };
}

type OfficeShape = {
  id: string;
  name: string;
  latitude: unknown;
  longitude: unknown;
  radiusMeters: number;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toOfficeDto(office: OfficeShape) {
  return {
    id: office.id,
    name: office.name,
    latitude: Number(office.latitude),
    longitude: Number(office.longitude),
    radiusMeters: office.radiusMeters,
    timezone: office.timezone,
    isActive: office.isActive,
    createdAt: office.createdAt.toISOString(),
    updatedAt: office.updatedAt.toISOString(),
  };
}

type ShiftShape = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  toleranceMinutes: number;
  earlyWindowMinutes: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export function toShiftDto(shift: ShiftShape) {
  return {
    id: shift.id,
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    crossesMidnight: shift.crossesMidnight,
    toleranceMinutes: shift.toleranceMinutes,
    earlyWindowMinutes: shift.earlyWindowMinutes,
    isActive: shift.isActive,
    sortOrder: shift.sortOrder,
    createdAt: shift.createdAt.toISOString(),
    updatedAt: shift.updatedAt.toISOString(),
  };
}

type AttendanceShape = {
  id: string;
  workDate: Date;
  clockInAt: Date;
  clockInLatitude: unknown;
  clockInLongitude: unknown;
  clockInAccuracy: number;
  clockInDistanceMeters: number;
  clockInMocked: boolean;
  clockInPhotoKey: string;
  clockOutAt: Date | null;
  clockOutLatitude: unknown | null;
  clockOutLongitude: unknown | null;
  clockOutAccuracy: number | null;
  clockOutDistanceMeters: number | null;
  clockOutMocked: boolean | null;
  clockOutPhotoKey: string | null;
  status: 'PRESENT' | 'LATE' | 'INCOMPLETE';
  lateMinutes: number;
  earlyLeaveMinutes: number;
  riskFlags: unknown;
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    crossesMidnight: boolean;
  };
  employee?: {
    id: string;
    employeeNumber: string;
    fullName: string;
    department: string | null;
    position: string | null;
  };
};

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toAttendanceDto(record: AttendanceShape) {
  return {
    id: record.id,
    workDate: dateOnly(record.workDate),
    status: record.status,
    lateMinutes: record.lateMinutes,
    earlyLeaveMinutes: record.earlyLeaveMinutes,
    shift: {
      id: record.shift.id,
      name: record.shift.name,
      startTime: record.shift.startTime,
      endTime: record.shift.endTime,
      crossesMidnight: record.shift.crossesMidnight,
    },
    clockIn: {
      at: record.clockInAt.toISOString(),
      latitude: Number(record.clockInLatitude),
      longitude: Number(record.clockInLongitude),
      accuracy: record.clockInAccuracy,
      distanceMeters: record.clockInDistanceMeters,
      mocked: record.clockInMocked,
      photoAvailable: Boolean(record.clockInPhotoKey),
    },
    clockOut: record.clockOutAt
      ? {
          at: record.clockOutAt.toISOString(),
          latitude:
            record.clockOutLatitude === null ? null : Number(record.clockOutLatitude),
          longitude:
            record.clockOutLongitude === null ? null : Number(record.clockOutLongitude),
          accuracy: record.clockOutAccuracy,
          distanceMeters: record.clockOutDistanceMeters,
          mocked: record.clockOutMocked,
          photoAvailable: Boolean(record.clockOutPhotoKey),
        }
      : null,
    riskFlags: Array.isArray(record.riskFlags) ? record.riskFlags : [],
    ...(record.employee
      ? {
          employee: {
            id: record.employee.id,
            employeeNumber: record.employee.employeeNumber,
            fullName: record.employee.fullName,
            department: record.employee.department,
            position: record.employee.position,
          },
        }
      : {}),
  };
}

type LeaveShape = {
  id: string;
  type: 'SICK' | 'ANNUAL' | 'PERMISSION' | 'OTHER';
  startDate: Date;
  endDate: Date;
  reason: string;
  attachmentKey: string | null;
  attachmentMime: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
  employee?: {
    id: string;
    employeeNumber: string;
    fullName: string;
    department: string | null;
    position: string | null;
  };
  reviewedBy?: { id: string; email: string } | null;
};

export function toLeaveDto(leave: LeaveShape) {
  const startDate = dateOnly(leave.startDate);
  const endDate = dateOnly(leave.endDate);

  return {
    id: leave.id,
    type: leave.type,
    startDate,
    endDate,
    days: inclusiveDays(startDate, endDate),
    reason: leave.reason,
    status: leave.status,
    attachmentAvailable: Boolean(leave.attachmentKey),
    attachmentMime: leave.attachmentMime,
    reviewNote: leave.reviewNote,
    reviewedAt: leave.reviewedAt?.toISOString() ?? null,
    createdAt: leave.createdAt.toISOString(),
    ...(leave.employee
      ? {
          employee: {
            id: leave.employee.id,
            employeeNumber: leave.employee.employeeNumber,
            fullName: leave.employee.fullName,
            department: leave.employee.department,
            position: leave.employee.position,
          },
        }
      : {}),
    reviewer: leave.reviewedBy
      ? { id: leave.reviewedBy.id, email: leave.reviewedBy.email }
      : null,
  };
}
