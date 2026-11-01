const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';

const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

function jsonInit(method, body, token) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

const health = await request('/health');
check('GET /health → 200', health.status === 200 && health.body?.ok === true);

check('GET /auth/me tanpa token → 401', (await request('/auth/me')).status === 401);

const adminLogin = await request(
  '/auth/login',
  jsonInit('POST', {
    email: 'admin@clockin.test',
    password: 'Admin123!',
    platform: 'web',
  }),
);
check('Login admin → 200', adminLogin.status === 200);
check('Login admin tidak mengembalikan password_hash', !JSON.stringify(adminLogin.body).includes('passwordHash'));

const adminToken = adminLogin.body?.accessToken;

const me = await request('/auth/me', {
  headers: { Authorization: `Bearer ${adminToken}` },
});
check('GET /auth/me dengan token admin → 200', me.status === 200 && me.body?.user?.role === 'ADMIN');
check('Response /auth/me memuat serverTime', typeof me.body?.serverTime === 'string');

const wrongPassword = await request(
  '/auth/login',
  jsonInit('POST', { email: 'admin@clockin.test', password: 'Salah123!', platform: 'web' }),
);
check('Login password salah → 401', wrongPassword.status === 401);
check('Pesan login gagal tidak membocorkan akun', wrongPassword.body?.error?.message === 'Email atau password salah.');

const employeeA = await request(
  '/auth/login',
  jsonInit('POST', {
    email: 'budi@clockin.test',
    password: 'Employee123!',
    deviceIdentifier: 'device-budi-001',
    deviceName: 'Emulator Test',
    platform: 'android',
  }),
);
check('Login karyawan perangkat pertama → 200', employeeA.status === 200);
check('Perangkat terdaftar ACTIVE', employeeA.body?.device?.status === 'ACTIVE');

const employeeB = await request(
  '/auth/login',
  jsonInit('POST', {
    email: 'budi@clockin.test',
    password: 'Employee123!',
    deviceIdentifier: 'device-budi-002',
    platform: 'android',
  }),
);
check(
  'Login karyawan perangkat berbeda → 403 DEVICE_NOT_AUTHORIZED',
  employeeB.status === 403 && employeeB.body?.error?.code === 'DEVICE_NOT_AUTHORIZED',
);

const employeeA2 = await request(
  '/auth/login',
  jsonInit('POST', {
    email: 'budi@clockin.test',
    password: 'Employee123!',
    deviceIdentifier: 'device-budi-001',
    platform: 'android',
  }),
);
check('Login ulang perangkat sama → 200', employeeA2.status === 200);

const refreshToken = employeeA2.body?.refreshToken;
const refresh = await request(
  '/auth/refresh',
  jsonInit('POST', { refreshToken, deviceIdentifier: 'device-budi-001' }),
);
check('Refresh token → 200 dan token baru', refresh.status === 200 && refresh.body?.accessToken && refresh.body?.refreshToken !== refreshToken);

const reused = await request(
  '/auth/refresh',
  jsonInit('POST', { refreshToken, deviceIdentifier: 'device-budi-001' }),
);
check('Refresh token lama setelah rotasi → 401', reused.status === 401);

const newAccess = refresh.body?.accessToken;
const newRefresh = refresh.body?.refreshToken;

const logout = await request(
  '/auth/logout',
  jsonInit('POST', { refreshToken: newRefresh }),
);
check('Logout → 204', logout.status === 204);

const meAfterLogout = await request('/auth/me', {
  headers: { Authorization: `Bearer ${newAccess}` },
});
check('Access token setelah logout → 401 (sesi dicabut)', meAfterLogout.status === 401);

const invalidBody = await request('/auth/login', jsonInit('POST', { email: 'bukan-email' }));
check('Body tidak valid → 400 VALIDATION_ERROR', invalidBody.status === 400 && invalidBody.body?.error?.code === 'VALIDATION_ERROR');

const notFound = await request('/tidak-ada');
check('Endpoint tidak ada → 404 NOT_FOUND', notFound.status === 404 && notFound.body?.error?.code === 'NOT_FOUND');

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);

if (failed.length > 0) {
  process.exitCode = 1;
}
