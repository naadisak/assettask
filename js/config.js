const CONFIG = {
  // ── Google Apps Script ──────────────────────────────────────
  GAS_URL: 'https://script.google.com/macros/s/AKfycbztzcbmC5z18LhYchAGtFgaHr-6feOps58nI0IACUVq9LzJhFEF9DGQlbjF1nfqUJMvAQ/exec',

  // ── Session ─────────────────────────────────────────────────
  SESSION_KEY: 'assetsys_7769',

  // ── App ─────────────────────────────────────────────────────
  NOTE_EMOJIS:     ['✅', '⚠️', '🔧', '💻', '🚫', '🎉', '👍', '❌', '🔄', '📝'],
  APP_NAME:        'AssetSys',
  LINE_CHANNEL_ID: '',   // ← LINE Channel ID (optional)
};
// หมายเหตุ: รูปภาพอัปโหลดผ่าน Google Drive (ไม่หมดอายุ)
// GAS จะสร้าง folder "AssetSys_Images" ใน Drive ของ account ที่ deploy อัตโนมัติ
