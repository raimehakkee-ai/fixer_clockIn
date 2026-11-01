import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalStorage } from '../src/lib/storage';

let directory = '';

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'clockin-storage-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('LocalStorage', () => {
  it('menyimpan, membaca, dan menghapus file', async () => {
    const storage = new LocalStorage(directory);
    const key = await storage.save(
      Buffer.from('isi-gambar'),
      'image/png',
      'attendance/2026-11-01',
    );

    expect(key).toMatch(/^attendance\/2026-11-01\/[0-9a-f-]+\.png$/);
    expect((await storage.read(key)).toString()).toBe('isi-gambar');

    await storage.delete(key);
    await expect(storage.read(key)).rejects.toThrow();
  });

  it('mengabaikan penghapusan file yang tidak ada', async () => {
    const storage = new LocalStorage(directory);
    await expect(storage.delete('tidak-ada/file.png')).resolves.toBeUndefined();
  });

  it('menolak path traversal', async () => {
    const storage = new LocalStorage(directory);
    await expect(storage.read('../rahasia.txt')).rejects.toThrow(
      'Path storage tidak valid',
    );
  });
});
