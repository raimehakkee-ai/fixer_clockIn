process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/clockin_test';
process.env.JWT_ACCESS_SECRET ??=
  'test-only-secret-with-at-least-32-characters';
