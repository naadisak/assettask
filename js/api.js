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

  // [uploadImage ย้ายไปใช้ smart upload ด้านล่างแล้ว]

  // ── Cloudinary upload (alternative to imgbb — ไม่หมดอายุ) ─────
  // วิธีใช้: เปลี่ยน CONFIG.IMAGE_PROVIDER = 'cloudinary' + ใส่ค่าใน config.js
  async function uploadImageCloudinary(file) {
    const formData = new FormData();
    formData.append('file',           file);
    formData.append('upload_preset',  CONFIG.CLOUDINARY_PRESET); // unsigned preset
    const res  = await fetch(
      `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD}/image/upload`,
      { method: 'POST', body: formData }
    );
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return {
      url:       json.secure_url,          // https://res.cloudinary.com/...
      thumb_url: json.secure_url.replace('/upload/', '/upload/w_400,q_auto/'),
    };
  }

  // ── Smart upload — เลือก provider จาก config ─────────────────
  async function uploadImage(file) {
    if (CONFIG.IMAGE_PROVIDER === 'cloudinary') {
      return uploadImageCloudinary(file);
    }
    // default: imgbb
    const formData = new FormData();
    formData.append('key',        CONFIG.IMGBB_KEY);
    formData.append('image',      file);
    formData.append('expiration', '0');
    const res  = await fetch(CONFIG.IMGBB_URL, { method: 'POST', body: formData });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Upload failed');
    const imgUrl = json.data.display_url || json.data.url || '';
    return { url: imgUrl, thumb_url: json.data.thumb?.url || imgUrl };
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
