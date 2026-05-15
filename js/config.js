const CONFIG = {
  // ── Google Apps Script ──────────────────────────────────────
  GAS_URL: 'https://script.google.com/macros/s/AKfycbztzcbmC5z18LhYchAGtFgaHr-6feOps58nI0IACUVq9LzJhFEF9DGQlbjF1nfqUJMvAQ/exec',

  // ── Session ─────────────────────────────────────────────────
  SESSION_KEY: 'assetsys_7769',

  // ── Image Provider ──────────────────────────────────────────
  // เปลี่ยนเป็น 'cloudinary' ถ้าต้องการใช้ Cloudinary แทน imgbb
  IMAGE_PROVIDER: 'imgbb',   // 'imgbb' | 'cloudinary'

  // imgbb (ปัจจุบัน)
  IMGBB_KEY: 'b37889052f6fd7b7143ff017d07914df',
  IMGBB_URL: 'https://api.imgbb.com/1/upload',

  // Cloudinary (สำรอง — กรอกเมื่อสมัครแล้ว)
  CLOUDINARY_CLOUD:  '',     // ← cloud name จาก cloudinary.com/console
  CLOUDINARY_PRESET: '',     // ← unsigned upload preset

  // ── App ─────────────────────────────────────────────────────
  NOTE_EMOJIS:     ['✅', '⚠️', '🔧', '💻', '🚫', '🎉', '👍', '❌', '🔄', '📝'],
  APP_NAME:        'AssetSys',
  LINE_CHANNEL_ID: '',        // ← LINE Channel ID (optional)
};
