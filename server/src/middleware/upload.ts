import multer from 'multer';

import { env } from '../env';
import { ApiError } from '../lib/errors';

const LIMITS = {
  fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
  files: 1,
  fields: 10,
};

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: LIMITS,
  fileFilter(_req, file, callback) {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      callback(null, true);
      return;
    }

    callback(
      ApiError.badRequest('Tipe file tidak diizinkan. Gunakan JPEG atau PNG.'),
    );
  },
});

export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: LIMITS,
  fileFilter(_req, file, callback) {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];

    if (allowed.includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(
      ApiError.badRequest('Lampiran harus berupa JPEG, PNG, atau PDF.'),
    );
  },
});
