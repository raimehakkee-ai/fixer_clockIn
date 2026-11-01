const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const suffix = Date.now().toString(36);

const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function auth(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function json(method, body, token) {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify(body),
  };
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

async function login(email, password, deviceIdentifier) {
  return request(
    '/auth/login',
    json('POST', {
      email,
      password,
      ...(deviceIdentifier
        ? { deviceIdentifier, platform: 'android', deviceName: 'Security Smoke' }
        : { platform: 'web' }),
    }),
  );
}

const adminLogin = await login('admin@clockin.test', 'Admin123!');
const adminToken = adminLogin.body?.accessToken;
check('Login admin → 200', adminLogin.status === 200);

const officeList = await request('/office-locations', { headers: auth(adminToken) });
const office = officeList.body?.data?.find((item) => item.isActive);

const employeeEmail = `security.${suffix}@clockin.test`;
const employeeNumber = `EMP-SEC-${suffix}`;

const created = await request(
  '/employees',
  json(
    'POST',
    {
      email: employeeEmail,
      password: 'Karyawan123!',
      employeeNumber,
      fullName: 'Karyawan Security Uji',
      officeLocationId: office?.id,
    },
    adminToken,
  ),
);
check('Buat karyawan uji → 201', created.status === 201);
const employeeId = created.body?.employee?.id;

const employeeLogin = await login(
  employeeEmail,
  'Karyawan123!',
  `security-device-${suffix}`,
);
const employeeToken = employeeLogin.body?.accessToken;
check('Login karyawan uji → 200', employeeLogin.status === 200);

// --- Matriks otorisasi ---
const adminGetEndpoints = [
  '/employees',
  '/attendance',
  '/leave-requests',
  '/reports/summary',
  '/audit-logs',
];

for (const endpoint of adminGetEndpoints) {
  check(
    `GET ${endpoint} tanpa token → 401`,
    (await request(endpoint)).status === 401,
  );
  check(
    `GET ${endpoint} dengan token karyawan → 403`,
    (await request(endpoint, { headers: auth(employeeToken) })).status === 403,
  );
  check(
    `GET ${endpoint} dengan token admin → bukan 401/403`,
    ![401, 403].includes(
      (await request(endpoint, { headers: auth(adminToken) })).status,
    ),
  );
}

const adminPostChecks = [
  { path: '/office-locations', body: { name: 'X', latitude: 0, longitude: 0, radiusMeters: 50, timezone: 'Asia/Jakarta' } },
  { path: '/shifts', body: { name: `X ${suffix}`, startTime: '08:00', endTime: '16:00' } },
  { path: `/employees/${employeeId}/reset-device`, body: {} },
];

for (const item of adminPostChecks) {
  check(
    `POST ${item.path} dengan token karyawan → 403`,
    (
      await request(item.path, json('POST', item.body, employeeToken))
    ).status === 403,
  );
}

const employeeOnlyChecks = [
  { method: 'GET', path: '/attendance/me', body: undefined },
  { method: 'POST', path: '/attendance/clock-in', body: {} },
  { method: 'POST', path: '/leave-requests', body: {} },
];

for (const item of employeeOnlyChecks) {
  const response = await request(
    item.path,
    item.method === 'GET'
      ? { headers: auth(adminToken) }
      : json('POST', item.body, adminToken),
  );
  check(
    `${item.method} ${item.path} dengan token admin → 403`,
    response.status === 403,
  );
}

check(
  'GET /employees/me dengan token admin → 404 (bukan data karyawan)',
  (await request('/employees/me', { headers: auth(adminToken) })).status === 404,
);

// --- JWT & sesi ---
const tamperedToken = `${employeeToken.slice(0, -3)}abc`;
check(
  'Token JWT yang dimodifikasi → 401',
  (await request('/employees/me', { headers: auth(tamperedToken) })).status === 401,
);

// --- Header keamanan ---
const health = await request('/health');
check(
  'Respons API memiliki X-Content-Type-Options: nosniff',
  health.headers.get('x-content-type-options') === 'nosniff',
);
check(
  'Respons API memiliki Content-Security-Policy dari helmet',
  Boolean(health.headers.get('content-security-policy')),
);
check(
  'Respons API memiliki X-Frame-Options',
  Boolean(health.headers.get('x-frame-options')),
);

// --- CORS ---
const allowedCors = await fetch(`${BASE}/health`, {
  headers: { Origin: 'http://localhost:5173' },
});
check(
  'Origin yang diizinkan mendapat header CORS',
  allowedCors.status === 200 &&
    allowedCors.headers.get('access-control-allow-origin') === 'http://localhost:5173',
);

const deniedCors = await request('/health', {
  headers: { Origin: 'http://evil.test' },
});
check('Origin tidak diizinkan → 403', deniedCors.status === 403);

// --- Validasi body ---
const invalidJson = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{',
});
check('JSON tidak valid → 400', invalidJson.status === 400);

const tooLarge = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'x@y.test', password: 'x'.repeat(1_100_000) }),
});
check('Body > 1 MB → 413', tooLarge.status === 413);

// --- Endpoint audit tidak dapat diubah ---
check(
  'DELETE /audit-logs/:id → 404 (append-only)',
  (await request(`/audit-logs/00000000-0000-4000-8000-000000000000`, {
    method: 'DELETE',
    headers: auth(adminToken),
  })).status === 404,
);

// --- SQL injection pada filter pencarian ---
const injection = await request(
  `/attendance?q=${encodeURIComponent("' OR 1=1 --")}`,
  { headers: auth(adminToken) },
);
check(
  'Filter pencarian dengan payload SQL → 200 (parameterized)',
  injection.status === 200,
);

// --- Tidak ada hash password pada respons ---
const employeeList = await request('/employees?limit=5', {
  headers: auth(adminToken),
});
check(
  'Respons karyawan tidak memuat hash password',
  !JSON.stringify(employeeList.body).toLowerCase().includes('passwordhash'),
);

// --- Rate limit login (per email) ---
let rateLimitedAt = 0;
let unauthorizedBeforeLimit = true;

for (let attempt = 1; attempt <= 11; attempt += 1) {
  const response = await login(
    `ratelimit.${suffix}@clockin.test`,
    `salah-${attempt}`,
  );

  if (attempt <= 10 && response.status !== 401) {
    unauthorizedBeforeLimit = false;
  }

  if (response.status === 429) {
    rateLimitedAt = attempt;
    break;
  }
}

check('10 login gagal pertama → 401', unauthorizedBeforeLimit);
check('Login ke-11 dalam 15 menit → 429 RATE_LIMITED', rateLimitedAt === 11);

// --- Rate limit absensi per karyawan ---
let clockLimitedAt = 0;

for (let attempt = 1; attempt <= 21; attempt += 1) {
  const response = await request('/attendance/clock-in', {
    method: 'POST',
    headers: auth(employeeToken),
  });

  if (response.status === 429) {
    clockLimitedAt = attempt;
    break;
  }
}

check(
  'Permintaan absensi ke-21 per jam → 429 RATE_LIMITED',
  clockLimitedAt === 21,
);

// --- Reset perangkat mencabut token lama ---
const reset = await request(
  `/employees/${employeeId}/reset-device`,
  json('POST', {}, adminToken),
);
check('Admin reset perangkat → 200', reset.status === 200);

check(
  'Token lama setelah reset perangkat → 401',
  (await request('/employees/me', { headers: auth(employeeToken) })).status === 401,
);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);

if (failed.length > 0) {
  process.exitCode = 1;
}
