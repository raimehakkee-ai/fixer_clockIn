import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui';
import {
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
import { apiGet, apiRequest, errorMessage } from '@/lib/api';
import type { Employee, Office, Paginated } from '@/lib/types';

type EmployeeForm = {
  email: string;
  password: string;
  employeeNumber: string;
  fullName: string;
  department: string;
  position: string;
  officeLocationId: string;
};

const EMPTY_FORM: EmployeeForm = {
  email: '',
  password: '',
  employeeNumber: '',
  fullName: '',
  department: '',
  position: '',
  officeLocationId: '',
};

export function EmployeesPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search.trim()) params.set('q', search.trim());
  if (includeInactive) params.set('includeInactive', 'true');

  const employeesQuery = useQuery({
    queryKey: ['employees', search, includeInactive, page],
    queryFn: () =>
      apiGet<Paginated<Employee>>(`/employees?${params.toString()}`),
  });

  const officesQuery = useQuery({
    queryKey: ['offices'],
    queryFn: () => apiGet<{ data: Office[] }>('/office-locations'),
  });

  const employees = employeesQuery.data?.data ?? [];
  const meta = employeesQuery.data?.meta;
  const offices = officesQuery.data?.data ?? [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setForm({
      email: employee.user.email,
      password: '',
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      department: employee.department ?? '',
      position: employee.position ?? '',
      officeLocationId: employee.officeLocationId ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);

    try {
      const base = {
        fullName: form.fullName.trim(),
        department: form.department.trim() || null,
        position: form.position.trim() || null,
        officeLocationId: form.officeLocationId || null,
      };

      if (editingId) {
        await apiRequest(`/employees/${editingId}`, {
          method: 'PATCH',
          body: base,
        });
        setNotice('Data karyawan diperbarui.');
      } else {
        await apiRequest('/employees', {
          method: 'POST',
          body: {
            ...base,
            email: form.email.trim(),
            password: form.password,
            employeeNumber: form.employeeNumber.trim(),
          },
        });
        setNotice('Karyawan baru dibuat.');
      }

      setFormOpen(false);
      await refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (employee: Employee) => {
    setBusyId(employee.id);
    setNotice(null);

    try {
      await apiRequest(`/employees/${employee.id}/status`, {
        method: 'PATCH',
        body: { isActive: !employee.isActive },
      });
      setNotice(
        employee.isActive
          ? 'Karyawan dinonaktifkan.'
          : 'Karyawan diaktifkan kembali.',
      );
      await refresh();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const resetDevice = async (employee: Employee) => {
    const confirmed = window.confirm(
      `Reset perangkat ${employee.fullName}? Semua sesi aktif akan dicabut.`,
    );
    if (!confirmed) return;

    setBusyId(employee.id);
    setNotice(null);

    try {
      const result = await apiRequest<{ revokedDevices: number }>(
        `/employees/${employee.id}/reset-device`,
        { method: 'POST' },
      );
      setNotice(
        `Perangkat direset (${result.revokedDevices} perangkat dicabut).`,
      );
      await refresh();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const submitResetPassword = async () => {
    if (!resetTarget) return;

    setResetError(null);

    try {
      await apiRequest(`/employees/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: { newPassword },
      });
      setResetTarget(null);
      setNewPassword('');
      setNotice('Password karyawan direset. Semua sesi dicabut.');
    } catch (error) {
      setResetError(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Karyawan"
        description="Kelola akun, status, perangkat, dan password karyawan."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Karyawan Baru
          </Button>
        }
      />

      {notice ? (
        <div className="mb-4">
          <ErrorNotice message={notice} />
        </div>
      ) : null}

      <Card className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Cari">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Nama, NIK, atau email"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => {
                setIncludeInactive(event.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Tampilkan nonaktif
          </label>
        </div>
      </Card>

      <Card className="p-0">
        {employeesQuery.isLoading ? (
          <div className="p-5">
            <Loading />
          </div>
        ) : employeesQuery.error ? (
          <div className="p-5">
            <ErrorNotice message={errorMessage(employeesQuery.error)} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">NIK</th>
                  <th className="px-4 py-3">Karyawan</th>
                  <th className="px-4 py-3">Departemen</th>
                  <th className="px-4 py-3">Kantor</th>
                  <th className="px-4 py-3">Perangkat</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.length === 0 ? (
                  <EmptyRow colSpan={7} message="Tidak ada karyawan." />
                ) : (
                  employees.map((employee) => {
                    const activeDevice = employee.devices.find(
                      (device) => device.status === 'ACTIVE',
                    );

                    return (
                      <tr key={employee.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {employee.employeeNumber}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {employee.fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {employee.user.email}
                          </p>
                          <p className="text-xs text-slate-500">
                            {employee.position ?? '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {employee.department ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {employee.officeLocation?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {activeDevice ? (
                            <div>
                              <p className="text-xs font-medium text-slate-700">
                                {activeDevice.deviceName ?? activeDevice.platform}
                              </p>
                              <p className="text-xs text-slate-500">
                                {activeDevice.platform}
                              </p>
                            </div>
                          ) : (
                            <Badge tone="neutral">Belum terdaftar</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {employee.isActive ? (
                            <Badge tone="success">Aktif</Badge>
                          ) : (
                            <Badge tone="danger">Nonaktif</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => openEdit(employee)}>
                              Edit
                            </Button>
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={busyId === employee.id}
                              onClick={() => void toggleStatus(employee)}>
                              {employee.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={busyId === employee.id}
                              onClick={() => {
                                setResetTarget(employee);
                                setNewPassword('');
                                setResetError(null);
                              }}>
                              Reset Password
                            </Button>
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={busyId === employee.id}
                              onClick={() => void resetDevice(employee)}>
                              Reset Perangkat
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Karyawan' : 'Karyawan Baru'}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              disabled={Boolean(editingId)}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </Field>
          <Field label="Nomor karyawan (NIK)">
            <Input
              value={form.employeeNumber}
              disabled={Boolean(editingId)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  employeeNumber: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Nama lengkap">
            <Input
              value={form.fullName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
            />
          </Field>
          {!editingId ? (
            <Field
              label="Password awal"
              hint="Minimal 8 karakter, memuat huruf dan angka.">
              <Input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
            </Field>
          ) : null}
          <Field label="Departemen">
            <Input
              value={form.department}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  department: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Jabatan">
            <Input
              value={form.position}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  position: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Kantor">
            <Select
              value={form.officeLocationId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  officeLocationId: event.target.value,
                }))
              }>
              <option value="">— Tidak ditentukan —</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {formError ? <ErrorNotice message={formError} /> : null}
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Reset Password — ${resetTarget?.fullName ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              Batal
            </Button>
            <Button
              onClick={() => void submitResetPassword()}
              disabled={newPassword.length < 8}>
              Reset Password
            </Button>
          </>
        }>
        <Field
          label="Password baru"
          hint="Minimal 8 karakter, memuat huruf dan angka. Semua sesi akan dicabut.">
          <Input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </Field>
        {resetError ? <ErrorNotice message={resetError} /> : null}
      </Modal>
    </div>
  );
}
