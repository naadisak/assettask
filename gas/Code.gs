/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — Code.gs
 *  Google Apps Script Web App (Backend API)
 *  วิธี Deploy: Extensions → Apps Script → Deploy → Web App
 *               Execute as: Me | Who has access: Anyone
 * ============================================================
 */

const SPREADSHEET_ID = '1PJbsnOWp_OBFAmgft6lVyn4G0ta__pp7gngaDyUNS3g';
const SHEET = {
  RECORDS:     'records',
  USERS:       'users',
  SETTINGS:    'settings',
  DEPARTMENTS: 'departments',
};

const COL = {
  RECORDS:     ['id','timestamp','department','computer_name','ext','current_os','current_os_detail','up2_os','up2_os_detail','status','it_agent','note','image1_url','image2_url','emoji','created_by','created_at'],
  USERS:       ['id','employee_id','first_name','last_name','email','phone_ext','role','password_hash','avatar_url','line_user_id','status','must_change_pw','token','created_at'],
  SETTINGS:    ['id','category','value','label','sort_order','active'],
  DEPARTMENTS: ['id','name','created_at'],
};

// ── CORS Headers ─────────────────────────────────────────────
function setCORS(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(data = {}) {
  return setCORS(ContentService.createTextOutput(
    JSON.stringify({ success: true, ...data })
  ));
}

function fail(message, code = 400) {
  return setCORS(ContentService.createTextOutput(
    JSON.stringify({ success: false, error: message, code })
  ));
}

// ── Entry Points ─────────────────────────────────────────────
function doGet(e)  { return route(e); }
function doPost(e) { return route(e); }

function route(e) {
  try {
    const action = e.parameter?.action || '';
    const body   = e.postData?.contents ? JSON.parse(e.postData.contents) : {};
    const params = { ...e.parameter, ...body };

    // Public
    if (action === 'login')        return handleLogin(params);
    if (action === 'init')         return handleInit();

    // Protected — ต้องมี token
    const user = validateToken(params.token);
    if (!user) return fail('Unauthorized', 401);

    // User actions
    if (action === 'me')                return ok({ user: safeUser(user) });
    if (action === 'change_pin')        return handleChangePin(params, user);
    if (action === 'update_avatar')     return handleUpdateAvatar(params, user);
    if (action === 'get_departments')   return ok({ departments: getDepartments() });
    if (action === 'get_settings')      return ok({ settings: getSettings(params.category) });
    if (action === 'get_records')       return handleGetRecords(params, user);
    if (action === 'save_record')       return handleSaveRecord(params, user);
    if (action === 'update_record')     return handleUpdateRecord(params, user);

    // Admin only
    requireAdmin(user);
    if (action === 'get_users')         return ok({ users: getUsers() });
    if (action === 'save_user')         return handleSaveUser(params);
    if (action === 'update_user')       return handleUpdateUser(params);
    if (action === 'save_setting')      return handleSaveSetting(params);
    if (action === 'update_setting')    return handleUpdateSetting(params);
    if (action === 'get_stats')         return handleGetStats();

    return fail(`Unknown action: ${action}`, 404);

  } catch (err) {
    return fail('Server error: ' + err.message, 500);
  }
}

// ═══════════════════════════════════════════════════════════
//  SHEET HELPERS
// ═══════════════════════════════════════════════════════════

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(name);
}

function getRows(sheetName, cols) {
  const sh   = getSheet(sheetName);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = String(row[i] ?? ''));
    return obj;
  });
}

function appendRow(sheetName, values) {
  getSheet(sheetName).appendRow(values);
}

function updateRowById(sheetName, cols, id, updates) {
  const sh   = getSheet(sheetName);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      const current = {};
      cols.forEach((c, idx) => current[c] = data[i][idx]);
      const updated  = { ...current, ...updates };
      const newRow   = cols.map(c => updated[c] ?? '');
      sh.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return true;
    }
  }
  return false;
}

function findRow(sheetName, cols, key, val) {
  return getRows(sheetName, cols).find(r => r[key] === val) || null;
}

