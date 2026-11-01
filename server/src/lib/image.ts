export type DetectedFileType = 'image/jpeg' | 'image/png' | 'application/pdf';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Mendeteksi tipe file dari isi, bukan dari ekstensi atau Content-Type klien.
 */
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }

  return null;
}

export function isAllowedType(
  detected: DetectedFileType | null,
  allowed: readonly DetectedFileType[],
): detected is DetectedFileType {
  return detected !== null && allowed.includes(detected);
}

export const IMAGE_TYPES: readonly DetectedFileType[] = ['image/jpeg', 'image/png'];
export const ATTACHMENT_TYPES: readonly DetectedFileType[] = [
  'image/jpeg',
  'image/png',
  'application/pdf',
];
