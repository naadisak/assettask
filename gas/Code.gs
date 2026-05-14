/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — Code.gs (Google Apps Script)
 *  ทุก request ใช้ GET → doGet รับ action + data param
 *  Deploy: Execute as Me | Anyone can access
 * ============================================================
 */

const SPREADSHEET_ID = '1PJbsnOWp_OBFAmgft6lVyn4G0ta__pp7gngaDyUNS3g';
const SHEET = { RECORDS:'records', USERS:'users', SETTINGS:'settings', DEPARTMENTS:'departments' };
const COL = {
  RECORDS:     ['id','timestamp','department','computer_name','ext','current_os','current_os_detail','up2_os','up2_os_detail','status','it_agent','note','image1_url','image2_url','emoji','created_by','created_at'],
  USERS:       ['id','employee_id','first_name','last_name','email','phone_ext','role','password_hash','avatar_url','line_user_id','status','must_change_pw','token','created_at'],
  SETTINGS:    ['id','category','value','label','sort_order','active'],
  DEPARTMENTS: ['id','name','created_at'],
};

// ── Response helpers ──────────────────────────────────────────
function ok(data={})  {
  return ContentService
    .createTextOutput(JSON.stringify({ success:true, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}
function fail(msg, c=400) {
  return ContentService
    .createTextOutput(JSON.stringify({ success:false, error:msg, code:c }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Entry point — รับทุก request ผ่าน GET ────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    // data param คือ JSON string จาก frontend
    const p = e.parameter.data ? JSON.parse(e.parameter.data) : {};
    p.action = action;
    p.token  = e.parameter.token || '';

    // Public endpoints
    if (action === 'login') return handleLogin(p);
    if (action === 'init')  return handleInit();

    // Protected — ต้องมี token
    const user = validateToken(p.token);
    if (!user) return fail('Unauthorized', 401);

    if (action === 'me')               return ok({ user: safeUser(user) });
    if (action === 'change_pin')       return handleChangePin(p, user);
    if (action === 'update_avatar')    return handleUpdateAvatar(p, user);
    if (action === 'get_departments')  return ok({ departments: getDepartments() });
    if (action === 'get_settings')     return ok({ settings: getSettings(p.category||'') });
    if (action === 'get_records')      return handleGetRecords(p, user);
    if (action === 'save_record')      return handleSaveRecord(p, user);
    if (action === 'update_record')    return handleUpdateRecord(p, user);

    // Admin only
    requireAdmin(user);
    if (action === 'get_users')        return ok({ users: getUsers() });
    if (action === 'save_user')        return handleSaveUser(p);
    if (action === 'update_user')      return handleUpdateUser(p);
    if (action === 'save_setting')     return handleSaveSetting(p);
    if (action === 'update_setting')   return handleUpdateSetting(p);
    if (action === 'get_stats')        return handleGetStats();

    return fail('Unknown action: ' + action, 404);

  } catch(err) {
    return fail('Server error: ' + err.message, 500);
  }
}

// doPost ไว้รองรับกรณีที่มีการ call โดยไม่ได้ตั้งใจ
function doPost(e) { return doGet(e); }

// ── Sheet Helpers ─────────────────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function getRows(sheet, cols) {
  const data = getSheet(sheet).getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    const obj = {};
    cols.forEach((c, i) => {
      const v = row[i];
      // Google Sheets อาจส่งค่า Date object แทน string → แปลงเป็น string เอง
      if (v instanceof Date) {
        obj[c] = isNaN(v.getTime()) ? '' :
          Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
      } else {
        obj[c] = String(v ?? '');
      }
    });
    return obj;
  });
}

function appendRow(sheet, values) { getSheet(sheet).appendRow(values); }

function updateRowById(sheet, cols, id, updates) {
  const sh   = getSheet(sheet);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      const cur = {};
      cols.forEach((c,idx) => cur[c] = data[i][idx]);
      const updated = cols.map(c => updates[c] !== undefined ? updates[c] : cur[c]);
      sh.getRange(i+1, 1, 1, updated.length).setValues([updated]);
      return true;
    }
  }
  return false;
}

function findRow(sheet, cols, key, val) {
  return getRows(sheet, cols).find(r => r[key] === val) || null;
}

