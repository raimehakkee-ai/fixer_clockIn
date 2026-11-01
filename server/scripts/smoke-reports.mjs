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
        ? { deviceIdentifier, platform: 'android', deviceName: 'Report Smoke' }
        : { platform: 'web' }),
    }),
  );
}

function addDays(days) {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const today = addDays(0);

const adminLogin = await login('admin@clockin.test', 'Admin123!');
const adminToken = adminLogin.body?.accessToken;
check('Login admin → 200', adminLogin.status === 200);

const budiLogin = await login('budi@clockin.test', 'Employee123!', 'device-budi-001');
const employeeToken = budiLogin.body?.accessToken;

const summary = await request('/reports/summary', { headers: auth(adminToken) });
check('GET /reports/summary → 200', summary.status === 200);
check(
  'Ringkasan berisi angka yang konsisten',
  typeof summary.body?.summary?.totalEmployees === 'number' &&
    typeof summary.body?.summary?.present === 'number' &&
    typeof summary.body?.summary?.late === 'number' &&
    typeof summary.body?.summary?.onLeave === 'number' &&
    typeof summary.body?.summary?.absent === 'number',
);
check(
  'Tanggal ringkasan berformat YYYY-MM-DD',
  /^\d{4}-\d{2}-\d{2}$/.test(summary.body?.summary?.date ?? ''),
);

const summaryDated = await request(`/reports/summary?date=${today}`, {
  headers: auth(adminToken),
});
check('GET /reports/summary?date= → 200', summaryDated.status === 200 && summaryDated.body?.summary?.date === today);

check(
  'Summary tanggal tidak valid → 400',
  (await request('/reports/summary?date=2026-13-01', { headers: auth(adminToken) })).status === 400,
);
check(
  'Summary tanpa token → 401',
  (await request('/reports/summary')).status === 401,
);
check(
  'Summary dengan token karyawan → 403',
  (await request('/reports/summary', { headers: auth(employeeToken) })).status === 403,
);

const attendanceCsv = await fetch(
  `${BASE}/reports/attendance/export?from=${today}&to=${today}&format=csv`,
  { headers: auth(adminToken) },
);
const attendanceCsvBuffer = Buffer.from(await attendanceCsv.arrayBuffer());
const attendanceCsvText = attendanceCsvBuffer.toString('utf8');
check('Export absensi CSV → 200', attendanceCsv.status === 200);
check(
  'CSV memakai UTF-8 BOM dan header Indonesia',
  attendanceCsvBuffer[0] === 0xef &&
    attendanceCsvBuffer[1] === 0xbb &&
    attendanceCsvBuffer[2] === 0xbf &&
    attendanceCsvText.includes('"NIK"') &&
    attendanceCsvText.includes('"Nama"'),
);
check(
  'Content-Type CSV benar',
  (attendanceCsv.headers.get('content-type') ?? '').includes('text/csv'),
);
check(
  'Nama file ekspor benar',
  (attendanceCsv.headers.get('content-disposition') ?? '').includes('rekap-absensi'),
);

const attendanceXlsx = await fetch(
  `${BASE}/reports/attendance/export?from=${today}&to=${today}&format=xlsx`,
  { headers: auth(adminToken) },
);
const xlsxBuffer = Buffer.from(await attendanceXlsx.arrayBuffer());
check('Export absensi XLSX → 200', attendanceXlsx.status === 200);
check(
  'XLSX adalah file ZIP yang valid',
  xlsxBuffer.length > 1000 && xlsxBuffer[0] === 0x50 && xlsxBuffer[1] === 0x4b,
);
check(
  'Content-Type XLSX benar',
  (attendanceXlsx.headers.get('content-type') ?? '').includes('spreadsheetml.sheet'),
);

check(
  'Format ekspor tidak valid → 400',
  (await request('/reports/attendance/export?format=xml', { headers: auth(adminToken) })).status === 400,
);
check(
  'Tanggal ekspor tidak valid → 400',
  (await request('/reports/attendance/export?from=2026-13-01&to=2026-13-02', { headers: auth(adminToken) })).status === 400,
);
check(
  'Rentang terbalik → 400',
  (await request(`/reports/attendance/export?from=${addDays(2)}&to=${today}`, { headers: auth(adminToken) })).status === 400,
);
check(
  'Export dengan token karyawan → 403',
  (await request(`/reports/attendance/export?from=${today}&to=${today}`, { headers: auth(employeeToken) })).status === 403,
);
check(
  'Export tanpa token → 401',
  (await request(`/reports/attendance/export?from=${today}&to=${today}`)).status === 401,
);

const officeList = await request('/office-locations', { headers: auth(adminToken) });
const office = officeList.body?.data?.find((item) => item.isActive);

const injectionName = '=HYPERLINK("http://evil.test","klik")';
const employeeEmail = `inject.${suffix}@clockin.test`;
const employeeNumber = `EMP-INJ-${suffix}`;

const created = await request(
  '/employees',
  json(
    'POST',
    {
      email: employeeEmail,
      password: 'Karyawan123!',
      employeeNumber,
      fullName: injectionName,
      officeLocationId: office?.id,
    },
    adminToken,
  ),
);
check('Buat karyawan uji CSV injection → 201', created.status === 201);
const injectionEmployeeId = created.body?.employee?.id;

const injectionLogin = await login(
  employeeEmail,
  'Karyawan123!',
  `inject-device-${suffix}`,
);
const injectionToken = injectionLogin.body?.accessToken;

const leaveForm = new FormData();
leaveForm.append('type', 'ANNUAL');
leaveForm.append('startDate', addDays(60));
leaveForm.append('endDate', addDays(61));
leaveForm.append('reason', 'Pengujian ekspor dan keamanan CSV');

const leaveCreated = await request('/leave-requests', {
  method: 'POST',
  headers: auth(injectionToken),
  body: leaveForm,
});
check('Buat pengajuan untuk uji ekspor → 201', leaveCreated.status === 201);

const leaveCsv = await fetch(
  `${BASE}/reports/leave/export?from=${addDays(50)}&to=${addDays(70)}&employeeId=${injectionEmployeeId}&format=csv`,
  { headers: auth(adminToken) },
);
const leaveCsvText = await leaveCsv.text();
check('Export izin CSV → 200', leaveCsv.status === 200);
check(
  'CSV izin memuat karyawan terkait',
  leaveCsvText.includes(employeeNumber) && leaveCsvText.includes('"Cuti"'),
);
check(
  'Formula CSV dinetralkan dengan prefiks apostrof',
  leaveCsvText.includes(`'=HYPERLINK`) || leaveCsvText.includes(`'=HYPERLINK(`),
);

const exportsAudit = await request(
  '/audit-logs?action=EXPORT_DOWNLOADED&limit=10',
  { headers: auth(adminToken) },
);
check(
  'Audit log mencatat unduhan laporan',
  exportsAudit.status === 200 &&
    exportsAudit.body?.meta?.total >= 2 &&
    exportsAudit.body?.data?.[0]?.actor?.email === 'admin@clockin.test',
);
check(
  'Metadata audit memuat jenis laporan',
  exportsAudit.body?.data?.some((row) => row.metadata?.report === 'attendance'),
);

const loginAudit = await request(
  '/audit-logs?action=LOGIN_SUCCESS&limit=5',
  { headers: auth(adminToken) },
);
check(
  'Filter audit berdasarkan action bekerja',
  loginAudit.status === 200 && loginAudit.body?.meta?.total >= 1,
);

check(
  'Filter actorId tidak valid → 400',
  (await request('/audit-logs?actorId=bukan-uuid', { headers: auth(adminToken) })).status === 400,
);
check(
  'Audit log dengan token karyawan → 403',
  (await request('/audit-logs', { headers: auth(employeeToken) })).status === 403,
);
check(
  'Audit log tanpa token → 401',
  (await request('/audit-logs')).status === 401,
);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);

if (failed.length > 0) {
  process.exitCode = 1;
}
