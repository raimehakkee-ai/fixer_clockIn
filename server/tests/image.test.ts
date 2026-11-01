import { describe, expect, it } from 'vitest';

import { detectFileType, isAllowedType, IMAGE_TYPES } from '../src/lib/image';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const PDF = Buffer.from('%PDF-1.7\n');

describe('detectFileType', () => {
  it('mendeteksi JPEG dari magic bytes', () => {
    expect(detectFileType(JPEG)).toBe('image/jpeg');
  });

  it('mendeteksi PNG dari signature', () => {
    expect(detectFileType(PNG)).toBe('image/png');
  });

  it('mendeteksi PDF', () => {
    expect(detectFileType(PDF)).toBe('application/pdf');
  });

  it('menolak teks yang menyamar sebagai gambar', () => {
    expect(detectFileType(Buffer.from('JFIF ini bukan gambar'))).toBeNull();
  });

  it('menolak file kosong', () => {
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });

  it('menolak format di luar allow-list', () => {
    const gif = Buffer.from('GIF89a');
    expect(isAllowedType(detectFileType(gif), IMAGE_TYPES)).toBe(false);
  });

  it('menerima JPEG dan PNG untuk foto absensi', () => {
    expect(isAllowedType(detectFileType(JPEG), IMAGE_TYPES)).toBe(true);
    expect(isAllowedType(detectFileType(PNG), IMAGE_TYPES)).toBe(true);
  });
});
