export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Sesi tidak valid atau sudah berakhir.') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'Anda tidak berwenang melakukan tindakan ini.') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Data tidak ditemukan.') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(code: string, message: string, details?: unknown) {
    return new ApiError(409, code, message, details);
  }

  static unprocessable(code: string, message: string, details?: unknown) {
    return new ApiError(422, code, message, details);
  }
}
