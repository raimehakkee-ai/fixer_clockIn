import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { AuditLogPage } from '@/pages/audit-log';
import { AttendancePage } from '@/pages/attendance';
import { DashboardPage } from '@/pages/dashboard';
import { EmployeesPage } from '@/pages/employees';
import { LeavePage } from '@/pages/leave';
import { LoginPage } from '@/pages/login';
import { OfficePage } from '@/pages/office';
import { ReportsPage } from '@/pages/reports';

function RequireAdmin() {
  const { session } = useAuth();
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAdmin />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="office" element={<OfficePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="audit" element={<AuditLogPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
