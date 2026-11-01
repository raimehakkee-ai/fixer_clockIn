import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { AuthImage } from '@/components/auth-image';
import { AttendanceStatusBadge } from '@/components/status';
import {
  Badge,
  Button,
  Card,
  EmptyRow,
  ErrorNotice,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Select,
} from '@/components/ui';
import { apiGet, errorMessage } from '@/lib/api';
import { formatDateTime, formatTime, formatWorkDate, todayString } from '@/lib/format';
import type {
  AttendanceRecord,
  AttendanceStatus,
  Paginated,
  Shift,
  Summary,
} from '@/lib/types';

export function AttendancePage() {
  const [date, setDate] = useState(todayString());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'' | AttendanceStatus>('');
  const [shiftId, setShiftId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['summary'],
    queryFn: () => apiGet<{ summary: Summary }>('/reports/summary'),
  });

  const shiftsQuery = useQuery({
    queryKey: ['shifts', 'all'],
    queryFn: () => apiGet<{ data: Shift[] }>('/shifts?includeInactive=true'),
  });

  const params = new URLSearchParams({
    date,
    page: String(page),
    limit: '20',
  });

  if (query.trim()) params.set('q', query.trim());
  if (status) params.set('status', status);
  if (shiftId) params.set('shiftId', shiftId);

  const attendanceQuery = useQuery({
    queryKey: ['attendance', date, query, status, shiftId, page],
    queryFn: () =>
      apiGet<Paginated<AttendanceRecord>>(`/attendance?${params.toString()}`),
    enabled: Boolean(date),
  });

  const detailQuery = useQuery({
    queryKey: ['attendance-detail', selectedId],
    queryFn: () =>
      apiGet<{ attendance: AttendanceRecord }>(`/attendance/${selectedId ?? ''}`),
    enabled: Boolean(selectedId),
  });

  const timezone = summaryQuery.data?.summary.timezone;
  const records = attendanceQuery.data?.data ?? [];
  const meta = attendanceQuery.data?.meta;
  const detail = detailQuery.data?.attendance;

  return (
    <div>
      <PageHeader
        title="Monitoring Kehadiran"
        description="Filter berdasarkan tanggal, nama, shift, dan status absensi."
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Tanggal">
            <Input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Cari nama / NIK">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Nama atau nomor karyawan"
            />
          </Field>
          <Field label="Shift">
            <Select
              value={shiftId}
              onChange={(event) => {
                setShiftId(event.target.value);
                setPage(1);
              }}>
              <option value="">Semua shift</option>
              {(shiftsQuery.data?.data ?? []).map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({shift.startTime}–{shift.endTime})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as '' | AttendanceStatus);
                setPage(1);
              }}>
              <option value="">Semua status</option>
              <option value="PRESENT">Hadir</option>
              <option value="LATE">Terlambat</option>
              <option value="INCOMPLETE">Belum keluar</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-0">
        {attendanceQuery.isLoading ? (
          <div className="p-5">
            <Loading />
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
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Masuk</th>
                  <th className="px-4 py-3">Keluar</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Jarak</th>
                  <th className="px-4 py-3">Mock</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.length === 0 ? (
                  <EmptyRow colSpan={9} message="Tidak ada data absensi." />
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
                        {formatWorkDate(record.workDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatTime(record.clockIn.at, timezone)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {record.clockOut
                          ? formatTime(record.clockOut.at, timezone)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceStatusBadge status={record.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {Math.round(record.clockIn.distanceMeters)} m
                      </td>
                      <td className="px-4 py-3">
                        {record.clockIn.mocked || record.clockOut?.mocked ? (
                          <Badge tone="danger">Terdeteksi</Badge>
                        ) : (
                          <Badge tone="neutral">Tidak</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={() => setSelectedId(record.id)}>
                          Detail
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {meta ? (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPage={setPage}
          />
        ) : null}
      </Card>

      <Modal
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title="Detail Absensi"
        width="max-w-2xl">
        {detailQuery.isLoading ? (
          <Loading />
        ) : detailQuery.error ? (
          <ErrorNotice message={errorMessage(detailQuery.error)} />
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {detail.employee?.fullName ?? '—'}
                </p>
                <p className="text-xs text-slate-500">
                  {detail.employee?.employeeNumber} ·{' '}
                  {formatWorkDate(detail.workDate)} · {detail.shift.name}
                </p>
              </div>
              <AttendanceStatusBadge status={detail.status} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  Clock-In
                </p>
                {detail.clockIn.photoAvailable ? (
                  <AuthImage
                    path={`/attendance/${detail.id}/photo?type=in`}
                    alt={`Foto masuk ${detail.employee?.fullName ?? ''}`}
                    className="h-52 w-full rounded-lg object-cover"
                  />
                ) : (
                  <p className="text-xs text-slate-500">Foto tidak tersedia.</p>
                )}
                <p className="text-xs text-slate-600">
                  {formatDateTime(detail.clockIn.at, timezone)} · akurasi{' '}
                  {Math.round(detail.clockIn.accuracy)} m · jarak{' '}
                  {Math.round(detail.clockIn.distanceMeters)} m
                </p>
                <a
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                  href={`https://maps.google.com/?q=${detail.clockIn.latitude},${detail.clockIn.longitude}`}
                  target="_blank"
                  rel="noreferrer">
                  Lihat koordinat <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  Clock-Out
                </p>
                {detail.clockOut ? (
                  <>
                    {detail.clockOut.photoAvailable ? (
                      <AuthImage
                        path={`/attendance/${detail.id}/photo?type=out`}
                        alt={`Foto keluar ${detail.employee?.fullName ?? ''}`}
                        className="h-52 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <p className="text-xs text-slate-500">
                        Foto tidak tersedia.
                      </p>
                    )}
                    <p className="text-xs text-slate-600">
                      {formatDateTime(detail.clockOut.at, timezone)}
                      {detail.clockOut.accuracy !== null
                        ? ` · akurasi ${Math.round(detail.clockOut.accuracy)} m`
                        : ''}
                      {detail.clockOut.distanceMeters !== null
                        ? ` · jarak ${Math.round(detail.clockOut.distanceMeters)} m`
                        : ''}
                    </p>
                    {detail.clockOut.latitude !== null &&
                    detail.clockOut.longitude !== null ? (
                      <a
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                        href={`https://maps.google.com/?q=${detail.clockOut.latitude},${detail.clockOut.longitude}`}
                        target="_blank"
                        rel="noreferrer">
                        Lihat koordinat <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Belum Clock-Out.</p>
                )}
              </div>
            </div>

            <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-3">
              <p>Terlambat: {detail.lateMinutes} menit</p>
              <p>Pulang awal: {detail.earlyLeaveMinutes} menit</p>
              <p>
                Mock location:{' '}
                {detail.clockIn.mocked ? 'terdeteksi' : 'tidak terdeteksi'}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
