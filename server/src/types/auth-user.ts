export type AppRole = 'EMPLOYEE' | 'ADMIN';

export type AuthUser = {
  id: string;
  email: string;
  role: AppRole;
  employeeId: string | null;
  sessionId: string;
  deviceId: string | null;
  devicePlatform: string | null;
};
