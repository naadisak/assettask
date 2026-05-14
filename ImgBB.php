<?php
/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — ImgBB.php
 *  Step 1: Image Upload Helper
 * ============================================================
 */

require_once __DIR__ . '/config.php';

class ImgBB
{
    private string $apiKey;
    private string $uploadUrl;

    public function __construct()
    {
        $this->apiKey    = IMGBB_API_KEY;
        $this->uploadUrl = IMGBB_UPLOAD_URL;
    }

    /**
     * Upload ไฟล์รูปภาพ
     * @param  array  $file  $_FILES['field']
     * @return array  ['success'=>bool, 'url'=>string, 'error'=>string]
     */
    public function upload(array $file): array
    {
        // ── Validation ────────────────────────────────────────
        $allowed    = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $maxSizeMB  = 5;

        if ($file['error'] !== UPLOAD_ERR_OK) {
            return ['success' => false, 'url' => '', 'error' => 'Upload error: ' . $file['error']];
        }

        if (!in_array($file['type'], $allowed)) {
            return ['success' => false, 'url' => '', 'error' => 'ไฟล์ต้องเป็น JPG, PNG, GIF หรือ WEBP เท่านั้น'];
        }

        if ($file['size'] > $maxSizeMB * 1024 * 1024) {
            return ['success' => false, 'url' => '', 'error' => "ขนาดไฟล์ต้องไม่เกิน {$maxSizeMB}MB"];
        }

        // ── Upload ────────────────────────────────────────────
        $imageData = base64_encode(file_get_contents($file['tmp_name']));

        $ch = curl_init($this->uploadUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => [
                'key'   => $this->apiKey,
                'image' => $imageData,
                'name'  => pathinfo($file['name'], PATHINFO_FILENAME),
            ],
            CURLOPT_TIMEOUT        => 30,
        ]);

        $resp   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$resp || $status !== 200) {
            return ['success' => false, 'url' => '', 'error' => 'ไม่สามารถเชื่อมต่อ imgbb ได้'];
        }

        $result = json_decode($resp, true);

        if (!($result['success'] ?? false)) {
            return ['success' => false, 'url' => '', 'error' => $result['error']['message'] ?? 'Upload failed'];
        }

        return [
            'success'   => true,
            'url'       => $result['data']['url'],
            'thumb_url' => $result['data']['thumb']['url'] ?? $result['data']['url'],
            'delete_url'=> $result['data']['delete_url'] ?? '',
            'error'     => '',
        ];
    }

    /**
     * Upload หลายรูปพร้อมกัน (max 2 รูปตาม config)
     * @param  array  $files  array of $_FILES items
     * @return array  array of results
     */
    public function uploadMultiple(array $files): array
    {
        $results = [];
        $max     = min(count($files), IMGBB_MAX_IMAGES);

        for ($i = 0; $i < $max; $i++) {
            $results[] = $this->upload($files[$i]);
        }

        return $results;
    }
}
