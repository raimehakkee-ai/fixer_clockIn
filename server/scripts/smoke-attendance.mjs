const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const suffix = Date.now().toString(36);

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

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
  return { status: response.status, body, headers: response.headers };
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
        ? { deviceIdentifier, platform: 'android', deviceName: 'Attendance Smoke' }
        : { platform: 'web' }),
    }),
  );
}

function toMinutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function formatMinutes(total) {
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function localMinutes(timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  return read('hour') * 60 + read('minute');
}

function shiftDuration(shift) {
  const start = toMinutes(shift.startTime);
  const end = toMinutes(shift.endTime);
  return end > start ? end - start : end + 1440 - start;
}

function isWithinWindow(shift, minutes) {
  const relative = (((minutes - toMinutes(shift.startTime)) % 1440) + 1440) % 1440;
  return relative <= shiftDuration(shift) || relative >= 1440 - shift.earlyWindowMinutes;
}

async function clock(path, token, options) {
  const form = new FormData();

  if (options.photo !== 'none') {
    const mime = options.photo === 'invalid' ? 'image/png' : 'image/png';
    const buffer =
      options.photo === 'invalid'
        ? Buffer.from('ini bukan gambar sama sekali')
        : options.photo === 'large'
          ? Buffer.alloc(6 * 1024 * 1024, 0x89)
          : PNG;
    form.append('photo', new Blob([buffer], { type: mime }), 'selfie.png');
  }

  form.append('latitude', String(options.latitude ?? -6.2088));
  form.append('longitude', String(options.longitude ?? 106.8456));
  form.append('accuracy', String(options.accuracy ?? 8));
  form.append('mocked', String(options.mocked ?? false));
  form.append('shiftId', options.shiftId);

  return request(path, { method: 'POST', headers: auth(token), body: form });
}

const adminLogin = await login('admin@clockin.test', 'Admin123!');
check('Login admin → 200', adminLogin.status === 200);
const adminToken = adminLogin.body?.accessToken;

const officeList = await request('/office-locations', { headers: auth(adminToken) });
const office = officeList.body?.data?.find((item) => item.isActive);
check('Lokasi aktif tersedia', Boolean(office));

const shiftList = await request('/shifts', { headers: auth(adminToken) });
const shifts = shiftList.body?.data ?? [];
const minutes = localMinutes(office.timezone);
const activeShift = shifts.find((shift) => isWithinWindow(shift, minutes));
check('Ada shift yang mencakup waktu sekarang', Boolean(activeShift), activeShift?.name);

const email = `absen.${suffix}@clockin.test`;
const employeeNumber = `EMP-ABS-${suffix}`;
const password = 'Karyawan123!';

const created = await request(
  '/employees',
  json(
    'POST',
    {
      email,
      password,
      employeeNumber,
      fullName: 'Karyawan Absensi Uji',
      officeLocationId: office.id,
    },
    adminToken,
  ),
);
check('Buat karyawan uji → 201', created.status === 201);
const employeeId = created.body?.employee?.id;

const employeeLogin = await login(email, password, `absen-device-${suffix}`);
check('Login karyawan uji → 200', employeeLogin.status === 200);
const token = employeeLogin.body?.accessToken;

const base = {
  shiftId: activeShift.id,
  latitude: Number(office.latitude),
  longitude: Number(office.longitude),
  accuracy: 8,
};

check(
  'Clock-In tanpa token → 401',
  (await clock('/attendance/clock-in', null, { ...base, photo: 'png' })).status === 401,
);

const noPhoto = await clock('/attendance/clock-in', token, { ...base, photo: 'none' });
check('Clock-In tanpa foto → 400', noPhoto.status === 400);

const invalidPhoto = await clock('/attendance/clock-in', token, { ...base, photo: 'invalid' });
check('File bukan gambar → 400', invalidPhoto.status === 400);

const mock = await clock('/attendance/clock-in', token, {
  ...base,
  photo: 'png',
  mocked: true,
});
check(
  'Mock location → 422 MOCK_LOCATION',
  mock.status === 422 && mock.body?.error?.code === 'MOCK_LOCATION',
);

const lowAccuracy = await clock('/attendance/clock-in', token, {
  ...base,
  photo: 'png',
  accuracy: 150,
});
check(
  'Akurasi buruk → 422 LOW_ACCURACY',
  lowAccuracy.status === 422 && lowAccuracy.body?.error?.code === 'LOW_ACCURACY',
);

const outOfRange = await clock('/attendance/clock-in', token, {
  ...base,
  photo: 'png',
  latitude: Number(office.latitude) - 0.009,
});
check(
  'Di luar radius → 422 OUT_OF_RANGE',
  outOfRange.status === 422 && outOfRange.body?.error?.code === 'OUT_OF_RANGE',
);

const invalidShift = await clock('/attendance/clock-in', token, {
  ...base,
  photo: 'png',
  shiftId: '00000000-0000-4000-8000-000000000000',
});
check(
  'Shift tidak dikenal → 422 INVALID_SHIFT',
  invalidShift.status === 422 && invalidShift.body?.error?.code === 'INVALID_SHIFT',
);

const oversized = await clock('/attendance/clock-in', token, {
  ...base,
  photo: 'large',
});
check('Foto melebihi batas → 413', oversized.status === 413);

const clockIn = await clock('/attendance/clock-in', token, { ...base, photo: 'png' });
check('Clock-In sah → 201', clockIn.status === 201);
const attendanceId = clockIn.body?.attendance?.id;
const workDate = clockIn.body?.attendance?.workDate;
check('Status hadir/terlambat sesuai aturan', ['PRESENT', 'LATE'].includes(clockIn.body?.attendance?.status));
check(
  'Jarak server-side wajar',
  typeof clockIn.body?.distanceMeters === 'number' &&
    clockIn.body.distanceMeters <= office.radiusMeters,
);
check('Respons memuat serverTime', typeof clockIn.body?.serverTime === 'string');

const duplicate = await clock('/attendance/clock-in', token, { ...base, photo: 'png' });
check(
  'Clock-In ganda → 409 ALREADY_CLOCKED_IN',
  duplicate.status === 409 && duplicate.body?.error?.code === 'ALREADY_CLOCKED_IN',
);

const history = await request('/attendance/me', { headers: auth(token) });
check(
  'Riwayat karyawan memuat record',
  history.status === 200 && history.body?.data?.some((row) => row.id === attendanceId),
);

const adminList = await request(
  `/attendance?employeeId=${employeeId}&date=${workDate}`,
  { headers: auth(adminToken) },
);
check(
  'Admin melihat absensi karyawan',
  adminList.status === 200 && adminList.body?.data?.some((row) => row.id === attendanceId),
);

check(
  'Karyawan dilarang mengakses daftar admin → 403',
  (await request('/attendance', { headers: auth(token) })).status === 403,
);

const ownerDetail = await request(`/attendance/${attendanceId}`, { headers: auth(token) });
check('Detail milik sendiri → 200', ownerDetail.status === 200);

const otherEmail = `absen.other.${suffix}@clockin.test`;
const otherEmployee = await request(
  '/employees',
  json(
    'POST',
    {
      email: otherEmail,
      password,
      employeeNumber: `EMP-OTHER-${suffix}`,
      fullName: 'Karyawan Lain Uji',
      officeLocationId: office.id,
    },
    adminToken,
  ),
);
check('Buat karyawan pembanding → 201', otherEmployee.status === 201);

const otherLogin = await login(
  otherEmail,
  password,
  `absen-other-device-${suffix}`,
);
check('Login karyawan pembanding → 200', otherLogin.status === 200);
const otherToken = otherLogin.body?.accessToken;

const otherDetail = await request(`/attendance/${attendanceId}`, {
  headers: auth(otherToken),
});
check('Detail milik orang lain → 404', otherDetail.status === 404);

const photoResponse = await fetch(`${BASE}/attendance/${attendanceId}/photo?type=in`, {
  headers: auth(token),
});
const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
check(
  'Foto milik sendiri dapat diunduh',
  photoResponse.status === 200 &&
    photoResponse.headers.get('content-type') === 'image/png' &&
    photoBuffer.length > 0,
);

const otherPhoto = await fetch(`${BASE}/attendance/${attendanceId}/photo?type=in`, {
  headers: auth(otherToken),
});
check('Foto milik orang lain → 404', otherPhoto.status === 404);

const clockOut = await clock('/attendance/clock-out', token, { ...base, photo: 'png' });
check('Clock-Out sah → 200', clockOut.status === 200 && Boolean(clockOut.body?.attendance?.clockOut));

const duplicateOut = await clock('/attendance/clock-out', token, { ...base, photo: 'png' });
check(
  'Clock-Out ganda → 409 ALREADY_CLOCKED_OUT',
  duplicateOut.status === 409 && duplicateOut.body?.error?.code === 'ALREADY_CLOCKED_OUT',
);

const tempStart = formatMinutes(minutes - 60);
const tempEnd = formatMinutes(minutes + 60);
const tempShift = await request(
  '/shifts',
  json(
    'POST',
    { name: `Shift Temp ${suffix}`, startTime: tempStart, endTime: tempEnd, isActive: true },
    adminToken,
  ),
);
check('Buat shift sementara → 201', tempShift.status === 201);

const withoutClockIn = await clock('/attendance/clock-out', token, {
  ...base,
  photo: 'png',
  shiftId: tempShift.body?.shift?.id,
});
check(
  'Clock-Out tanpa Clock-In → 409 NOT_CLOCKED_IN',
  withoutClockIn.status === 409 && withoutClockIn.body?.error?.code === 'NOT_CLOCKED_IN',
);

await request(
  `/shifts/${tempShift.body?.shift?.id}`,
  json('PATCH', { isActive: false }, adminToken),
);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);

if (failed.length > 0) {
  process.exitCode = 1;
}
