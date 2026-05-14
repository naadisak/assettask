<?php
/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — GoogleSheetsAPI.php
 *  Step 1: Core Google Sheets Wrapper
 *  ใช้ Service Account (server-to-server) — ไม่ต้อง OAuth popup
 * ============================================================
 */

require_once __DIR__ . '/config.php';

class GoogleSheetsAPI
{
    private string $spreadsheetId;
    private string $accessToken = '';
    private string $tokenExpiry  = '';
    private string $credFile;
    private string $baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

    // ── Column Maps ──────────────────────────────────────────
    public const COL_RECORDS = [
        'id', 'timestamp', 'department', 'computer_name', 'ext',
        'current_os', 'current_os_detail', 'up2_os', 'up2_os_detail',
        'status', 'it_agent', 'note', 'image1_url', 'image2_url',
        'emoji', 'created_by', 'created_at'
    ];

    public const COL_USERS = [
        'id', 'employee_id', 'first_name', 'last_name', 'email',
        'phone_ext', 'role', 'password_hash', 'avatar_url',
        'line_user_id', 'status', 'must_change_pw', 'created_at'
    ];

    public const COL_SETTINGS = [
        'id', 'category', 'value', 'label', 'sort_order', 'active'
    ];

    public const COL_DEPARTMENTS = [
        'id', 'name', 'created_at'
    ];

    // ── Constructor ──────────────────────────────────────────
    public function __construct()
    {
        $this->spreadsheetId = SPREADSHEET_ID;
        $this->credFile      = GOOGLE_SERVICE_ACCOUNT_JSON;
    }

    // ═══════════════════════════════════════════════════════
    //  AUTH — Service Account → Access Token
    // ═══════════════════════════════════════════════════════