function generateId() {
  const d  = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return ymd + Math.random().toString(36).substr(2,5).toUpperCase();
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════

function handleLogin(p) {
  const empId = (p.employee_id || '').trim();
  const pin   = (p.pin || '').trim();
  if (!empId || !pin) return fail('กรุณากรอกข้อมูลให้ครบ');

  const user = findRow(SHEET.USERS, COL.USERS, 'employee_id', empId);
  if (!user)                    return fail('ไม่พบรหัสพนักงาน');
  if (user.status !== 'active') return fail('บัญชีนี้ถูกระงับการใช้งาน');

  // First login: PIN = phone_ext
  if (user.must_change_pw === '1') {
    if (pin !== user.phone_ext) return fail('รหัสผ่านไม่ถูกต้อง');
  } else {
    if (!verifyPin(pin, user.password_hash)) return fail('รหัสผ่านไม่ถูกต้อง');
  }

  // Generate token + save
  const token = Utilities.getUuid();
  updateRowById(SHEET.USERS, COL.USERS, user.id, { token });

  return ok({
    token,
    must_change_pw: user.must_change_pw === '1',
    user: safeUser({ ...user, token }),
  });
}

function validateToken(token) {
  if (!token) return null;
  const user = findRow(SHEET.USERS, COL.USERS, 'token', token);
  if (!user || user.status !== 'active') return null;
  return user;
}

function handleChangePin(p, user) {
  const pin = (p.pin || '').trim();
  if (!/^\d{6}$/.test(pin)) return fail('PIN ต้องเป็นตัวเลข 6 หลัก');
  const hash = hashPin(pin);
  updateRowById(SHEET.USERS, COL.USERS, user.id, {
    password_hash: hash,
    must_change_pw: '0',
  });
  return ok();
}

function hashPin(pin) {
  // ใช้ SHA-256 + salt (GAS ไม่มี bcrypt — ใช้ Utilities.computeDigest)
  const salt    = Utilities.getUuid().substr(0, 8);
  const digest  = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + pin
  );
  const hex = digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,'0')).join('');
  return `${salt}:${hex}`;
}

function verifyPin(pin, hash) {
  if (!hash || !hash.includes(':')) return false;
  const [salt, stored] = hash.split(':');
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + pin
  );
  const hex = digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,'0')).join('');
  return hex === stored;
}

function requireAdmin(user) {
  if (user.role !== 'admin') throw new Error('Access denied');
}

function safeUser(u) {
  const { password_hash, ...safe } = u;
  return safe;
}

// ═══════════════════════════════════════════════════════════
//  RECORDS
// ═══════════════════════════════════════════════════════════

function handleGetRecords(p, user) {
  let rows = getRows(SHEET.RECORDS, COL.RECORDS);
  // newest first
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // filter by department (admin feature)
  if (p.department) rows = rows.filter(r => r.department === p.department);
  if (p.status)     rows = rows.filter(r => r.status === p.status);
  if (p.date_from)  rows = rows.filter(r => r.created_at >= p.date_from);
  if (p.date_to)    rows = rows.filter(r => r.created_at <= p.date_to + ' 23:59:59');

  return ok({ records: rows });
}

function handleSaveRecord(p, user) {
  const required = ['department','computer_name','current_os','up2_os','status'];
  for (const f of required) {
    if (!p[f]) return fail(`กรุณากรอก: ${f}`);
  }

  // Auto-add department ถ้าใหม่
  const dept = (p.department || '').trim();
  const depts = getDepartments();
  if (!depts.includes(dept)) {
    appendRow(SHEET.DEPARTMENTS, [generateId(), dept, now()]);
  }

  const id  = generateId();
  const ts  = now();
  const row = [
    id, ts,
    dept,
    (p.computer_name || '').trim(),
    (p.ext || '').trim(),
    p.current_os || '',
    p.current_os_detail || '',
    p.up2_os || '',
    p.up2_os_detail || '',
    p.status || '',
    p.it_agent || user.employee_id,
    (p.note || '').substring(0, 50),
    p.image1_url || '',
    p.image2_url || '',
    p.emoji || '',
    user.employee_id,
    ts,
  ];

  appendRow(SHEET.RECORDS, row);
  return ok({ id });
}

function handleUpdateRecord(p, user) {
  const id = (p.id || '').trim();
  if (!id) return fail('ไม่พบ record ID');

  const record = findRow(SHEET.RECORDS, COL.RECORDS, 'id', id);
  if (!record) return fail('ไม่พบข้อมูล');

  // Permission: admin แก้ได้ทุก record, user แก้ได้เฉพาะของตัวเอง
  if (user.role !== 'admin' && record.created_by !== user.employee_id) {
    return fail('คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้', 403);
  }

  const updates = {};
  const editable = ['department','computer_name','ext','current_os','current_os_detail',
                    'up2_os','up2_os_detail','status','it_agent','note','image1_url','image2_url','emoji'];
  editable.forEach(f => { if (p[f] !== undefined) updates[f] = f === 'note' ? p[f].substring(0,50) : p[f]; });

  updateRowById(SHEET.RECORDS, COL.RECORDS, id, updates);
  return ok();
}

// ═══════════════════════════════════════════════════════════
//  SETTINGS & DEPARTMENTS
// ═══════════════════════════════════════════════════════════

function getSettings(category) {
  const rows = getRows(SHEET.SETTINGS, COL.SETTINGS);
  const filtered = category ? rows.filter(r => r.category === category && r.active === '1') : rows;
  return filtered.sort((a,b) => Number(a.sort_order) - Number(b.sort_order));
}

function getDepartments() {
  return getRows(SHEET.DEPARTMENTS, COL.DEPARTMENTS).map(r => r.name);
}

