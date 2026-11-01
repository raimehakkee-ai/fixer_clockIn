const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const suffix = Date.now().toString(36);

const PDF = Buffer.from('%PDF-1.7\n% smoke test\n');
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
  return { status: response.status, body };
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

async function login(email, password, deviceIdentifier) {
  return request(
    '/auth/login',
    json('POST', {
      email,
      password,
      ...(deviceIdentifier
        ? { deviceIdentifier, platform: 'android', deviceName: 'Leave Smoke' }
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

async function createLeave(token, fields, attachment) {
  const form = new FormData();
  form.append('type', fields.type);
  form.append('startDate', fields.startDate);
  form.append('endDate', fields.endDate);
  form.append('reason', fields.reason);

  if (attachment) {
    form.append(
      'attachment',
      new Blob([attachment.buffer], { type: attachment.type }),
      attachment.name,
    );
  }

  return request('/leave-requests', {
    method: 'POST',
    headers: auth(token),
    body: form,
  });
}

const adminLogin = await login('admin@clockin.test', 'Admin123!');
const adminToken = adminLogin.body?.accessToken;
check('Login admin → 200', adminLogin.status === 200);

const officeList = await request('/office-locations', { headers: auth(adminToken) });
const office = officeList.body?.data?.find((item) => item.isActive);

const email = `cuti.${suffix}@clockin.test`;
const employeeNumber = `EMP-CUTI-${suffix}`;
const password = 'Karyawan123!';

const created = await request(
  '/employees',
  json(
    'POST',
    {
      email,
      password,
      employeeNumber,
      fullName: 'Karyawan Cuti Uji',
      department: 'QA',
      officeLocationId: office?.id,
    },
    adminToken,
  ),
);
check('Buat karyawan uji → 201', created.status === 201);
const employeeId = created.body?.employee?.id;

const employeeLogin = await login(email, password, `cuti-device-${suffix}`);
const token = employeeLogin.body?.accessToken;
check('Login karyawan uji → 200', employeeLogin.status === 200);

const budiLogin = await login('budi@clockin.test', 'Employee123!', 'device-budi-001');
const budiToken = budiLogin.body?.accessToken;

const reason = 'Sakit demam tinggi dan perlu istirahat';

check(
  'Buat pengajuan tanpa token → 401',
  (await createLeave(null, { type: 'SICK', startDate: addDays(10), endDate: addDays(11), reason })).status === 401,
);

const valid = await createLeave(
  token,
  { type: 'SICK', startDate: addDays(10), endDate: addDays(11), reason },
  { buffer: PDF, type: 'application/pdf', name: 'surat-dokter.pdf' },
);
check('Buat pengajuan sah dengan lampiran → 201', valid.status === 201);
const leaveId = valid.body?.leave?.id;
check('Status awal PENDING', valid.body?.leave?.status === 'PENDING');
check('Jumlah hari inklusif', valid.body?.leave?.days === 2);
check('Lampiran tersedia', valid.body?.leave?.attachmentAvailable === true && valid.body?.leave?.attachmentMime === 'application/pdf');

const invalidRange = await createLeave(token, {
  type: 'SICK',
  startDate: addDays(12),
  endDate: addDays(11),
  reason,
});
check('Tanggal terbalik → 400', invalidRange.status === 400);

const shortReason = await createLeave(token, {
  type: 'SICK',
  startDate: addDays(15),
  endDate: addDays(15),
  reason: 'sakit',
});
check('Alasan terlalu pendek → 400', shortReason.status === 400);

const overlap = await createLeave(token, {
  type: 'ANNUAL',
  startDate: addDays(10),
  endDate: addDays(11),
  reason,
});
check(
  'Tanggal beririsan → 409 LEAVE_OVERLAP',
  overlap.status === 409 && overlap.body?.error?.code === 'LEAVE_OVERLAP',
);

const fakeAttachment = await createLeave(
  token,
  { type: 'SICK', startDate: addDays(16), endDate: addDays(16), reason },
  {
    buffer: Buffer.from('ini teks biasa, bukan PDF'),
    type: 'application/pdf',
    name: 'palsu.pdf',
  },
);
check('Lampiran palsu → 400', fakeAttachment.status === 400);

const mine = await request('/leave-requests/me', { headers: auth(token) });
check(
  'Riwayat pengajuan sendiri memuat data',
  mine.status === 200 && mine.body?.data?.some((row) => row.id === leaveId),
);

const adminList = await request(
  `/leave-requests?status=PENDING&employeeId=${employeeId}`,
  { headers: auth(adminToken) },
);
check(
  'Admin melihat pengajuan PENDING',
  adminList.status === 200 && adminList.body?.data?.some((row) => row.id === leaveId),
);

check(
  'Karyawan lain tidak dapat melihat pengajuan → 404',
  (await request(`/leave-requests/${leaveId}`, { headers: auth(budiToken) })).status === 404,
);

const otherAttachment = await fetch(`${BASE}/leave-requests/${leaveId}/attachment`, {
  headers: auth(budiToken),
});
check('Karyawan lain tidak dapat mengunduh lampiran → 404', otherAttachment.status === 404);

const attachment = await fetch(`${BASE}/leave-requests/${leaveId}/attachment`, {
  headers: auth(token),
});
check(
  'Pemilik dapat mengunduh lampiran',
  attachment.status === 200 && attachment.headers.get('content-type') === 'application/pdf',
);

check(
  'Karyawan tidak boleh approve → 403',
  (await request(`/leave-requests/${leaveId}/approve`, json('POST', {}, token))).status === 403,
);

const approve = await request(
  `/leave-requests/${leaveId}/approve`,
  json('POST', { reviewNote: 'Disetujui, semoga lekas sembuh' }, adminToken),
);
check(
  'Admin approve → 200 APPROVED',
  approve.status === 200 &&
    approve.body?.leave?.status === 'APPROVED' &&
    approve.body?.leave?.reviewer?.email === 'admin@clockin.test',
);

const approveAgain = await request(
  `/leave-requests/${leaveId}/approve`,
  json('POST', {}, adminToken),
);
check(
  'Approve ulang → 409 LEAVE_ALREADY_REVIEWED',
  approveAgain.status === 409 && approveAgain.body?.error?.code === 'LEAVE_ALREADY_REVIEWED',
);

const cancelApproved = await request(
  `/leave-requests/${leaveId}/cancel`,
  json('POST', {}, token),
);
check('Batalkan pengajuan APPROVED → 409', cancelApproved.status === 409);

const second = await createLeave(token, {
  type: 'ANNUAL',
  startDate: addDays(20),
  endDate: addDays(20),
  reason: 'Cuti tahunan keluarga',
});
check('Buat pengajuan kedua → 201', second.status === 201);
const secondId = second.body?.leave?.id;

const rejectWithoutNote = await request(
  `/leave-requests/${secondId}/reject`,
  json('POST', {}, adminToken),
);
check('Reject tanpa catatan → 400', rejectWithoutNote.status === 400);

const reject = await request(
  `/leave-requests/${secondId}/reject`,
  json('POST', { reviewNote: 'Tanggal bentrok dengan jadwal tim' }, adminToken),
);
check(
  'Reject dengan catatan → 200 REJECTED',
  reject.status === 200 &&
    reject.body?.leave?.status === 'REJECTED' &&
    reject.body?.leave?.reviewNote === 'Tanggal bentrok dengan jadwal tim',
);

const third = await createLeave(token, {
  type: 'PERMISSION',
  startDate: addDays(30),
  endDate: addDays(30),
  reason: 'Izin keperluan keluarga',
});
check('Buat pengajuan ketiga → 201', third.status === 201);
const thirdId = third.body?.leave?.id;

const cancel = await request(
  `/leave-requests/${thirdId}/cancel`,
  json('POST', {}, token),
);
check('Batalkan pengajuan PENDING → 200 CANCELLED', cancel.status === 200 && cancel.body?.leave?.status === 'CANCELLED');

const cancelAgain = await request(
  `/leave-requests/${thirdId}/cancel`,
  json('POST', {}, token),
);
check('Batalkan dua kali → 409', cancelAgain.status === 409);

const rejectedList = await request(
  `/leave-requests?status=REJECTED&employeeId=${employeeId}`,
  { headers: auth(adminToken) },
);
check(
  'Filter status REJECTED bekerja',
  rejectedList.status === 200 && rejectedList.body?.data?.some((row) => row.id === secondId),
);

check(
  'Status filter tidak valid → 400',
  (await request('/leave-requests?status=FOO', { headers: auth(adminToken) })).status === 400,
);

check(
  'Admin dapat melihat detail pengajuan',
  (await request(`/leave-requests/${secondId}`, { headers: auth(adminToken) })).status === 200,
);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);

if (failed.length > 0) {
  process.exitCode = 1;
}
