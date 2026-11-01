import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { env } from '../env';

export type StorageDriver = {
  save(buffer: Buffer, mime: string, prefix: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
};

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

function extensionFor(mime: string): string {
  return EXTENSION[mime] ?? 'bin';
}

export class LocalStorage implements StorageDriver {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  private resolveKey(key: string): string {
    const fullPath = path.resolve(this.baseDir, key);
    const insideBase =
      fullPath === this.baseDir || fullPath.startsWith(`${this.baseDir}${path.sep}`);

    if (!insideBase) {
      throw new Error('Path storage tidak valid');
    }

    return fullPath;
  }

  async save(buffer: Buffer, mime: string, prefix: string): Promise<string> {
    const key = `${prefix}/${randomUUID()}.${extensionFor(mime)}`;
    const fullPath = this.resolveKey(key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

export class S3Storage implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
      },
    });
    this.bucket = env.S3_BUCKET ?? '';
  }

  async save(buffer: Buffer, mime: string, prefix: string): Promise<string> {
    const key = `${prefix}/${randomUUID()}.${extensionFor(mime)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
      }),
    );

    return key;
  }

  async read(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!response.Body) {
      throw new Error('Objek storage kosong');
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

export const storage: StorageDriver =
  env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage(env.UPLOAD_DIR);