    private function getAccessToken(): string
    {
        // คืน token เดิมถ้ายังไม่หมดอายุ
        if ($this->accessToken && time() < (int)$this->tokenExpiry) {
            return $this->accessToken;
        }

        if (!file_exists($this->credFile)) {
            throw new Exception('Service account JSON not found: ' . $this->credFile);
        }

        $cred = json_decode(file_get_contents($this->credFile), true);

        $now    = time();
        $expiry = $now + 3600;
        $scope  = 'https://www.googleapis.com/auth/spreadsheets';

        $header  = base64_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $payload = base64_encode(json_encode([
            'iss'   => $cred['client_email'],
            'scope' => $scope,
            'aud'   => 'https://oauth2.googleapis.com/token',
            'exp'   => $expiry,
            'iat'   => $now,
        ]));

        $data = "$header.$payload";
        openssl_sign($data, $sig, $cred['private_key'], 'sha256WithRSAEncryption');
        $jwt = "$data." . base64_encode($sig);

        $resp = $this->httpPost('https://oauth2.googleapis.com/token', http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]), ['Content-Type: application/x-www-form-urlencoded']);

        $result = json_decode($resp, true);

        if (empty($result['access_token'])) {
            throw new Exception('Failed to get access token: ' . $resp);
        }

        $this->accessToken = $result['access_token'];
        $this->tokenExpiry = (string)($now + ($result['expires_in'] ?? 3600) - 60);

        return $this->accessToken;
    }

    // ═══════════════════════════════════════════════════════
    //  READ — ดึงข้อมูลจาก Sheet
    // ═══════════════════════════════════════════════════════

    /**
     * ดึงทุก row จาก sheet
     * @return array<int, array<string, string>> — array of assoc arrays
     */
    public function getRows(string $sheet, array $columns): array
    {
        $range = urlencode("{$sheet}!A1:Z");
        $url   = "{$this->baseUrl}/{$this->spreadsheetId}/values/{$range}";
        $resp  = $this->httpGet($url);
        $data  = json_decode($resp, true);

        $rows = $data['values'] ?? [];
        if (empty($rows)) return [];

        // Skip header row (row 0)
        $result = [];
        for ($i = 1; $i < count($rows); $i++) {
            $row    = $rows[$i];
            $mapped = [];
            foreach ($columns as $idx => $col) {
                $mapped[$col] = $row[$idx] ?? '';
            }
            $result[] = $mapped;
        }

        return $result;
    }

    /**
     * ดึงแค่ 1 row โดย column + value
     */
    public function findRow(string $sheet, array $columns, string $col, string $val): ?array
    {
        $rows = $this->getRows($sheet, $columns);
        foreach ($rows as $row) {
            if (($row[$col] ?? '') === $val) {
                return $row;
            }
        }
        return null;
    }

    /**
     * ดึงข้อมูล settings โดย category
     */
    public function getSettings(string $category): array
    {
        $rows = $this->getRows(SHEET_SETTINGS, self::COL_SETTINGS);
        return array_filter($rows, fn($r) =>
            $r['category'] === $category && $r['active'] === '1'
        );
    }

    /**
     * ดึงชื่อส่วนงานทั้งหมด (unique)
     */
    public function getDepartments(): array
    {
        $rows = $this->getRows(SHEET_DEPARTMENTS, self::COL_DEPARTMENTS);
        return array_column($rows, 'name');
    }

    // ═══════════════════════════════════════════════════════
    //  WRITE — เพิ่ม / แก้ไข ข้อมูล
    // ═══════════════════════════════════════════════════════

    /**
     * Append row ใหม่ ท้าย sheet
     */
    public function appendRow(string $sheet, array $values): bool
    {
        $range = urlencode("{$sheet}!A1");
        $url   = "{$this->baseUrl}/{$this->spreadsheetId}/values/{$range}:append"
               . '?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';

        $body = json_encode(['values' => [$values]]);
        $resp = $this->httpPost($url, $body, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->getAccessToken(),
        ]);

        $result = json_decode($resp, true);
        return isset($result['updates']);
    }

    /**
     * Update row โดยรู้ row number (1-based, รวม header)
     */
    public function updateRow(string $sheet, int $rowNum, array $values): bool
    {
        $lastCol = $this->numToLetter(count($values));
        $range   = urlencode("{$sheet}!A{$rowNum}:{$lastCol}{$rowNum}");
        $url     = "{$this->baseUrl}/{$this->spreadsheetId}/values/{$range}"
                 . '?valueInputOption=USER_ENTERED';

        $body = json_encode(['values' => [$values]]);
        $resp = $this->httpPut($url, $body, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->getAccessToken(),
        ]);

        $result = json_decode($resp, true);
        return isset($result['updatedRows']);
    }

    /**
     * หา row number ของ record โดย id column
     * คืน row number (1-based รวม header) หรือ -1 ถ้าไม่เจอ
     */
    public function findRowNumber(string $sheet, string $id): int
    {
        $range = urlencode("{$sheet}!A:A");
        $url   = "{$this->baseUrl}/{$this->spreadsheetId}/values/{$range}";
        $resp  = $this->httpGet($url);
        $data  = json_decode($resp, true);

        $col = $data['values'] ?? [];
        foreach ($col as $i => $cell) {
            if (($cell[0] ?? '') === $id) {
                return $i + 1; // 1-based
            }
        }
        return -1;
    }

    // ═══════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════

    /** สร้าง unique ID แบบ timestamp+random */
    public static function generateId(): string
    {
        return date('Ymd') . strtoupper(substr(uniqid(), -5));
    }

    /** Column number → letter (1→A, 27→AA) */
    private function numToLetter(int $n): string
    {
        $l = '';
        while ($n > 0) {
            $n--;
            $l  = chr(65 + ($n % 26)) . $l;
            $n  = (int)($n / 26);
        }
        return $l;
    }

    // ═══════════════════════════════════════════════════════
    //  HTTP Helpers
    // ═══════════════════════════════════════════════════════

    private function httpGet(string $url): string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $this->getAccessToken()],
            CURLOPT_TIMEOUT        => 15,
        ]);
        $resp = curl_exec($ch);
        $this->checkCurlError($ch);
        curl_close($ch);
        return $resp;
    }

    private function httpPost(string $url, string $body, array $headers): string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 15,
        ]);
        $resp = curl_exec($ch);
        $this->checkCurlError($ch);
        curl_close($ch);
        return $resp;
    }

    private function httpPut(string $url, string $body, array $headers): string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => 'PUT',
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 15,
        ]);
        $resp = curl_exec($ch);
        $this->checkCurlError($ch);
        curl_close($ch);
        return $resp;
    }

    private function checkCurlError($ch): void
    {
        if (curl_errno($ch)) {
            throw new Exception('cURL error: ' . curl_error($ch));
        }
    }
}
