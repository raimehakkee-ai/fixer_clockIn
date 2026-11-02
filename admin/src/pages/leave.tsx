import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useState } from 'react';

import { LeaveStatusBadge } from '@/components/status';
import {
  Button,
  Card,
  EmptyRow,
  ErrorNotice,
  Loading,
  Modal,
  Notice,
  PageHeader,
  Pagination,
} from '@/components/ui';
import {
  apiGet,
  apiRequest,
  errorMessage,
  openProtectedFile,
} from '@/lib/api';
import { formatDateTime, formatWorkDate } from '@/lib/format';
import type {
  LeaveRecord,
  LeaveStatus,
  LeaveType,
  Paginated,
} from '@/lib/types';

const TABS: { value: '' | LeaveStatus; label: string }[] = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
  { value: '', label: 'Semua' },
];

const TYPE_LABEL: Record<LeaveType, string> = {
  SICK: 'Sakit',
  ANNUAL: 'Cuti',
  PERMISSION: 'Izin',
  OTHER: 'Lainnya',
};

type Decision = {
  leave: LeaveRecord;
  action: 'approve' | 'reject';
};

export function LeavePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'' | LeaveStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');

  const showNotice = (message: string, tone: 'success' | 'error' = 'success') => {
    setNotice(message);
    setNoticeTone(tone);
  };

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (tab) params.set('status', tab);

  const leavesQuery = useQuery({
    queryKey: ['leave', tab, page],
    queryFn: () =>
      apiGet<Paginated<LeaveRecord>>(`/leave-requests?${params.toString()}`),
  });

  const decide = useMutation({
    mutationFn: async (input: Decision) => {
      const trimmed = note.trim();
      const body =
        input.action === 'reject'
          ? { reviewNote: trimmed }
          : trimmed
            ? { reviewNote: trimmed }
            : {};

      await apiRequest(`/leave-requests/${input.leave.id}/${input.action}`, {
        method: 'POST',
        body,
      });
    },
    onSuccess: async () => {
      setDecision(null);
      setNote('');
      showNotice('Pengajuan berhasil diputuskan.');
      await queryClient.invalidateQueries({ queryKey: ['leave'] });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-leave'] });
    },
    onError: (error) => setModalError(errorMessage(error)),
  });

  const leaves = leavesQuery.data?.data ?? [];
  const meta = leavesQuery.data?.meta;

  const openDecision = (leave: LeaveRecord, action: 'approve' | 'reject') => {
    setDecision({ leave, action });
    setNote('');
    setModalError(null);
  };

  const openAttachment = async (id: string) => {
    try {
      await openProtectedFile(`/leave-requests/${id}/attachment`);
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Izin & Cuti"
        description="Setujui atau tolak pengajuan karyawan dengan catatan."
      />

      {notice ? (
        <div className="mb-4">
          <Notice message={notice} tone={noticeTone} />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              setTab(item.value);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              tab === item.value
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}>
            {item.label}
          </button>
        ))}
      </div>

      <Card className="p-0">
        {leavesQuery.isLoading ? (
          <div className="p-5">
            <Loading />
          </div>
        ) : leavesQuery.error ? (
          <div className="p-5">
            <ErrorNotice message={errorMessage(leavesQuery.error)} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Karyawan</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Hari</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Lampiran</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaves.length === 0 ? (
                  <EmptyRow colSpan={7} message="Tidak ada pengajuan." />
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {leave.employee?.fullName ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {leave.employee?.employeeNumber ?? ''}
                        </p>
                        <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                          {leave.reason}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {TYPE_LABEL[leave.type]}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatWorkDate(leave.startDate)} –{' '}
                        {formatWorkDate(leave.endDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{leave.days}</td>
                      <td className="px-4 py-3">
                        <LeaveStatusBadge status={leave.status} />
                        {leave.reviewNote ? (
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                            {leave.reviewNote}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {leave.attachmentAvailable ? (
                          <button
                            type="button"
                            onClick={() => void openAttachment(leave.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                            <Paperclip className="h-3 w-3" />
                            Lihat
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {leave.status === 'PENDING' ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => openDecision(leave, 'approve')}>
                              Setujui
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2 py-1 text-xs"
                              onClick={() => openDecision(leave, 'reject')}>
                              Tolak
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
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
        open={Boolean(decision)}
        onClose={() => {
          setDecision(null);
          setModalError(null);
        }}
        title={decision?.action === 'reject' ? 'Tolak Pengajuan' : 'Setujui Pengajuan'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDecision(null);
                setModalError(null);
              }}>
              Batal
            </Button>
            <Button
              variant={decision?.action === 'reject' ? 'danger' : 'primary'}
              disabled={
                decide.isPending ||
                (decision?.action === 'reject' && note.trim().length < 3)
              }
              onClick={() => {
                if (!decision) return;
                setModalError(null);
                decide.mutate(decision);
              }}>
              {decide.isPending
                ? 'Memproses…'
                : decision?.action === 'reject'
                  ? 'Tolak'
                  : 'Setujui'}
            </Button>
          </>
        }>
        {decision ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {decision.leave.employee?.fullName ?? '—'}
              </p>
              <p className="text-xs text-slate-500">
                {TYPE_LABEL[decision.leave.type]} ·{' '}
                {formatWorkDate(decision.leave.startDate)} –{' '}
                {formatWorkDate(decision.leave.endDate)} ·{' '}
                {decision.leave.days} hari
              </p>
              <p className="mt-2 text-slate-700">{decision.leave.reason}</p>
              <p className="mt-2 text-xs text-slate-500">
                Diajukan {formatDateTime(decision.leave.createdAt)}
              </p>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                Catatan {decision.action === 'reject' ? '(wajib)' : '(opsional)'}
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder={
                  decision.action === 'reject'
                    ? 'Alasan penolakan (minimal 3 karakter)'
                    : 'Catatan untuk karyawan'
                }
              />
            </label>

            {modalError ? <ErrorNotice message={modalError} /> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
