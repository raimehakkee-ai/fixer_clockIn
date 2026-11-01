import { Badge } from '@/components/ui';
import type { AttendanceStatus, LeaveStatus } from '@/lib/types';

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  switch (status) {
    case 'PRESENT':
      return <Badge tone="success">Hadir</Badge>;
    case 'LATE':
      return <Badge tone="warning">Terlambat</Badge>;
    case 'INCOMPLETE':
      return <Badge tone="danger">Belum keluar</Badge>;
  }
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  switch (status) {
    case 'PENDING':
      return <Badge tone="warning">Menunggu</Badge>;
    case 'APPROVED':
      return <Badge tone="success">Disetujui</Badge>;
    case 'REJECTED':
      return <Badge tone="danger">Ditolak</Badge>;
    case 'CANCELLED':
      return <Badge tone="neutral">Dibatalkan</Badge>;
  }
}
