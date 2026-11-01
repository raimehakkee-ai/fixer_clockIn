import type { AttendanceStatus, LeaveStatus, LeaveType } from './types';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary';

export function attendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'PRESENT':
      return 'Hadir';
    case 'LATE':
      return 'Terlambat';
    case 'INCOMPLETE':
      return 'Belum keluar';
  }
}

export function attendanceStatusTone(status: AttendanceStatus): Tone {
  switch (status) {
    case 'PRESENT':
      return 'success';
    case 'LATE':
      return 'warning';
    case 'INCOMPLETE':
      return 'danger';
  }
}

export function leaveStatusLabel(status: LeaveStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Menunggu';
    case 'APPROVED':
      return 'Disetujui';
    case 'REJECTED':
      return 'Ditolak';
    case 'CANCELLED':
      return 'Dibatalkan';
  }
}

export function leaveStatusTone(status: LeaveStatus): Tone {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'CANCELLED':
      return 'neutral';
  }
}

export function leaveTypeLabel(type: LeaveType): string {
  switch (type) {
    case 'SICK':
      return 'Sakit';
    case 'ANNUAL':
      return 'Cuti';
    case 'PERMISSION':
      return 'Izin';
    case 'OTHER':
      return 'Lainnya';
  }
}
