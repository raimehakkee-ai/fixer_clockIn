import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  exportFilename,
  formatDateTimeInZone,
  sanitizeCsvCell,
  toCsv,
  toXlsx,
} from '../src/lib/export';

describe('sanitizeCsvCell', () => {
  it('memberi prefiks pada sel berbahaya', () => {
    expect(sanitizeCsvCell('=SUM(A1)')).toBe(`"'=SUM(A1)"`);
    expect(sanitizeCsvCell('@cmd')).toBe(`"'@cmd"`);
    expect(sanitizeCsvCell('+1')).toBe(`"'+1"`);
    expect(sanitizeCsvCell('-1')).toBe(`"'-1"`);
  });

  it('tidak mengubah angka negatif menjadi teks', () => {
    expect(sanitizeCsvCell(-5)).toBe('"-5"');
  });

  it('meng-escape tanda kutip ganda', () => {
    expect(sanitizeCsvCell('a"b')).toBe('"a""b"');
  });

  it('menulis nilai kosong sebagai string kosong', () => {
    expect(sanitizeCsvCell(null)).toBe('""');
    expect(sanitizeCsvCell(undefined)).toBe('""');
  });
});

describe('toCsv', () => {
  it('menambahkan BOM dan CRLF', () => {
    const csv = toCsv(['Nama'], [['Budi']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFF"Nama"\r\n"Budi"\r\n');
  });

  it('menangani baris kosong', () => {
    const csv = toCsv(['A', 'B'], []);
    expect(csv).toBe('\uFEFF"A","B"\r\n');
  });
});

describe('formatDateTimeInZone', () => {
  it('memformat waktu pada zona kantor', () => {
    expect(
      formatDateTimeInZone(new Date('2026-11-01T01:30:00.000Z'), 'Asia/Jakarta'),
    ).toBe('2026-11-01 08:30');
  });

  it('mengembalikan string kosong untuk null', () => {
    expect(formatDateTimeInZone(null, 'Asia/Jakarta')).toBe('');
  });
});

describe('exportFilename', () => {
  it('menyusun nama file dengan periode dan format', () => {
    expect(
      exportFilename('rekap-absensi', '2026-11-01', '2026-11-30', 'xlsx'),
    ).toBe('rekap-absensi-2026-11-01_2026-11-30.xlsx');
  });
});

describe('toXlsx', () => {
  it('menghasilkan arsip XLSX valid dengan nilai sebagai teks', async () => {
    const buffer = await toXlsx(
      'Rekap Absensi',
      [
        { header: 'Nama', key: 'name', width: 24 },
        { header: 'Nilai', key: 'value' },
      ],
      [
        { name: '=HYPERLINK("http://evil.test")', value: 12 },
        { name: 'Budi & Siti', value: null },
      ],
    );

    expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK');

    const files = unzipSync(new Uint8Array(buffer));
    const sheetBytes = files['xl/worksheets/sheet1.xml'];

    expect(files['xl/workbook.xml']).toBeTruthy();
    expect(files['[Content_Types].xml']).toBeTruthy();
    expect(sheetBytes).toBeTruthy();

    const sheet = strFromU8(sheetBytes ?? new Uint8Array());
    expect(sheet).toContain('inlineStr');
    expect(sheet).toContain('=HYPERLINK');
    expect(sheet).toContain('Budi &amp; Siti');
    expect(sheet).toContain('<v>12</v>');
    expect(sheet).not.toContain('<f>');
  });

  it('meng-escape nama sheet', async () => {
    const buffer = await toXlsx('R&D / Laporan', [], []);
    const files = unzipSync(new Uint8Array(buffer));
    const workbook = strFromU8(files['xl/workbook.xml'] ?? new Uint8Array());

    expect(workbook).toContain('R&amp;D');
    expect(workbook).not.toContain('R&D /');
  });
});
