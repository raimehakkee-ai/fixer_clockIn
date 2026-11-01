import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  Card,
  EmptyRow,
  ErrorNotice,
  Field,
  Input,
  Loading,
  PageHeader,
  Pagination,
} from '@/components/ui';
import { apiGet, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { AuditLog, Paginated } from '@/lib/types';

export function AuditLogPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (action.trim()) params.set('action', action.trim());
  if (entityType.trim()) params.set('entityType', entityType.trim());
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const auditQuery = useQuery({
    queryKey: ['audit', action, entityType, from, to, page],
    queryFn: () =>
      apiGet<Paginated<AuditLog>>(`/audit-logs?${params.toString()}`),
  });

  const logs = auditQuery.data?.data ?? [];
  const meta = auditQuery.data?.meta;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Jejak aktivitas administratif, perangkat, persetujuan, dan unduhan laporan."
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Action">
            <Input
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              placeholder="mis. EXPORT_DOWNLOADED"
            />
          </Field>
          <Field label="Entity type">
            <Input
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
              placeholder="mis. leave_request"
            />
          </Field>
          <Field label="Dari tanggal">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Sampai tanggal">
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-0">
        {auditQuery.isLoading ? (
          <div className="p-5">
            <Loading />
          </div>
        ) : auditQuery.error ? (
          <div className="p-5">
            <ErrorNotice message={errorMessage(auditQuery.error)} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Aktor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Metadata</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <EmptyRow colSpan={6} message="Tidak ada audit log." />
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {log.actor?.email ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-slate-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p>{log.entityType}</p>
                        {log.entityId ? (
                          <p className="font-mono text-[10px] text-slate-400">
                            {log.entityId}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <details>
                          <summary className="cursor-pointer text-indigo-600">
                            Lihat
                          </summary>
                          <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-slate-100 p-2 text-[10px]">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {log.ipAddress ?? '—'}
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
    </div>
  );
}
