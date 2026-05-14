<?php
/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — api.php
 *  Step 1: Central AJAX API Handler
 *  รับ POST JSON → คืน JSON response
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/GoogleSheetsAPI.php';
require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/ImgBB.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ── Helpers ─────────────────────────────────────────────────
function ok(array $data = []): never
{
    echo json_encode(['success' => true, ...$data]);
    exit;
}

function fail(string $message, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

function input(): array
{
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? $_POST;
}

// ── Route ───────────────────────────────────────────────────
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$auth   = new Auth();

// ── Public endpoints (ไม่ต้อง login) ───────────────────────
if ($action === 'login') {
    $d    = input();
    $res  = $auth->login(trim($d['employee_id'] ?? ''), trim($d['pin'] ?? ''));
    if ($res['success']) {
        ok(['must_change_pw' => $res['must_change_pw'], 'user' => $auth->currentUser()]);
    }
    fail($res['error']);
}

if ($action === 'logout') {
    $auth->logout();
    ok();
}

// ── Protected endpoints ─────────────────────────────────────
if (!$auth->check()) {
    fail('Unauthorized', 401);
}

$sheets = new GoogleSheetsAPI();
$user   = $auth->currentUser();

match ($action) {

    // ── Auth ───────────────────────────────────────────────
    'change_pin' => (function () use ($auth, $user) {
        $d   = input();
        $res = $auth->changePin($user['employee_id'], trim($d['pin'] ?? ''));
        $res['success'] ? ok() : fail($res['error']);
    })(),

    'me' => ok(['user' => $user]),

    // ── Lookups ────────────────────────────────────────────
    'get_departments' => ok(['departments' => $sheets->getDepartments()]),

    'get_settings' => (function () use ($sheets) {
        $cat = $_GET['category'] ?? '';
        ok(['settings' => array_values($sheets->getSettings($cat))]);
    })(),

    // ── Records ────────────────────────────────────────────
    'get_records' => (function () use ($sheets) {
        $rows = $sheets->getRows(SHEET_RECORDS, GoogleSheetsAPI::COL_RECORDS);
        // newest first
        usort($rows, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));
        ok(['records' => $rows]);
    })(),

    'save_record' => (function () use ($sheets, $user) {
        $d = input();

        $required = ['department', 'computer_name', 'current_os', 'up2_os', 'status'];
        foreach ($required as $f) {
            if (empty($d[$f])) fail("กรุณากรอก: $f");
        }

        // Auto-save department ถ้ายังไม่มีในระบบ
        $dept = trim($d['department']);
        $existing = $sheets->getDepartments();
        if (!in_array($dept, $existing)) {
            $sheets->appendRow(SHEET_DEPARTMENTS, [
                GoogleSheetsAPI::generateId(),
                $dept,
                date('Y-m-d H:i:s'),
            ]);
        }

        $id  = GoogleSheetsAPI::generateId();
        $now = date('Y-m-d H:i:s');

        $row = [
            $id,
            $now,
            $dept,
            trim($d['computer_name']     ?? ''),
            trim($d['ext']               ?? ''),
            $d['current_os']             ?? '',
            $d['current_os_detail']      ?? '',
            $d['up2_os']                 ?? '',
            $d['up2_os_detail']          ?? '',
            $d['status']                 ?? '',
            $d['it_agent']               ?? $user['employee_id'],
            substr(trim($d['note'] ?? ''), 0, 50),
            $d['image1_url']             ?? '',
            $d['image2_url']             ?? '',
            $d['emoji']                  ?? '',
            $user['employee_id'],
            $now,
        ];

        $ok = $sheets->appendRow(SHEET_RECORDS, $row);
        $ok ? ok(['id' => $id]) : fail('บันทึกไม่สำเร็จ');
    })(),

    'update_record' => (function () use ($sheets, $auth, $user) {
        $d  = input();
        $id = trim($d['id'] ?? '');
        if (!$id) fail('ไม่พบ record ID');

        // ── Permission check ──────────────────────────────
        $record = $sheets->findRow(SHEET_RECORDS, GoogleSheetsAPI::COL_RECORDS, 'id', $id);
        if (!$record) fail('ไม่พบข้อมูล');

        if (!$auth->isAdmin() && $record['created_by'] !== $user['employee_id']) {
            fail('คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้', 403);
        }

        $rowNum = $sheets->findRowNumber(SHEET_RECORDS, $id);
        if ($rowNum < 0) fail('ไม่พบแถวข้อมูล');

        $row = [
            $id,
            $record['timestamp'],
            trim($d['department']        ?? $record['department']),
            trim($d['computer_name']     ?? $record['computer_name']),
            trim($d['ext']               ?? $record['ext']),
            $d['current_os']             ?? $record['current_os'],
            $d['current_os_detail']      ?? $record['current_os_detail'],
            $d['up2_os']                 ?? $record['up2_os'],
            $d['up2_os_detail']          ?? $record['up2_os_detail'],
            $d['status']                 ?? $record['status'],
            $d['it_agent']               ?? $record['it_agent'],
            substr(trim($d['note'] ?? $record['note']), 0, 50),
            $d['image1_url']             ?? $record['image1_url'],
            $d['image2_url']             ?? $record['image2_url'],
            $d['emoji']                  ?? $record['emoji'],
            $record['created_by'],
            $record['created_at'],
        ];

        $ok = $sheets->updateRow(SHEET_RECORDS, $rowNum, $row);
        $ok ? ok() : fail('อัปเดตไม่สำเร็จ');
    })(),

    // ── Image Upload ───────────────────────────────────────
    'upload_image' => (function () {
        if (empty($_FILES['image'])) fail('ไม่พบไฟล์รูปภาพ');
        $imgbb  = new ImgBB();
        $result = $imgbb->upload($_FILES['image']);
        $result['success'] ? ok($result) : fail($result['error']);
    })(),

    // ── Admin: Settings ───────────────────────────────────
    'save_setting' => (function () use ($sheets, $auth) {
        $auth->requireAdmin();
        $d = input();
        $required = ['category', 'value', 'label'];
        foreach ($required as $f) {
            if (empty($d[$f])) fail("กรุณากรอก: $f");
        }
        $row = [
            GoogleSheetsAPI::generateId(),
            $d['category'],
            $d['value'],
            $d['label'],
            $d['sort_order'] ?? '99',
            '1',
        ];
        $ok = $sheets->appendRow(SHEET_SETTINGS, $row);
        $ok ? ok() : fail('บันทึกไม่สำเร็จ');
    })(),

    // ── Admin: Users ─────────────────────────────────────
    'get_users' => (function () use ($sheets, $auth) {
        $auth->requireAdmin();
        $rows = $sheets->getRows(SHEET_USERS, GoogleSheetsAPI::COL_USERS);
        // ไม่ส่ง password_hash กลับ
        $rows = array_map(function ($r) {
            unset($r['password_hash']);
            return $r;
        }, $rows);
        ok(['users' => $rows]);
    })(),

    'save_user' => (function () use ($sheets, $auth) {
        $auth->requireAdmin();
        $d = input();
        $required = ['employee_id', 'first_name', 'last_name', 'email', 'phone_ext', 'role'];
        foreach ($required as $f) {
            if (empty($d[$f])) fail("กรุณากรอก: $f");
        }
        $row = [
            GoogleSheetsAPI::generateId(),
            trim($d['employee_id']),
            trim($d['first_name']),
            trim($d['last_name']),
            trim($d['email']),
            trim($d['phone_ext']),
            $d['role'] === 'admin' ? 'admin' : 'users',
            '',        // password_hash — blank = ใช้ phone_ext ก่อน
            '',        // avatar_url
            '',        // line_user_id
            'active',  // status
            '1',       // must_change_pw
            date('Y-m-d H:i:s'),
        ];
        $ok = $sheets->appendRow(SHEET_USERS, $row);
        $ok ? ok() : fail('บันทึกไม่สำเร็จ');
    })(),

    default => fail("Unknown action: $action", 404),
};
