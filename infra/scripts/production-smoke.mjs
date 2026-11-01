const BASE = process.env.BASE_URL ?? 'http://localhost:8080';

const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition) });
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
  return { status: response.status, body, headers: response.headers, text };
}

const page = await fetch(`${BASE}/`);
const html = await page.text();

check('Halaman admin → 200', page.status === 200);
check('HTML memuat root aplikasi', html.includes('id="root"'));
check(
  'Header CSP diterapkan pada HTML',
  (page.headers.get('content-security-policy') ?? '').includes(
    "default-src 'self'",
  ),
);
check(
  'Header nosniff diterapkan pada HTML',
  page.headers.get('x-content-type-options') === 'nosniff',
);

const deepLink = await request('/attendance');
check(
  'Deep link SPA /attendance → 200 HTML',
  deepLink.status === 200 && deepLink.text.includes('id="root"'),
);

const assetMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
check('HTML memuat bundle JavaScript', Boolean(assetMatch));

if (assetMatch?.[1]) {
  const asset = await fetch(`${BASE}${assetMatch[1]}`);
  check(
    'Bundle JavaScript dapat dimuat',
    asset.status === 200 &&
      (asset.headers.get('content-type') ?? '').includes('javascript'),
  );
}

const health = await request('/api/v1/health');
check(
  'Health check melalui proxy → 200',
  health.status === 200 && health.body?.ok === true,
);
check('Health check memverifikasi database', health.body?.db === 'ok');

const login = await request('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@clockin.test',
    password: 'Admin123!',
    platform: 'web',
  }),
});
check(
  'Login Admin melalui proxy → 200',
  login.status === 200 && login.body?.user?.role === 'ADMIN',
);

const token = login.body?.accessToken;

const summary = await request('/api/v1/reports/summary', {
  headers: { Authorization: `Bearer ${token}` },
});
check(
  'Ringkasan Admin melalui proxy → 200',
  summary.status === 200 && typeof summary.body?.summary?.totalEmployees === 'number',
);

const invalidLogin = await request('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@clockin.test',
    password: 'password-salah',
    platform: 'web',
  }),
});
check('Login salah melalui proxy → 401', invalidLogin.status === 401);

const missingRoute = await request('/api/v1/tidak-ada');
check(
  'Route API tidak dikenal → 404 JSON',
  missingRoute.status === 404 && missingRoute.body?.error?.code === 'NOT_FOUND',
);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);

if (failed.length > 0) {
  process.exitCode = 1;
}
