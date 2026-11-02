import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  Clock,
  Download,
  FileSpreadsheet,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { StatCard } from '@/components/stat-card';
import {
  Button,
  Card,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
} from '@/components/ui';
import { apiGet, downloadFile, errorMessage } from '@/lib/api';
import { formatWorkDate, monthStart, todayString } from '@/lib/format';
import type { Summary } from '@/lib/types';

export function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');

  const showNotice = (message: string, tone: 'success' | 'error' = 'success') => {
    setNotice(message);
    setNoticeTone(tone);
  };

  const summaryQuery = useQuery({
    queryKey: ['summary'],
    queryFn: () => apiGet<{ summary: Summary }>('/reports/summary'),
  });

  const summary = summaryQuery.data?.summary;
  const effectiveTo = to || summary?.date || todayString();
  const effectiveFrom = from || monthStart(effectiveTo);

  const download = async (report: 'attendance' | 'leave') => {
    setDownloading(report);
    setNotice(null);

    try {
      const params = new URLSearchParams({
        from: effectiveFrom,
        to: effectiveTo,
        format,
      });
      const prefix = report === 'attendance' ? 'rekap-absensi' : 'rekap-izin';
      await downloadFile(
        `/reports/${report}/export?${params.toString()}`,
        `${prefix}-${effectiveFrom}_${effectiveTo}.${format}`,
      );
      showNotice(
        `Unduhan ${format.toUpperCase()} dimulai. Aktivitas tercatat di audit log.`,
      );
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Laporan"
        description="Unduh rekapitulasi absensi dan izin dalam format CSV atau Excel."
      />

      {notice ? (
        <div className="mb-4">
          <Notice message={notice} tone={noticeTone} />
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Karyawan Aktif"
          value={summary?.totalEmployees ?? 0}
          icon={Users}
        />
        <StatCard
          label="Hadir Hari Ini"
          value={summary?.present ?? 0}
          icon={UserCheck}
          tone="emerald"
        />
        <StatCard
          label="Terlambat Hari Ini"
          value={summary?.late ?? 0}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Belum Keluar"
          value={summary?.incomplete ?? 0}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Izin / Cuti Hari Ini"
          value={summary?.onLeave ?? 0}
          icon={CalendarClock}
          tone="indigo"
        />
        <StatCard
          label="Belum Absen"
          value={summary?.absent ?? 0}
          icon={UserX}
          tone="red"
        />
        <StatCard
          label="Record Absensi"
          value={summary?.attendanceRecords ?? 0}
          icon={FileSpreadsheet}
        />
      </div>

      {summary ? (
        <p className="mb-4 text-xs text-slate-500">
          Ringkasan di atas untuk {formatWorkDate(summary.date)} (zona waktu{' '}
          {summary.timezone}).
        </p>
      ) : null}

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Dari tanggal">
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="Sampai tanggal">
            <Input
              type="date"
              value={effectiveTo}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
          <Field label="Format berkas">
            <Select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value === 'xlsx' ? 'xlsx' : 'csv')
              }>
              <option value="csv">CSV (UTF-8)</option>
              <option value="xlsx">Excel (XLSX)</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => void download('attendance')}
            disabled={downloading !== null}>
            <Download className="h-4 w-4" />
            {downloading === 'attendance'
              ? 'Mengunduh…'
              : 'Unduh Rekap Absensi'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void download('leave')}
            disabled={downloading !== null}>
            <Download className="h-4 w-4" />
            {downloading === 'leave'
              ? 'Mengunduh…'
              : 'Unduh Rekap Izin'}
          </Button>
        </div>

        <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <p>
            Rekap absensi berisi satu baris per record absensi. Angka hadir/absen
            tersedia pada ringkasan harian di atas.
          </p>
          <p>
            Batas 20.000 baris per unduhan, maksimal 10 unduhan per jam. CSV
            diamankan dari formula injection; XLSX ditulis sebagai teks.
          </p>
        </div>
      </Card>
    </div>
  );
}