function handleSaveSetting(p) {
  if (!p.category || !p.value || !p.label) return fail('กรุณากรอกข้อมูลให้ครบ');
  appendRow(SHEET.SETTINGS, [
    generateId(), p.category, p.value, p.label, p.sort_order || '99', '1'
  ]);
  return ok();
}

function handleUpdateSetting(p) {
  if (!p.id) return fail('ไม่พบ ID');
  const updates = {};
  ['category','value','label','sort_order','active'].forEach(f => {
    if (p[f] !== undefined) updates[f] = p[f];
  });
  updateRowById(SHEET.SETTINGS, COL.SETTINGS, p.id, updates);
  return ok();
}

// ═══════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════

function getUsers() {
  return getRows(SHEET.USERS, COL.USERS).map(safeUser);
}

function handleSaveUser(p) {
  const required = ['employee_id','first_name','last_name','email','phone_ext','role'];
  for (const f of required) {
    if (!p[f]) return fail(`กรุณากรอก: ${f}`);
  }
  // check duplicate
  if (findRow(SHEET.USERS, COL.USERS, 'employee_id', p.employee_id)) {
    return fail('รหัสพนักงานนี้มีอยู่ในระบบแล้ว');
  }
  appendRow(SHEET.USERS, [
    generateId(),
    p.employee_id.trim(),
    p.first_name.trim(),
    p.last_name.trim(),
    p.email.trim(),
    p.phone_ext.trim(),
    p.role === 'admin' ? 'admin' : 'users',
    '',       // password_hash
    '',       // avatar_url
    '',       // line_user_id
    'active',
    '1',      // must_change_pw
    '',       // token
    now(),
  ]);
  return ok();
}

function handleUpdateUser(p) {
  if (!p.id) return fail('ไม่พบ ID');
  const updates = {};
  ['first_name','last_name','email','phone_ext','role','status','avatar_url'].forEach(f => {
    if (p[f] !== undefined) updates[f] = p[f];
  });
  updateRowById(SHEET.USERS, COL.USERS, p.id, updates);
  return ok();
}

function handleUpdateAvatar(p, user) {
  if (!p.avatar_url) return fail('ไม่พบ URL รูปภาพ');
  updateRowById(SHEET.USERS, COL.USERS, user.id, { avatar_url: p.avatar_url });
  return ok();
}

// ═══════════════════════════════════════════════════════════
//  STATS (Admin Dashboard)
// ═══════════════════════════════════════════════════════════

function handleGetStats() {
  const records = getRows(SHEET.RECORDS, COL.RECORDS);
  const users   = getRows(SHEET.USERS,   COL.USERS);

  // Total counts
  const total     = records.length;
  const byStatus  = {};
  const byAgent   = {};
  const byDept    = {};
  const byDay     = {};

  records.forEach(r => {
    // status
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    // agent
    byAgent[r.it_agent] = (byAgent[r.it_agent] || 0) + 1;
    // dept
    byDept[r.department] = (byDept[r.department] || 0) + 1;
    // daily trend (last 30 days)
    const day = r.created_at.substring(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });

  // KPI per agent with name lookup
  const userMap = {};
  users.forEach(u => userMap[u.employee_id] = `${u.first_name} ${u.last_name}`);

  const kpi = Object.entries(byAgent).map(([emp, count]) => ({
    employee_id: emp,
    name: userMap[emp] || emp,
    count,
  })).sort((a,b) => b.count - a.count);

  return ok({ total, byStatus, byDept, byDay, kpi });
}

// ═══════════════════════════════════════════════════════════
//  INIT (รันครั้งเดียว)
// ═══════════════════════════════════════════════════════════

function handleInit() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // สร้าง sheets + headers
  Object.entries(COL).forEach(([key, cols]) => {
    const name = SHEET[key];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(cols);
  });

  // Default settings
  const settingsSh = ss.getSheetByName(SHEET.SETTINGS);
  if (settingsSh.getLastRow() <= 1) {
    [
      [generateId(),'os','win10','Windows 10','1','1'],
      [generateId(),'os','win11','Windows 11','2','1'],
      [generateId(),'os','ubuntu16','Ubuntu 16','3','1'],
      [generateId(),'os','ubuntu20','Ubuntu 20.x','4','1'],
      [generateId(),'status','pass','Pass','1','1'],
      [generateId(),'status','doi','ด๋อย','2','1'],
      [generateId(),'status','reject_user','Reject by user','3','1'],
    ].forEach(r => settingsSh.appendRow(r));
  }

  // Default admin
  const usersSh = ss.getSheetByName(SHEET.USERS);
  if (usersSh.getLastRow() <= 1) {
    usersSh.appendRow([
      generateId(),'admin001','System','Admin',
      'admin@company.com','123456','admin',
      '','','','active','1','',now()
    ]);
  }

  return ok({ message: 'Init complete! ลบ ?action=init ออกหลังจากนี้' });
}
