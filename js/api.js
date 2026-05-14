/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — js/api.js
 *  Core API client — wrapper ทุก call ไป Google Apps Script
 * ============================================================
 */

const API = (() => {

  // ── Token management ────────────────────────────────────────
  const getToken  = ()      => localStorage.getItem(CONFIG.SESSION_KEY) || '';
  const setToken  = (t)     => localStorage.setItem(CONFIG.SESSION_KEY, t);
  const clearToken= ()      => localStorage.removeItem(CONFIG.SESSION_KEY);
  const isLoggedIn= ()      => !!getToken();

  // ── Core request ────────────────────────────────────────────
  async function request(action, data = {}, method = 'POST') {
    const token = getToken();
    const payload = { action, token, ...data };

    try {
      let url     = CONFIG.GAS_URL;
      let options = { method: 'POST', redirect: 'follow' };

      if (method === 'GET') {
        const qs = new URLSearchParams(payload).toString();
        url      = `${CONFIG.GAS_URL}?${qs}`;
        options  = { method: 'GET', redirect: 'follow' };
      } else {
        options.headers = { 'Content-Type': 'text/plain' };
        options.body    = JSON.stringify(payload);
      }

      const res  = await fetch(url, options);
      const json = await res.json();

      if (!json.success) {
        // Token หมดอายุ → redirect login
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
    if (res) {
      setToken(res.token);
      return res;
    }
  }

  function logout() {
    clearToken();
    window.location.href = 'login.html';
  }

  async function changePin(pin) {
    return request('change_pin', { pin });
  }

  async function me() {
    return request('me', {}, 'GET');
  }

  // ── Lookups ─────────────────────────────────────────────────
  async function getDepartments() {
    const res = await request('get_departments', {}, 'GET');
    return res?.departments || [];
  }

  async function getSettings(category) {
    const res = await request('get_settings', { category }, 'GET');
    return res?.settings || [];
  }

  // ── Records ─────────────────────────────────────────────────
  async function getRecords(filters = {}) {
    const res = await request('get_records', filters, 'GET');
    return res?.records || [];
  }

  async function saveRecord(data) {
    return request('save_record', data);
  }

  async function updateRecord(data) {
    return request('update_record', data);
  }

  // ── Image Upload (imgbb — direct from browser) ──────────────
  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('key',   CONFIG.IMGBB_KEY);
    formData.append('image', file);

    const res = await fetch(CONFIG.IMGBB_URL, {
      method: 'POST',
      body:   formData,
    });
    const json = await res.json();

    if (!json.success) throw new Error(json.error?.message || 'Upload failed');
    return {
      url:        json.data.url,
      thumb_url:  json.data.thumb?.url || json.data.url,
      delete_url: json.data.delete_url,
    };
  }

  // ── Admin ────────────────────────────────────────────────────
  async function getUsers() {
    const res = await request('get_users', {}, 'GET');
    return res?.users || [];
  }

  async function saveUser(data) {
    return request('save_user', data);
  }

  async function updateUser(data) {
    return request('update_user', data);
  }

  async function saveSetting(data) {
    return request('save_setting', data);
  }

  async function updateSetting(data) {
    return request('update_setting', data);
  }

  async function getStats() {
    const res = await request('get_stats', {}, 'GET');
    return res || {};
  }

  async function updateAvatar(avatar_url) {
    return request('update_avatar', { avatar_url });
  }

  // ── Guard: ต้อง login ───────────────────────────────────────
  function requireLogin() {
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  // Public
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
