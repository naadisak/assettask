/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — js/api.js
 *  ใช้ GET ทุก request เพื่อแก้ CORS กับ Google Apps Script
 * ============================================================
 */

const API = (() => {
  const getToken   = ()  => localStorage.getItem(CONFIG.SESSION_KEY) || '';
  const setToken   = (t) => localStorage.setItem(CONFIG.SESSION_KEY, t);
  const clearToken = ()  => localStorage.removeItem(CONFIG.SESSION_KEY);
  const isLoggedIn = ()  => !!getToken();

  // ── Core: ทุก request ใช้ GET + ส่ง data เป็น JSON ใน param ──
  async function request(action, data = {}) {
    const payload = {
      action,
      token:  getToken(),
      data:   JSON.stringify(data),
    };

    const qs  = new URLSearchParams(payload).toString();
    const url = `${CONFIG.GAS_URL}?${qs}`;

    try {
      const res  = await fetch(url, { redirect: 'follow' });
      const json = await res.json();

      if (!json.success) {
        if (json.code === 401) {
          clearToken();
          window.location.href = 'login.html';
          return null;
        }
        throw new Error(json.error || 'Request failed');
      }
      return json;

    } catch (err) {
      console.error(`[API] ${action}:`, err);
      throw err;
    }
  }

  // ── Auth ────────────────────────────────────────────────────
  async function login(employee_id, pin) {
    const res = await request('login', { employee_id, pin });
    if (res) { setToken(res.token); return res; }
  }

  function logout() { clearToken(); window.location.href = 'login.html'; }
  async function changePin(pin)  { return request('change_pin', { pin }); }
  async function me()            { return request('me'); }

  // ── Lookups ─────────────────────────────────────────────────
  async function getDepartments()      { const r = await request('get_departments'); return r?.departments || []; }
  async function getSettings(category){ const r = await request('get_settings', { category }); return r?.settings || []; }

  // ── Records ─────────────────────────────────────────────────
  async function getRecords(filters = {}) { const r = await request('get_records', filters); return r?.records || []; }
  async function saveRecord(data)         { return request('save_record', data); }
  async function updateRecord(data)       { return request('update_record', data); }


  // ── Image Upload — Google Drive via GAS (ไม่หมดอายุ 100%) ─────
  async function uploadImage(file) {
    // ตรวจสอบขนาด ≤ 5MB
    if (file.size > 5 * 1024 * 1024) throw new Error('ขนาดไฟล์ต้องไม่เกิน 5MB');

    // แปลงเป็น base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'));
      reader.readAsDataURL(file);
    });

    // ส่งไป GAS → อัปโหลดขึ้น Google Drive
    const res = await request('upload_image', {
      base64:   base64,
      filename: file.name,
      mimeType: file.type,
    });

    if (!res) throw new Error('อัปโหลดไม่สำเร็จ');
    return { url: res.url, thumb_url: res.thumb_url };
  }

  // ── Admin ────────────────────────────────────────────────────
  async function getUsers()           { const r = await request('get_users');        return r?.users    || []; }
  async function saveUser(data)       { return request('save_user',    data); }
  async function updateUser(data)     { return request('update_user',  data); }
  async function saveSetting(data)    { return request('save_setting', data); }
  async function updateSetting(data)  { return request('update_setting', data); }
  async function getStats()           { return request('get_stats'); }
  async function updateAvatar(avatar_url) { return request('update_avatar', { avatar_url }); }

  // ── Guard ────────────────────────────────────────────────────
  function requireLogin() {
    if (!isLoggedIn()) { window.location.href = 'login.html'; return false; }
    return true;
  }

  return {
    login, logout, changePin, me, isLoggedIn,
    getDepartments, getSettings,
    getRecords, saveRecord, updateRecord,
    uploadImage,
    getUsers, saveUser, updateUser,
    saveSetting, updateSetting, getStats,
    updateAvatar, requireLogin, clearToken,
  };
})();
