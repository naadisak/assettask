# AssetSys — PC Upgrade Tracker

## 📁 โครงสร้างไฟล์

```
assettask/
├── config.php              ← ตั้งค่าระบบ (API Keys, Sheet ID)
├── GoogleSheetsAPI.php     ← Core wrapper: read/write Google Sheets
├── Auth.php                ← Login, Session, Permission
├── ImgBB.php               ← Upload รูปภาพ
├── api.php                 ← AJAX API endpoint ทั้งหมด
├── init_sheets.php         ← รันครั้งเดียวเพื่อสร้าง headers
│
├── login.php               ← [Step 2] หน้า Login
├── change_pin.php          ← [Step 2] หน้าเปลี่ยน PIN ครั้งแรก
├── index.php               ← [Step 3] หน้าหลัก บันทึก Upgrade
├── records.php             ← [Step 4] รายการทั้งหมด
├── azuadmin.php            ← [Step 5] Admin Dashboard
│
└── credentials/
    └── service-account.json  ← Google Service Account Key (อย่า commit!)
```

---

## 🗂️ Google Sheet Structure

### Sheet: `records`
| Column | Type | Description |
|--------|------|-------------|
| id | text | Auto-generated ID (YYYYMMDDxxxxx) |
| timestamp | datetime | เวลาบันทึก |
| department | text | ส่วนงาน |
| computer_name | text | ชื่อเครื่อง PC |
| ext | text | เบอร์ SIP โทรศัพท์ |
| current_os | text | OS ปัจจุบัน (windows/ubuntu) |
| current_os_detail | text | รายละเอียด OS (win10/win11/ubuntu16/ubuntu20) |
| up2_os | text | OS ที่ Upgrade ไป |
| up2_os_detail | text | รายละเอียด OS ใหม่ |
| status | text | Pass / ด๋อย / Reject by user |
| it_agent | text | employee_id ของ IT ที่ทำ |
| note | text | บันทึกย่อ (max 50 ตัวอักษร) |
| image1_url | url | URL รูปที่ 1 (imgbb) |
| image2_url | url | URL รูปที่ 2 (imgbb) |
| emoji | text | Emoji ที่เลือก |
| created_by | text | employee_id ผู้บันทึก |
| created_at | datetime | วันเวลาที่บันทึก |

### Sheet: `users`
| Column | Type | Description |
|--------|------|-------------|
| id | text | Auto-generated |
| employee_id | text | รหัสพนักงาน (unique) |
| first_name | text | ชื่อ |
| last_name | text | นามสกุล |
| email | text | อีเมล |
| phone_ext | text | เบอร์โต๊ะ 6 หลัก (= PIN เริ่มต้น) |
| role | text | admin / users |
| password_hash | text | bcrypt hash |
| avatar_url | url | URL รูป avatar (imgbb) |
| line_user_id | text | Line UID |
| status | text | active / inactive |
| must_change_pw | 0/1 | 1 = ต้องเปลี่ยน PIN ก่อน |
| created_at | datetime | วันที่สร้าง |

### Sheet: `settings`
| Column | Type | Description |
|--------|------|-------------|
| id | text | Auto-generated |
| category | text | os / status |
| value | text | ค่า key (win10, pass ฯลฯ) |
| label | text | ชื่อแสดงผล |
| sort_order | number | ลำดับ |
| active | 0/1 | แสดง/ซ่อน |

### Sheet: `departments`
| Column | Type | Description |
|--------|------|-------------|
| id | text | Auto-generated |
| name | text | ชื่อส่วนงาน |
| created_at | datetime | วันที่เพิ่ม |

---

## 🚀 วิธีเริ่มต้น

### 1. Google Cloud Console
1. ไปที่ https://console.cloud.google.com
2. สร้าง Project ใหม่
3. เปิดใช้ **Google Sheets API**
4. สร้าง **Service Account** → ดาวน์โหลด JSON
5. วางไฟล์ JSON ที่ `credentials/service-account.json`
6. เปิด Google Sheet → **Share** → ใส่ email ของ Service Account (Editor)

### 2. แก้ไข config.php
```php
define('SPREADSHEET_ID', 'YOUR_SHEET_ID');
define('LINE_CHANNEL_ID', 'YOUR_LINE_CHANNEL_ID');
define('LINE_CHANNEL_SECRET', 'YOUR_LINE_CHANNEL_SECRET');
```

### 3. รัน init_sheets.php (ครั้งเดียว!)
```bash
php init_sheets.php
# หรือเปิดผ่าน browser แล้วลบทิ้ง
```

### 4. Login ครั้งแรก
- employee_id: `admin001`
- PIN: `123456` (= phone_ext)
- ระบบบังคับเปลี่ยน PIN ทันที

---

## 📡 API Endpoints

```
POST api.php?action=login
POST api.php?action=logout
POST api.php?action=change_pin
GET  api.php?action=me
GET  api.php?action=get_departments
GET  api.php?action=get_settings&category=os
GET  api.php?action=get_records
POST api.php?action=save_record
POST api.php?action=update_record
POST api.php?action=upload_image      (multipart/form-data)
POST api.php?action=save_setting      (admin)
GET  api.php?action=get_users         (admin)
POST api.php?action=save_user         (admin)
```

---

## ✅ Step Checklist

- [x] **Step 1** — Core (config, Sheets wrapper, Auth, ImgBB, API)
- [ ] **Step 2** — Login UI + Change PIN
- [ ] **Step 3** — Main Form (บันทึก Upgrade)
- [ ] **Step 4** — Record List / View / Edit
- [ ] **Step 5** — Admin Dashboard (azuadmin)
- [ ] **Step 6** — Settings & User Management UI
- [ ] **Step 7** — Line OAuth
