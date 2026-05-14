<?php
/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — Auth.php
 *  Step 1: Authentication & Session
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/GoogleSheetsAPI.php';

class Auth
{
    private GoogleSheetsAPI $sheets;

    public function __construct()
    {
        $this->sheets = new GoogleSheetsAPI();
    }

    // ═══════════════════════════════════════════════════════
    //  LOGIN
    // ═══════════════════════════════════════════════════════

    /**
     * Login ด้วย employee_id + PIN
     * @return array ['success'=>bool, 'must_change_pw'=>bool, 'error'=>string]
     */
    public function login(string $employeeId, string $pin): array
    {
        $user = $this->sheets->findRow(SHEET_USERS, GoogleSheetsAPI::COL_USERS, 'employee_id', $employeeId);

        if (!$user) {
            return ['success' => false, 'must_change_pw' => false, 'error' => 'ไม่พบรหัสพนักงาน'];
        }

        if ($user['status'] !== 'active') {
            return ['success' => false, 'must_change_pw' => false, 'error' => 'บัญชีนี้ถูกระงับการใช้งาน'];
        }

        // ── First login: PIN = phone_ext ─────────────────────
        if ($user['must_change_pw'] === '1') {
            if ($pin !== $user['phone_ext']) {
                return ['success' => false, 'must_change_pw' => false, 'error' => 'รหัสผ่านไม่ถูกต้อง'];
            }
            $this->startSession($user);
            return ['success' => true, 'must_change_pw' => true, 'error' => ''];
        }

        // ── Normal login: verify hashed PIN ──────────────────
        if (!password_verify($pin, $user['password_hash'])) {
            return ['success' => false, 'must_change_pw' => false, 'error' => 'รหัสผ่านไม่ถูกต้อง'];
        }

        $this->startSession($user);
        return ['success' => true, 'must_change_pw' => false, 'error' => ''];
    }

    // ═══════════════════════════════════════════════════════
    //  CHANGE PIN
    // ═══════════════════════════════════════════════════════

    /**
     * เปลี่ยน PIN — ต้องเป็นตัวเลข 6 หลัก
     */
    public function changePin(string $employeeId, string $newPin): array
    {
        if (!preg_match('/^\d{' . PIN_LENGTH . '}$/', $newPin)) {
            return ['success' => false, 'error' => 'PIN ต้องเป็นตัวเลข ' . PIN_LENGTH . ' หลักเท่านั้น'];
        }

        $rowNum = $this->sheets->findRowNumber(SHEET_USERS, $employeeId);
        if ($rowNum < 0) {
            return ['success' => false, 'error' => 'ไม่พบผู้ใช้งาน'];
        }

        // ดึง row ปัจจุบันแล้ว update เฉพาะ password_hash + must_change_pw
        $user = $this->sheets->findRow(SHEET_USERS, GoogleSheetsAPI::COL_USERS, 'employee_id', $employeeId);
        if (!$user) {
            return ['success' => false, 'error' => 'ไม่พบผู้ใช้งาน'];
        }

        $user['password_hash']  = password_hash($newPin, PASSWORD_BCRYPT);
        $user['must_change_pw'] = '0';

        $values = array_values($user);
        $ok     = $this->sheets->updateRow(SHEET_USERS, $rowNum, $values);

        if ($ok) {
            $_SESSION['must_change_pw'] = false;
        }

        return ['success' => $ok, 'error' => $ok ? '' : 'บันทึกไม่สำเร็จ กรุณาลองใหม่'];
    }

    // ═══════════════════════════════════════════════════════
    //  SESSION
    // ═══════════════════════════════════════════════════════

    private function startSession(array $user): void
    {
        session_regenerate_id(true);
        $_SESSION['user']          = $user;
        $_SESSION['logged_in']     = true;
        $_SESSION['must_change_pw']= $user['must_change_pw'] === '1';
        $_SESSION['last_activity'] = time();
    }

    public function logout(): void
    {
        $_SESSION = [];
        session_destroy();
    }

    /**
     * ตรวจสอบว่า login อยู่หรือไม่ + ต่ออายุ session
     */
    public function check(): bool
    {
        if (empty($_SESSION['logged_in'])) {
            return false;
        }

        // ── Session timeout ───────────────────────────────────
        if (time() - ($_SESSION['last_activity'] ?? 0) > SESSION_TIMEOUT) {
            $this->logout();
            return false;
        }

        $_SESSION['last_activity'] = time();
        return true;
    }

    /**
     * ต้อง login ก่อน — ใช้เรียกต้นไฟล์ที่ต้อง auth
     */
    public function requireLogin(): void
    {
        if (!$this->check()) {
            header('Location: login.php');
            exit;
        }
        if ($_SESSION['must_change_pw'] ?? false) {
            if (!str_contains($_SERVER['PHP_SELF'], 'change_pin')) {
                header('Location: change_pin.php');
                exit;
            }
        }
    }

    /**
     * ต้องเป็น admin เท่านั้น
     */
    public function requireAdmin(): void
    {
        $this->requireLogin();
        if (($this->currentUser()['role'] ?? '') !== 'admin') {
            http_response_code(403);
            die('Access Denied');
        }
    }

    // ═══════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════

    public function currentUser(): array
    {
        return $_SESSION['user'] ?? [];
    }

    public function isAdmin(): bool
    {
        return ($this->currentUser()['role'] ?? '') === 'admin';
    }

    public function currentEmployeeId(): string
    {
        return $this->currentUser()['employee_id'] ?? '';
    }

    public function currentDisplayName(): string
    {
        $u = $this->currentUser();
        return trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
    }
}
