const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const suffix = Date.now().toString(36);

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
        ? { deviceIdentifier, platform: 'android', deviceName: 'Smoke Test' }
        : { platform: 'web' }),
    }),
  );
}

const adminLogin = await login('admin@clockin.test', 'Admin123!');
check('Login admin → 200', adminLogin.status === 200);
const adminToken = adminLogin.body?.accessToken;

const budiLogin = await login('budi@clockin.test', 'Employee123!', 'device-budi-001');
check('Login karyawan seeded → 200', budiLogin.status === 200);
const employeeToken = budiLogin.body?.accessToken;
const budiEmployeeId = budiLogin.body?.user?.employee?.id;

check('GET /employees tanpa token → 401', (await request('/employees')).status === 401);
check(
  'GET /employees dengan token karyawan → 403',
  (await request('/employees', { headers: auth(employeeToken) })).status === 403,
);
check(
  'POST /office-locations dengan token karyawan → 403',
  (await request('/office-locations', json('POST', {}, employeeToken))).status === 403,
);
check(
  'PATCH /employees/:id dengan token karyawan → 403',
  (await request(`/employees/${budiEmployeeId}`, json('PATCH', { fullName: 'X' }, employeeToken))).status === 403,
);
check(
  'GET /employees/me karyawan → 200',
  (await request('/employees/me', { headers: auth(employeeToken) })).status === 200,
);
const myDevices = await request('/devices/me', { headers: auth(employeeToken) });
check('GET /devices/me karyawan → 200', myDevices.status === 200 && Array.isArray(myDevices.body?.devices));

const officeList = await request('/office-locations', { headers: auth(adminToken) });
check('GET /office-locations → 200', officeList.status === 200 && Array.isArray(officeList.body?.data));
const activeOffice = officeList.body?.data?.find((office) => office.isActive);
check('Ada satu lokasi aktif', Boolean(activeOffice));

const officeUpdate = await request(
  `/office-locations/${activeOffice.id}`,
  json('PATCH', { radiusMeters: 60 }, adminToken),
);
check('PATCH radius kantor → 200/60', officeUpdate.status === 200 && officeUpdate.body?.office?.radiusMeters === 60);

const invalidRadius = await request(
  `/office-locations/${activeOffice.id}`,
  json('PATCH', { radiusMeters: 5 }, adminToken),
);
check('Radius tidak valid → 400', invalidRadius.status === 400);

const invalidTimezone = await request(
  `/office-locations/${activeOffice.id}`,
  json('PATCH', { timezone: 'Mars/Olympus' }, adminToken),
);
check('Zona waktu tidak valid → 400', invalidTimezone.status === 400);

const officeRestore = await request(
  `/office-locations/${activeOffice.id}`,
  json('PATCH', { radiusMeters: 50 }, adminToken),
);
check('Radius dikembalikan ke 50', officeRestore.body?.office?.radiusMeters === 50);

const shiftName = `Shift Uji ${suffix}`;
const shiftCreate = await request(
  '/shifts',
  json('POST', { name: shiftName, startTime: '06:00', endTime: '14:00' }, adminToken),
);
check('POST /shifts → 201', shiftCreate.status === 201);
const shiftId = shiftCreate.body?.shift?.id;
check('Shift siang bukan lintas tengah malam', shiftCreate.body?.shift?.crossesMidnight === false);

const shiftPatch = await request(
  `/shifts/${shiftId}`,
  json('PATCH', { startTime: '23:00', endTime: '07:00' }, adminToken),
);
check('PATCH shift menjadi lintas tengah malam', shiftPatch.status === 200 && shiftPatch.body?.shift?.crossesMidnight === true);

const shiftDuplicate = await request(
  '/shifts',
  json('POST', { name: shiftName, startTime: '08:00', endTime: '16:00' }, adminToken),
);
check('Nama shift duplikat → 409', shiftDuplicate.status === 409 && shiftDuplicate.body?.error?.code === 'SHIFT_NAME_TAKEN');

check(
  'POST /shifts dengan token karyawan → 403',
  (await request('/shifts', json('POST', { name: `X ${suffix}`, startTime: '08:00', endTime: '16:00' }, employeeToken))).status === 403,
);

const shiftDeactivate = await request(
  `/shifts/${shiftId}`,
  json('PATCH', { isActive: false }, adminToken),
);
check('PATCH isActive shift → 200', shiftDeactivate.status === 200 && shiftDeactivate.body?.shift?.isActive === false);

const employeeShifts = await request('/shifts', { headers: auth(employeeToken) });
check(
  'Karyawan tidak melihat shift nonaktif',
  employeeShifts.status === 200 && !employeeShifts.body?.data?.some((shift) => shift.id === shiftId),
);

const newEmployeeEmail = `uji.${suffix}@clockin.test`;
const newEmployeeNumber = `EMP-UJI-${suffix}`;
const newPassword = 'Karyawan123!';

const createEmployee = await request(
  '/employees',
  json(
    'POST',
    {
      email: newEmployeeEmail,
      password: newPassword,
      employeeNumber: newEmployeeNumber,
      fullName: 'Karyawan Uji',
      department: 'QA',
      officeLocationId: activeOffice.id,
    },
    adminToken,
  ),
);
check('POST /employees → 201', createEmployee.status === 201);
const newEmployeeId = createEmployee.body?.employee?.id;
check('Email karyawan tidak bocor sebagai hash', !JSON.stringify(createEmployee.body).includes('passwordHash'));

