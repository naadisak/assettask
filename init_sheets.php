<?php
/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — init_sheets.php
 *  Step 1: ตั้งค่า Google Sheet ครั้งแรก (รันครั้งเดียว!)
 *  เรียกใช้: php init_sheets.php  หรือ เปิดผ่าน browser
 *  ลบไฟล์นี้ออกหลังรันแล้ว
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/GoogleSheetsAPI.php';

$sheets = new GoogleSheetsAPI();

// ── 1. Header rows ──────────────────────────────────────────
$headers = [
    SHEET_RECORDS     => GoogleSheetsAPI::COL_RECORDS,
    SHEET_USERS       => GoogleSheetsAPI::COL_USERS,
    SHEET_SETTINGS    => GoogleSheetsAPI::COL_SETTINGS,
    SHEET_DEPARTMENTS => GoogleSheetsAPI::COL_DEPARTMENTS,
];

foreach ($headers as $sheet => $cols) {
    $sheets->appendRow($sheet, $cols);
    echo "✅ Header added → {$sheet}\n";
}

// ── 2. Default Settings ─────────────────────────────────────
$defaultSettings = [
    // OS
    ['S001', 'os', 'win10',     'Windows 10',    '1', '1'],
    ['S002', 'os', 'win11',     'Windows 11',    '2', '1'],
    ['S003', 'os', 'ubuntu16',  'Ubuntu 16',     '3', '1'],
    ['S004', 'os', 'ubuntu20',  'Ubuntu 20.x',   '4', '1'],
    // Status
    ['S005', 'status', 'pass',          'Pass',           '1', '1'],
    ['S006', 'status', 'doi',           'ด๋อย',           '2', '1'],
    ['S007', 'status', 'reject_user',   'Reject by user', '3', '1'],
];

foreach ($defaultSettings as $row) {
    $sheets->appendRow(SHEET_SETTINGS, $row);
}
echo "✅ Default settings added\n";

// ── 3. Default Admin User ───────────────────────────────────
$adminPin = '123456'; // เปลี่ยนทันทีหลัง login ครั้งแรก!
$sheets->appendRow(SHEET_USERS, [
    GoogleSheetsAPI::generateId(),
    'admin001',                              // employee_id
    'System',                                // first_name
    'Admin',                                 // last_name
    'admin@company.com',                     // email
    '123456',                                // phone_ext (= first-time PIN)
    'admin',                                 // role
    '',                                      // password_hash (blank = ใช้ phone_ext ก่อน)
    '',                                      // avatar_url
    '',                                      // line_user_id
    'active',                                // status
    '1',                                     // must_change_pw
    date('Y-m-d H:i:s'),                     // created_at
]);
echo "✅ Default admin created (employee_id: admin001, first PIN: 123456)\n";

echo "\n⚠️  ลบไฟล์ init_sheets.php ออกทันทีหลังรันเสร็จ!\n";
