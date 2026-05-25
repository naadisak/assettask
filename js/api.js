/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — js/api.js
 *  ใช้ GET ทุก request เพื่อแก้ CORS กับ Google Apps Script
 * ============================================================
 */

const API = (() => {
  const KEY = CONFIG.SESSION_KEY;
  // ── Token helpers ─────────────────────────────────────────
  const getToken   = ()  => localStorage.getItem(KEY) ||
                             sessionStorage.getItem(KEY) || '';
  const setToken   = (t) => {
    localStorage.setItem(KEY, t);
    sessionStorage.setItem(KEY, t);
    // backup ใน cookie (path=/) เพื่อกันกรณี localStorage ถูก clear
    try { document.cookie = `${KEY}=${t};path=/;max-age=31536000;SameSite=Lax`; } catch(_){}
  };
  const clearToken = ()  => {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    try { document.cookie = `${KEY}=;path=/;max-age=0`; } catch(_){}
  };
  // อ่าน token จาก cookie ด้วย (fallback)
  const getCookieToken = () => {
    try {
      const m = document.cookie.match(new RegExp(`(?:^|;\s*)${KEY}=([^;]+)`));
      return m ? m[1] : '';
    } catch(_){ return ''; }
  };
  const isLoggedIn = ()  => !!(getToken() || getCookieToken());
  // Restore จาก cookie ถ้า localStorage ว่าง
  (()=>{ if(!getToken()){const ck=getCookieToken();if(ck){localStorage.setItem(KEY,ck);sessionStorage.setItem(KEY,ck);}} })();

  // ── Core: ทุก request ใช้ GET + ส่ง data เป็น JSON ใน param ──
  async function request(action, data = {}) {
    const payload = {
      action,
      token:  getToken() || getCookieToken(),
      data:   JSON.stringify(data),
    };

    const qs  = new URLSearchParams(payload).toString();
    const url = `${CONFIG.GAS_URL}?${qs}`;

    try {
      const res  = await fetch(url, { redirect: 'follow' });
      const json = await res.json();

      if (!json.success) {
        if (json.code === 401) {
          // ลอง restore จาก cookie หรือ sessionStorage ก่อน redirect
          const backup = getCookieToken() || sessionStorage.getItem(KEY) || '';
          if (backup && backup !== localStorage.getItem(KEY)) {
            localStorage.setItem(KEY, backup);
            // Retry once
            try {
              const retryQs = new URLSearchParams({...Object.fromEntries(new URLSearchParams(url.split('?')[1]||'')), token: backup}).toString();
              const retryUrl = CONFIG.GAS_URL + '?' + retryQs;
              const r2 = await fetch(retryUrl, { redirect:'follow' });
              const j2 = await r2.json();
              if (j2.success) return j2;
            } catch(_) {}
          }
          // ยังไม่ redirect ทันที — เก็บ current URL แล้วถามก่อน
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


  // ── Image Upload — imgbb (direct from browser, no GAS) ─────────
  // upload ตรงจาก browser ไป imgbb ไม่ผ่าน GAS
  // เพราะ base64 รูปใหญ่เกิน URL limit ที่ GAS รับได้
  async function uploadImage(file) {
    if (file.size > 10 * 1024 * 1024) throw new Error('ขนาดไฟล์ต้องไม่เกิน 10MB');

    const allowed = ['image/jpeg','image/jpg','image/png','image/gif','image/webp'];
    if (!allowed.includes(file.type)) throw new Error('รองรับเฉพาะ JPG, PNG, GIF, WEBP');

    const formData = new FormData();
    formData.append('key',        'b37889052f6fd7b7143ff017d07914df');
    formData.append('image',      file);
    formData.append('expiration', '0'); // 0 = ไม่หมดอายุ

    const res  = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body:   formData,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'อัปโหลดไม่สำเร็จ');

    // ใช้ image.url = direct link ที่เสถียรที่สุด
    const url = json.data?.image?.url || json.data?.display_url || json.data?.url;
    if (!url) throw new Error('ไม่ได้รับ URL จาก imgbb');

    return {
      url,
      thumb_url: json.data?.thumb?.url || url,
    };
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
    setToken, getToken,
    getDepartments, getSettings,
    getRecords, saveRecord, updateRecord,
    uploadImage,
    getNotify:   (since='') => request('get_notify', { since }),
    getHistory:  (p)         => request('get_history', p),
    getUsers, saveUser, updateUser,
    saveSetting, updateSetting, getStats,
    updateAvatar, requireLogin, clearToken,
  };
})();
