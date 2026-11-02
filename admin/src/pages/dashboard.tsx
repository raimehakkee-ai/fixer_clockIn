import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { StatCard } from '@/components/stat-card';
import {
  AttendanceStatusBadge,
  LeaveStatusBadge,
} from '@/components/status';
import {
  Card,
  EmptyRow,
  ErrorNotice,
  Loading,
  PageHeader,
} from '@/components/ui';
import { apiGet, errorMessage } from '@/lib/api';
import { formatTime, formatWorkDate } from '@/lib/format';
import type {
  AttendanceRecord,
  LeaveRecord,
  Paginated,
  Summary,
} from '@/lib/types';

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['summary'],
    queryFn: () => apiGet<{ summary: Summary }>('/reports/summary'),
    refetchInterval: 15_000,
  });

  const summary = summaryQuery.data?.summary;

  const attendanceQuery = useQuery({
    queryKey: ['dashboard-attendance', summary?.date],
    enabled: Boolean(summary?.date),
    queryFn: () =>
      apiGet<Paginated<AttendanceRecord>>(
        `/attendance?date=${summary?.date ?? ''}&limit=8`,
      ),
  });

  const leaveQuery = useQuery({
    queryKey: ['dashboard-leave'],
    queryFn: () =>
      apiGet<Paginated<LeaveRecord>>('/leave-requests?status=PENDING&limit=5'),
    refetchInterval: 30_000,
  });

  if (summaryQuery.isLoading) {
    return <Loading label="Memuat dashboard…" />;
  }

  if (summaryQuery.error) {
    return (
      <ErrorNotice message={errorMessage(summaryQuery.error)} />
    );
  }

  if (!summary) {
    return <ErrorNotice message="Ringkasan tidak tersedia." />;
  }

  const records = attendanceQuery.data?.data ?? [];
  const pendingLeaves = leaveQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Ringkasan kehadiran ${formatWorkDate(summary.date)} · zona waktu ${summary.timezone}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total Karyawan"
          value={summary.totalEmployees}
          icon={Users}
          tone="slate"
        />
        <StatCard label="Hadir" value={summary.present} icon={UserCheck} tone="emerald" />
        <StatCard label="Terlambat" value={summary.late} icon={Clock} tone="amber" />
        <StatCard
          label="Belum Keluar"
          value={summary.incomplete ?? 0}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Izin / Cuti"
          value={summary.onLeave}
          icon={CalendarClock}
          tone="indigo"
        />
        <StatCard label="Belum Absen" value={summary.absent} icon={UserX} tone="red" />
        <StatCard
          label="Pengajuan Menunggu"
          value={summary.pendingLeaveRequests}
          icon={AlertTriangle}
          tone="amber"
          hint="Perlu persetujuan Admin"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Kehadiran Hari Ini
              </h2>
              <p className="text-xs text-slate-500">
                {summary.attendanceRecords} record absensi
              </p>
            </div>
            <Link
              to="/attendance"
              className="text-sm font-medium text-indigo-600 hover:underline">
              Lihat semua
            </Link>
          </div>

          {attendanceQuery.isLoading ? (
            <div className="p-5">
              <Loading label="Memuat kehadiran…" />
            </div>
          ) : attendanceQuery.error ? (
            <div className="p-5">
              <ErrorNotice message={errorMessage(attendanceQuery.error)} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Karyawan</th>
                    <th className="px-4 py-3">Shift</th>
                    <th className="px-4 py-3">Masuk</th>
                    <th className="px-4 py-3">Keluar</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.length === 0 ? (
                    <EmptyRow colSpan={5} message="Belum ada absensi hari ini." />
                  ) : (
                    records.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {record.employee?.fullName ?? '—'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {record.employee?.employeeNumber ?? ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {record.shift.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatTime(record.clockIn.at, summary.timezone)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {record.clockOut
                            ? formatTime(record.clockOut.at, summary.timezone)
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <AttendanceStatusBadge status={record.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Pengajuan Menunggu
              </h2>
              <p className="text-xs text-slate-500">
                {summary.pendingLeaveRequests} pengajuan perlu diputuskan
              </p>
            </div>
            <Link
              to="/leave"
              className="text-sm font-medium text-indigo-600 hover:underline">
              Kelola
            </Link>
          </div>

          {leaveQuery.isLoading ? (
            <div className="p-5">
              <Loading label="Memuat pengajuan…" />
            </div>
          ) : leaveQuery.error ? (
            <div className="p-5">
              <ErrorNotice message={errorMessage(leaveQuery.error)} />
            </div>
          ) : pendingLeaves.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Tidak ada pengajuan yang menunggu.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingLeaves.map((leave) => (
                <li key={leave.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {leave.employee?.fullName ?? '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatWorkDate(leave.startDate)} –{' '}
                        {formatWorkDate(leave.endDate)} · {leave.days} hari
                      </p>
                    </div>
                    <LeaveStatusBadge status={leave.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
