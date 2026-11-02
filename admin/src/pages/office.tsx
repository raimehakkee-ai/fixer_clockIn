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
  Notice,
  PageHeader,
} from '@/components/ui';
import { apiGet, apiRequest, errorMessage } from '@/lib/api';
import type { Office, Shift } from '@/lib/types';

type OfficeForm = {
  id: string | null;
  name: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
  timezone: string;
  isActive: boolean;
};

const EMPTY_OFFICE: OfficeForm = {
  id: null,
  name: '',
  latitude: '',
  longitude: '',
  radiusMeters: '50',
  timezone: 'Asia/Jakarta',
  isActive: true,
};

type ShiftForm = {
  id: string | null;
  name: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: string;
  earlyWindowMinutes: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_SHIFT: ShiftForm = {
  id: null,
  name: '',
  startTime: '08:00',
  endTime: '16:00',
  toleranceMinutes: '15',
  earlyWindowMinutes: '120',
  sortOrder: '0',
  isActive: true,
};

export function OfficePage() {
  const queryClient = useQueryClient();

  const [officeForm, setOfficeForm] = useState<OfficeForm>(EMPTY_OFFICE);
  const [officeError, setOfficeError] = useState<string | null>(null);
  const [savingOffice, setSavingOffice] = useState(false);

  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState<ShiftForm>(EMPTY_SHIFT);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [savingShift, setSavingShift] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');
  const [busyId, setBusyId] = useState<string | null>(null);

  const showNotice = (message: string, tone: 'success' | 'error' = 'success') => {
    setNotice(message);
    setNoticeTone(tone);
  };

  const officesQuery = useQuery({
    queryKey: ['offices'],
    queryFn: () => apiGet<{ data: Office[] }>('/office-locations'),
  });

  const shiftsQuery = useQuery({
    queryKey: ['shifts', 'all'],
    queryFn: () => apiGet<{ data: Shift[] }>('/shifts?includeInactive=true'),
  });

  const offices = officesQuery.data?.data ?? [];
  const shifts = shiftsQuery.data?.data ?? [];

  const refreshOffices = async () =>
    queryClient.invalidateQueries({ queryKey: ['offices'] });
  const refreshShifts = async () =>
    queryClient.invalidateQueries({ queryKey: ['shifts'] });

  const editOffice = (office: Office) => {
    setOfficeForm({
      id: office.id,
      name: office.name,
      latitude: String(office.latitude),
      longitude: String(office.longitude),
      radiusMeters: String(office.radiusMeters),
      timezone: office.timezone,
      isActive: office.isActive,
    });
    setOfficeError(null);
  };

  const saveOffice = async () => {
    setSavingOffice(true);
    setOfficeError(null);

    try {
      const body = {
        name: officeForm.name.trim(),
        latitude: Number(officeForm.latitude),
        longitude: Number(officeForm.longitude),
        radiusMeters: Number(officeForm.radiusMeters),
        timezone: officeForm.timezone.trim(),
        isActive: officeForm.isActive,
      };

      if (officeForm.id) {
        await apiRequest(`/office-locations/${officeForm.id}`, {
          method: 'PATCH',
          body,
        });
        showNotice('Lokasi kantor diperbarui.');
      } else {
        await apiRequest('/office-locations', { method: 'POST', body });
        showNotice('Lokasi kantor dibuat.');
      }

      setOfficeForm(EMPTY_OFFICE);
      await refreshOffices();
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
    } catch (error) {
      setOfficeError(errorMessage(error));
    } finally {
      setSavingOffice(false);
    }
  };

  const activateOffice = async (office: Office) => {
    setBusyId(office.id);
    setNotice(null);

    try {
      await apiRequest(`/office-locations/${office.id}/activate`, {
        method: 'POST',
      });
      showNotice(`Lokasi ${office.name} diaktifkan.`);
      await refreshOffices();
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openShiftCreate = () => {
    setShiftForm(EMPTY_SHIFT);
    setShiftError(null);
    setShiftOpen(true);
  };

  const openShiftEdit = (shift: Shift) => {
    setShiftForm({
      id: shift.id,
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      toleranceMinutes: String(shift.toleranceMinutes),
      earlyWindowMinutes: String(shift.earlyWindowMinutes),
      sortOrder: String(shift.sortOrder),
      isActive: shift.isActive,
    });
    setShiftError(null);
    setShiftOpen(true);
  };

  const saveShift = async () => {
    setSavingShift(true);
    setShiftError(null);

    try {
      const body = {
        name: shiftForm.name.trim(),
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        toleranceMinutes: Number(shiftForm.toleranceMinutes),
        earlyWindowMinutes: Number(shiftForm.earlyWindowMinutes),
        sortOrder: Number(shiftForm.sortOrder),
        isActive: shiftForm.isActive,
      };

      if (shiftForm.id) {
        await apiRequest(`/shifts/${shiftForm.id}`, {
          method: 'PATCH',
          body,
        });
        showNotice('Shift diperbarui.');
      } else {
        await apiRequest('/shifts', { method: 'POST', body });
        showNotice('Shift dibuat.');
      }

      setShiftOpen(false);
      await refreshShifts();
    } catch (error) {
      setShiftError(errorMessage(error));
    } finally {
      setSavingShift(false);
    }
  };

  const toggleShift = async (shift: Shift) => {
    setBusyId(shift.id);
    setNotice(null);

    try {
      await apiRequest(`/shifts/${shift.id}`, {
        method: 'PATCH',
        body: { isActive: !shift.isActive },
      });
      await refreshShifts();
      showNotice(
        shift.isActive ? 'Shift dinonaktifkan.' : 'Shift diaktifkan kembali.',
      );
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Lokasi & Shift"
        description="Atur geofence kantor dan jadwal shift yang dapat dipilih karyawan."
      />

      {notice ? (
        <div className="mb-4">
          <Notice message={notice} tone={noticeTone} />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Lokasi Kantor
            </h2>
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              onClick={() => {
                setOfficeForm(EMPTY_OFFICE);
                setOfficeError(null);
              }}>
              <Plus className="h-3 w-3" /> Baru
            </Button>
          </div>

          {officesQuery.isLoading ? (
            <Loading />
          ) : officesQuery.error ? (
            <ErrorNotice message={errorMessage(officesQuery.error)} />
          ) : offices.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada lokasi kantor.</p>
          ) : (
            <div className="mb-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Nama</th>
                    <th className="py-2 pr-3">Radius</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {offices.map((office) => (
                    <tr key={office.id}>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-900">{office.name}</p>
                        <p className="text-xs text-slate-500">
                          {office.latitude}, {office.longitude} ·{' '}
                          {office.timezone}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {office.radiusMeters} m
                      </td>
                      <td className="py-2 pr-3">
                        {office.isActive ? (
                          <Badge tone="success">Aktif</Badge>
                        ) : (
                          <Badge tone="neutral">Nonaktif</Badge>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            onClick={() => editOffice(office)}>
                            Edit
                          </Button>
                          {!office.isActive ? (
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={busyId === office.id}
                              onClick={() => void activateOffice(office)}>
                              Aktifkan
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-800">
              {officeForm.id ? 'Edit Lokasi' : 'Lokasi Baru'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nama">
                <Input
                  value={officeForm.name}
                  onChange={(event) =>
                    setOfficeForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Zona waktu">
                <Input
                  value={officeForm.timezone}
                  onChange={(event) =>
                    setOfficeForm((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                  placeholder="Asia/Jakarta"
                />
              </Field>
              <Field label="Latitude">
                <Input
                  type="number"
                  step="0.000001"
                  value={officeForm.latitude}
                  onChange={(event) =>
                    setOfficeForm((current) => ({
                      ...current,
                      latitude: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="0.000001"
                  value={officeForm.longitude}
                  onChange={(event) =>
                    setOfficeForm((current) => ({
                      ...current,
                      longitude: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Radius (meter)">
                <Input
                  type="number"
                  min={10}
                  max={1000}
                  value={officeForm.radiusMeters}
                  onChange={(event) =>
                    setOfficeForm((current) => ({
                      ...current,
                      radiusMeters: event.target.value,
                    }))
                  }
                />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={officeForm.isActive}
                  onChange={(event) =>
                    setOfficeForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Jadikan lokasi aktif
              </label>
            </div>

            {officeError ? <ErrorNotice message={officeError} /> : null}

            <Button onClick={() => void saveOffice()} disabled={savingOffice}>
              {savingOffice ? 'Menyimpan…' : 'Simpan Lokasi'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Shift</h2>
            <Button variant="secondary" onClick={openShiftCreate}>
              <Plus className="h-4 w-4" />
              Shift Baru
            </Button>
          </div>

          {shiftsQuery.isLoading ? (
            <Loading />
          ) : shiftsQuery.error ? (
            <ErrorNotice message={errorMessage(shiftsQuery.error)} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Nama</th>
                    <th className="py-2 pr-3">Jam</th>
                    <th className="py-2 pr-3">Toleransi</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shifts.length === 0 ? (
                    <EmptyRow colSpan={5} message="Belum ada shift." />
                  ) : (
                    shifts.map((shift) => (
                      <tr key={shift.id}>
                        <td className="py-2 pr-3 font-medium text-slate-900">
                          {shift.name}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {shift.startTime}–{shift.endTime}
                          {shift.crossesMidnight ? (
                            <span className="ml-1 text-xs text-amber-600">
                              (lintas hari)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {shift.toleranceMinutes} mnt
                        </td>
                        <td className="py-2 pr-3">
                          {shift.isActive ? (
                            <Badge tone="success">Aktif</Badge>
                          ) : (
                            <Badge tone="neutral">Nonaktif</Badge>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => openShiftEdit(shift)}>
                              Edit
                            </Button>
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={busyId === shift.id}
                              onClick={() => void toggleShift(shift)}>
                              {shift.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={shiftOpen}
        onClose={() => setShiftOpen(false)}
        title={shiftForm.id ? 'Edit Shift' : 'Shift Baru'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShiftOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void saveShift()} disabled={savingShift}>
              {savingShift ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama shift">
            <Input
              value={shiftForm.name}
              onChange={(event) =>
                setShiftForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Urutan">
            <Input
              type="number"
              value={shiftForm.sortOrder}
              onChange={(event) =>
                setShiftForm((current) => ({
                  ...current,
                  sortOrder: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Jam mulai">
            <Input
              type="time"
              value={shiftForm.startTime}
              onChange={(event) =>
                setShiftForm((current) => ({
                  ...current,
                  startTime: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Jam selesai">
            <Input
              type="time"
              value={shiftForm.endTime}
              onChange={(event) =>
                setShiftForm((current) => ({
                  ...current,
                  endTime: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Toleransi (menit)">
            <Input
              type="number"
              min={0}
              max={120}
              value={shiftForm.toleranceMinutes}
              onChange={(event) =>
                setShiftForm((current) => ({
                  ...current,
                  toleranceMinutes: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Jendela Clock-In lebih awal (menit)">
            <Input
              type="number"
              min={0}
              max={480}
              value={shiftForm.earlyWindowMinutes}
              onChange={(event) =>
                setShiftForm((current) => ({
                  ...current,
                  earlyWindowMinutes: event.target.value,
                }))
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={shiftForm.isActive}
              onChange={(event) =>
                setShiftForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Shift aktif
          </label>
        </div>

        {shiftError ? <ErrorNotice message={shiftError} /> : null}
      </Modal>
    </div>
  );
}
