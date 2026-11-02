export type Role = 'EMPLOYEE' | 'ADMIN';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'INCOMPLETE';
export type LeaveType = 'SICK' | 'ANNUAL' | 'PERMISSION' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DeviceStatus = 'ACTIVE' | 'REVOKED';

export type AdminUser = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  employee: {
    id: string;
    number: string;
    fullName: string;
    department: string | null;
    position: string | null;
  } | null;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
  serverTime: string;
};

export type Device = {
  id: string;
  platform: string;
  deviceName: string | null;
  status: DeviceStatus;
  registeredAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
};

export type Employee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  department: string | null;
  position: string | null;
  officeLocationId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; role: Role; isActive: boolean };
  officeLocation: { id: string; name: string } | null;
  devices: Device[];
};

export type Office = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  toleranceMinutes: number;
  earlyWindowMinutes: number;
  isActive: boolean;
  sortOrder: number;
};

export type AttendanceRecord = {
  id: string;
  workDate: string;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    crossesMidnight: boolean;
  };
  clockIn: {
    at: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    distanceMeters: number;
    mocked: boolean;
    photoAvailable: boolean;
  };
  clockOut: {
    at: string;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    distanceMeters: number | null;
    mocked: boolean | null;
    photoAvailable: boolean;
  } | null;
  riskFlags: unknown[];
  employee?: {
    id: string;
    employeeNumber: string;
    fullName: string;
    department: string | null;
    position: string | null;
  };
};

export type LeaveRecord = {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  attachmentAvailable: boolean;
  attachmentMime: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reviewer: { id: string; email: string } | null;
  employee?: {
    id: string;
    employeeNumber: string;
    fullName: string;
    department: string | null;
    position: string | null;
  };
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  actor: { id: string; email: string } | null;
  ipAddress: string | null;
  createdAt: string;
};

export type Summary = {
  date: string;
  timezone: string;
  totalEmployees: number;
  present: number;
  late: number;
  incomplete: number;
  onLeave: number;
  absent: number;
  attendanceRecords: number;
  pendingLeaveRequests: number;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
