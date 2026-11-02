export type Role = 'EMPLOYEE' | 'ADMIN';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'INCOMPLETE';
export type LeaveType = 'SICK' | 'ANNUAL' | 'PERMISSION' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type EmployeeProfile = {
  id: string;
  number: string;
  fullName: string;
  department: string | null;
  position: string | null;
  officeLocationId: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  employee: EmployeeProfile | null;
};

export type DeviceInfo = {
  id: string;
  platform?: string;
  deviceName?: string | null;
  status: 'ACTIVE' | 'REVOKED';
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  device: DeviceInfo | null;
  serverTime: string;
};

export type MeResponse = {
  user: AuthUser;
  device: DeviceInfo | null;
  serverTime: string;
};

export type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  toleranceMinutes: number;
  earlyWindowMinutes: number;
  clockOutGraceMinutes: number;
  isActive: boolean;
  sortOrder: number;
};

export type Office = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  timezone: string;
  accuracyLimitMeters: number;
  isActive: boolean;
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

export type MyDevice = {
  id: string;
  platform: string;
  deviceName: string | null;
  status: 'ACTIVE' | 'REVOKED';
  registeredAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
};
