<?php
/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — config.php
 *  Step 1: Core Configuration
 * ============================================================
 */

// ── Google Sheets ──────────────────────────────────────────
define('SPREADSHEET_ID', '1PJbsnOWp_OBFAmgft6lVyn4G0ta__pp7gngaDyUNS3g');
define('GOOGLE_API_KEY', '');               // ← ใส่ Google API Key (ถ้าใช้ public read)
define('GOOGLE_SERVICE_ACCOUNT_JSON', __DIR__ . '/credentials/service-account.json');

// Sheet Names
define('SHEET_RECORDS',     'records');
define('SHEET_USERS',       'users');
define('SHEET_SETTINGS',    'settings');
define('SHEET_DEPARTMENTS', 'departments');

// ── imgbb ──────────────────────────────────────────────────
define('IMGBB_API_KEY', 'b37889052f6fd7b7143ff017d07914df');
define('IMGBB_UPLOAD_URL', 'https://api.imgbb.com/1/upload');
define('IMGBB_MAX_IMAGES', 2);

// ── LINE OAuth ─────────────────────────────────────────────
define('LINE_CHANNEL_ID',     '');          // ← ใส่ Line Channel ID
define('LINE_CHANNEL_SECRET', '');          // ← ใส่ Line Channel Secret
define('LINE_CALLBACK_URL',   'https://yourdomain.com/line_callback.php');

// ── App ────────────────────────────────────────────────────
define('APP_NAME',       'AssetSys');
define('APP_VERSION',    '1.0.0');
define('SESSION_TIMEOUT', 86400 * 7);       // 7 วัน (วินาที)
define('PIN_LENGTH',      6);

// ── Timezone ───────────────────────────────────────────────
date_default_timezone_set('Asia/Bangkok');

// ── Error Reporting (dev = true, prod = false) ─────────────
define('DEBUG_MODE', true);
if (DEBUG_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// ── Session Setup ──────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => SESSION_TIMEOUT,
        'path'     => '/',
        'secure'   => isset($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ── Emoji Presets (5 แบบ สำหรับ Note) ─────────────────────
define('NOTE_EMOJIS', json_encode(['✅', '⚠️', '🔧', '💻', '🚫']));