const duplicateEmail = await request(
  '/employees',
  json(
    'POST',
    { email: newEmployeeEmail, password: newPassword, employeeNumber: `EMP-LAIN-${suffix}`, fullName: 'Duplikat Email' },
    adminToken,
  ),
);
check('Email duplikat → 409 EMAIL_TAKEN', duplicateEmail.status === 409 && duplicateEmail.body?.error?.code === 'EMAIL_TAKEN');

const duplicateNumber = await request(
  '/employees',
  json(
    'POST',
    { email: `lain.${suffix}@clockin.test`, password: newPassword, employeeNumber: newEmployeeNumber, fullName: 'Duplikat Nomor' },
    adminToken,
  ),
);
check(
  'Nomor karyawan duplikat → 409 EMPLOYEE_NUMBER_TAKEN',
  duplicateNumber.status === 409 && duplicateNumber.body?.error?.code === 'EMPLOYEE_NUMBER_TAKEN',
);

const weakPassword = await request(
  '/employees',
  json(
    'POST',
    { email: `lemah.${suffix}@clockin.test`, password: '123', employeeNumber: `EMP-LEMAH-${suffix}`, fullName: 'Password Lemah' },
    adminToken,
  ),
);
check('Password lemah → 400', weakPassword.status === 400);

const unknownOffice = await request(
  '/employees',
  json(
    'POST',
    {
      email: `office.${suffix}@clockin.test`,
      password: newPassword,
      employeeNumber: `EMP-OFFICE-${suffix}`,
      fullName: 'Office Salah',
      officeLocationId: '00000000-0000-4000-8000-000000000000',
    },
    adminToken,
  ),
);
check('officeLocationId tidak ditemukan → 400', unknownOffice.status === 400);

const employeeDetail = await request(`/employees/${newEmployeeId}`, { headers: auth(adminToken) });
check('GET /employees/:id → 200', employeeDetail.status === 200);

const employeeSearch = await request(`/employees?q=${newEmployeeNumber}`, { headers: auth(adminToken) });
check(
  'GET /employees?q= → menemukan karyawan baru',
  employeeSearch.status === 200 && employeeSearch.body?.meta?.total === 1,
);

const updateEmployee = await request(
  `/employees/${newEmployeeId}`,
  json('PATCH', { fullName: 'Karyawan Uji Diperbarui', position: 'QA Engineer' }, adminToken),
);
check(
  'PATCH /employees/:id → 200',
  updateEmployee.status === 200 && updateEmployee.body?.employee?.fullName === 'Karyawan Uji Diperbarui',
);

check(
  'GET /employees/me sebagai admin → 404',
  (await request('/employees/me', { headers: auth(adminToken) })).status === 404,
);

const newEmployeeLogin = await login(newEmployeeEmail, newPassword, `uji-device-${suffix}`);
check('Login karyawan baru → 200 dan perangkat terdaftar', newEmployeeLogin.status === 200 && newEmployeeLogin.body?.device?.status === 'ACTIVE');

const resetDevice = await request(`/employees/${newEmployeeId}/reset-device`, json('POST', {}, adminToken));
check('Reset perangkat → revokedDevices 1', resetDevice.status === 200 && resetDevice.body?.revokedDevices === 1);

const reloginAfterReset = await login(newEmployeeEmail, newPassword, `uji-device-${suffix}`);
check('Login ulang setelah reset perangkat → 200', reloginAfterReset.status === 200);

const resetPassword = await request(`/employees/${newEmployeeId}/reset-password`, json('POST', { newPassword: 'Baru12345!' }, adminToken));
check('Reset password → 204', resetPassword.status === 204);

const oldPasswordLogin = await login(newEmployeeEmail, newPassword, `uji-device-${suffix}`);
check('Password lama setelah reset → 401', oldPasswordLogin.status === 401);

const newPasswordLogin = await login(newEmployeeEmail, 'Baru12345!', `uji-device-${suffix}`);
check('Password baru setelah reset → 200', newPasswordLogin.status === 200);

const deactivate = await request(`/employees/${newEmployeeId}/status`, json('PATCH', { isActive: false }, adminToken));
check('Nonaktifkan karyawan → 200', deactivate.status === 200 && deactivate.body?.employee?.isActive === false);

const inactiveLogin = await login(newEmployeeEmail, 'Baru12345!', `uji-device-${suffix}`);
check('Login akun nonaktif → 403 FORBIDDEN', inactiveLogin.status === 403 && inactiveLogin.body?.error?.code === 'FORBIDDEN');

const reactivate = await request(`/employees/${newEmployeeId}/status`, json('PATCH', { isActive: true }, adminToken));
check('Aktifkan kembali karyawan → 200', reactivate.status === 200 && reactivate.body?.employee?.isActive === true);

const activeLogin = await login(newEmployeeEmail, 'Baru12345!', `uji-device-${suffix}`);
check('Login setelah aktif kembali → 200', activeLogin.status === 200);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);

if (failed.length > 0) {
  process.exitCode = 1;
}