function generateId() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${Math.random().toString(36).substr(2,5).toUpperCase()}`;
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

// ── AUTH ──────────────────────────────────────────────────────
function handleLogin(p) {
  const empId = (p.employee_id || '').trim();
  const pin   = (p.pin || '').trim();
  if (!empId || !pin) return fail('กรุณากรอกข้อมูลให้ครบ');

  const user = findRow(SHEET.USERS, COL.USERS, 'employee_id', empId);
  if (!user)                    return fail('ไม่พบรหัสพนักงาน');
  if (user.status !== 'active') return fail('บัญชีนี้ถูกระงับการใช้งาน');

  // ── ครั้งแรก: PIN = employee_id ──────────────────────────
  if (user.must_change_pw === '1') {
    if (pin !== user.employee_id) return fail('รหัสผ่านไม่ถูกต้อง (ใช้รหัสพนักงานเป็น PIN แรก)');
  } else {
    if (!verifyPin(pin, user.password_hash)) return fail('รหัสผ่านไม่ถูกต้อง');
  }

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
  return (user && user.status === 'active') ? user : null;
}

function handleChangePin(p, user) {
  const pin = (p.pin || '').trim();
  if (!/^\d{6}$/.test(pin)) return fail('PIN ต้องเป็นตัวเลข 6 หลัก');
  updateRowById(SHEET.USERS, COL.USERS, user.id, {
    password_hash: hashPin(pin),
    must_change_pw: '0',
  });
  return ok();
}

function hashPin(pin) {
  const salt   = Utilities.getUuid().substr(0,8);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pin);
  const hex    = digest.map(b => (b<0?b+256:b).toString(16).padStart(2,'0')).join('');
  return `${salt}:${hex}`;
}

function verifyPin(pin, hash) {
  if (!hash || !hash.includes(':')) return false;
  const [salt, stored] = hash.split(':');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pin);
  return digest.map(b => (b<0?b+256:b).toString(16).padStart(2,'0')).join('') === stored;
}

function requireAdmin(user) { if (user.role !== 'admin') throw new Error('Access denied'); }
function safeUser(u) { const {password_hash, ...safe} = u; return safe; }

// ── RECORDS ───────────────────────────────────────────────────
function handleGetRecords(p, user) {
  let rows = getRows(SHEET.RECORDS, COL.RECORDS);
  rows.sort((a,b) => b.created_at.localeCompare(a.created_at));
  if (p.department) rows = rows.filter(r => r.department === p.department);
  if (p.status)     rows = rows.filter(r => r.status     === p.status);
  if (p.date_from)  rows = rows.filter(r => r.created_at >= p.date_from);
  if (p.date_to)    rows = rows.filter(r => r.created_at <= p.date_to + ' 23:59:59');
  return ok({ records: rows });
}

function handleSaveRecord(p, user) {
  const req = ['department','computer_name','current_os','up2_os','status'];
  for (const f of req) { if (!p[f]) return fail('กรุณากรอก: ' + f); }

  const dept = (p.department||'').trim();
  if (!getDepartments().includes(dept)) {
    appendRow(SHEET.DEPARTMENTS, [generateId(), dept, now()]);
  }

  const id = generateId(), ts = now();
  appendRow(SHEET.RECORDS, [
    id, ts, dept,
    (p.computer_name||'').trim(),
    (p.ext||'').trim(),
    p.current_os||'',
    p.current_os_detail||'',
    p.up2_os||'',
    p.up2_os_detail||'',
    p.status||'',
    p.it_agent||user.employee_id,
    (p.note||'').substring(0,50),
    p.image1_url||'',
    p.image2_url||'',
    p.emoji||'',
    user.employee_id,
    ts,
  ]);
  return ok({ id });
}

function handleUpdateRecord(p, user) {
  const id = (p.id||'').trim();
  if (!id) return fail('ไม่พบ record ID');
  const record = findRow(SHEET.RECORDS, COL.RECORDS, 'id', id);
  if (!record) return fail('ไม่พบข้อมูล');
  if (user.role !== 'admin' && record.created_by !== user.employee_id) return fail('ไม่มีสิทธิ์', 403);
  const editable = ['department','computer_name','ext','current_os','current_os_detail','up2_os','up2_os_detail','status','it_agent','note','image1_url','image2_url','emoji'];
  const updates  = {};
  editable.forEach(f => { if (p[f]!==undefined) updates[f] = f==='note'?p[f].substring(0,50):p[f]; });
  updateRowById(SHEET.RECORDS, COL.RECORDS, id, updates);
  return ok();
}

// ── SETTINGS & DEPARTMENTS ────────────────────────────────────
function getSettings(category) {
  const rows     = getRows(SHEET.SETTINGS, COL.SETTINGS);
  const filtered = category
    ? rows.filter(r => r.category===category && r.active==='1')
    : rows.filter(r => r.active==='1');
  return filtered.sort((a,b) => Number(a.sort_order)-Number(b.sort_order));
}

function getDepartments() {
  return getRows(SHEET.DEPARTMENTS, COL.DEPARTMENTS).map(r => r.name);
}

function handleSaveSetting(p) {
  if (!p.category||!p.value||!p.label) return fail('กรุณากรอกข้อมูลให้ครบ');
  appendRow(SHEET.SETTINGS, [generateId(), p.category, p.value, p.label, p.sort_order||'99', '1']);
  return ok();
}

function handleUpdateSetting(p) {
  if (!p.id) return fail('ไม่พบ ID');
  const updates = {};
  ['category','value','label','sort_order','active'].forEach(f => { if(p[f]!==undefined) updates[f]=p[f]; });
  updateRowById(SHEET.SETTINGS, COL.SETTINGS, p.id, updates);
  return ok();
}

// ── USERS ─────────────────────────────────────────────────────
function getUsers() { return getRows(SHEET.USERS, COL.USERS).map(safeUser); }

function handleSaveUser(p) {
  const req = ['employee_id','first_name','last_name','email','phone_ext','role'];
  for (const f of req) { if (!p[f]) return fail('กรุณากรอก: ' + f); }
  if (findRow(SHEET.USERS, COL.USERS, 'employee_id', p.employee_id)) return fail('รหัสพนักงานนี้มีอยู่แล้ว');
  appendRow(SHEET.USERS, [
    generateId(), p.employee_id.trim(), p.first_name.trim(), p.last_name.trim(),
    p.email.trim(), p.phone_ext.trim(), p.role==='admin'?'admin':'users',
    '','','','active','1','',now()
  ]);
  return ok();
}

function handleUpdateUser(p) {
  if (!p.id) return fail('ไม่พบ ID');
  const updates = {};
  ['first_name','last_name','email','phone_ext','role','status','avatar_url'].forEach(f => {
    if (p[f]!==undefined) updates[f]=p[f];
  });
  updateRowById(SHEET.USERS, COL.USERS, p.id, updates);
  return ok();
}

function handleUpdateAvatar(p, user) {
  if (!p.avatar_url) return fail('ไม่พบ URL');
  updateRowById(SHEET.USERS, COL.USERS, user.id, { avatar_url: p.avatar_url });
  return ok();
}

// ── STATS ─────────────────────────────────────────────────────
function handleGetStats() {
  const records = getRows(SHEET.RECORDS, COL.RECORDS);
  const users   = getRows(SHEET.USERS,   COL.USERS);
  const byStatus={}, byAgent={}, byDept={}, byDay={};

  records.forEach(r => {
    byStatus[r.status]      = (byStatus[r.status]||0)+1;
    byAgent[r.it_agent]     = (byAgent[r.it_agent]||0)+1;
    byDept[r.department]    = (byDept[r.department]||0)+1;
    const day = r.created_at.substring(0,10);
    byDay[day] = (byDay[day]||0)+1;
  });

  const userMap = {};
  users.forEach(u => userMap[u.employee_id] = `${u.first_name} ${u.last_name}`);

  const kpi = Object.entries(byAgent)
    .map(([e,c]) => ({ employee_id:e, name:userMap[e]||e, count:c }))
    .sort((a,b) => b.count-a.count);

  return ok({ total:records.length, byStatus, byDept, byDay, kpi });
}

// ── INIT (รันครั้งเดียวผ่าน ?action=init) ────────────────────
function handleInit() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  Object.entries(COL).forEach(([key,cols]) => {
    const name = SHEET[key];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow()===0) sh.appendRow(cols);
  });

  const sets = ss.getSheetByName(SHEET.SETTINGS);
  if (sets.getLastRow() <= 1) {
    [
      ['os','win10','Windows 10','1'],
      ['os','win11','Windows 11','2'],
      ['os','ubuntu16','Ubuntu 16','3'],
      ['os','ubuntu20','Ubuntu 20.x','4'],
      ['status','pass','Pass','1'],
      ['status','doi','ด๋อย','2'],
      ['status','reject_user','Reject by user','3'],
    ].forEach(([cat,val,lbl,ord]) => sets.appendRow([generateId(),cat,val,lbl,ord,'1']));
  }

  const usrs = ss.getSheetByName(SHEET.USERS);
  if (usrs.getLastRow() <= 1) {
    // PIN แรก = employee_id ─────────────────────────────────────
    usrs.appendRow([
      generateId(),'admin001','System','Admin',
      'admin@company.com','123456','admin',
      '','','','active','1','',now()
    ]);
  }

  return ok({ message:'Init complete! Login: employee_id=admin001, PIN=admin001' });
}
