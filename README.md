# AssetSys — PC Upgrade Tracker (GitHub Pages Edition)

## 🏗️ Architecture

```
GitHub Pages (Static)          Google Apps Script            Google Sheets
┌─────────────────────┐       ┌──────────────────────┐      ┌──────────────┐
│  login.html         │  →→→  │  Code.gs             │ →→→  │  records     │
│  index.html         │       │  (Web App REST API)  │      │  users       │
│  azuadmin.html      │       │                      │      │  settings    │
│  js/config.js       │       │  Free / No server    │      │  departments │
│  js/api.js          │       └──────────────────────┘      └──────────────┘
└─────────────────────┘
         ↓ (image upload direct)
    imgbb.com API
```

## 📁 โครงสร้างไฟล์

```
assettask/                     ← GitHub repo root
│
├── gas/
│   └── Code.gs                ← Copy ไปวางใน Google Apps Script
│
├── js/
│   ├── config.js              ← ใส่ GAS_URL ตรงนี้
│   └── api.js                 ← API client (ทุก call ไป GAS)
│
├── login.html                 ← [Step 2] หน้า Login + Change PIN
├── index.html                 ← [Step 3] หน้าหลัก บันทึก Upgrade
├── records.html               ← [Step 4] รายการทั้งหมด + แก้ไข
├── azuadmin.html              ← [Step 5] Admin Dashboard
└── README.md
```

## 🚀 วิธีตั้งค่าครั้งแรก

### Step A — Google Apps Script

1. เปิด https://script.google.com
2. **New Project** → ตั้งชื่อว่า `AssetSys`
3. ลบโค้ดเดิม แล้ว copy ทั้งหมดจาก `gas/Code.gs` วางแทน
4. **Deploy** → **New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy **Deployment URL** (ยาวมาก เริ่มด้วย `https://script.google.com/macros/s/...`)

### Step B — ตั้งค่า Frontend

เปิด `js/config.js` แก้บรรทัดนี้:
```js
GAS_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
```

### Step C — Init Database (ครั้งเดียว)

เปิด URL นี้ใน browser:
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=init
```
จะสร้าง sheets + default data อัตโนมัติ

### Step D — Push ขึ้น GitHub

```bash
git add .
git commit -m "Step 1: Core setup"
git push origin main
```

### Step E — Enable GitHub Pages

GitHub repo → **Settings** → **Pages**
→ Source: **Deploy from branch** → Branch: `main` → `/root`

เข้าใช้งานที่: `https://naadisak.github.io/assettask/login.html`

---

## 🔑 Default Login

| Field | Value |
|-------|-------|
| Employee ID | `admin001` |
| PIN | `123456` (= phone_ext) |
| ระบบบังคับเปลี่ยน PIN ทันที | ✅ |

---

## ✅ Step Checklist

- [x] **Step 1** — GAS Backend + JS Core (config, api client)
- [ ] **Step 2** — Login UI + Change PIN
- [ ] **Step 3** — Main Form (บันทึก Upgrade)
- [ ] **Step 4** — Record List / View / Edit
- [ ] **Step 5** — Admin Dashboard (azuadmin)
- [ ] **Step 6** — Settings & User Management
- [ ] **Step 7** — Line OAuth (optional)

---

## 🟢 LINE OAuth Setup

ตั้งค่าใน Google Apps Script:

1. Apps Script → Project Settings → **Script Properties** → เพิ่ม:

| Key | Value |
|-----|-------|
| `LINE_CHANNEL_ID` | Channel ID จาก LINE Developers |
| `LINE_CHANNEL_SECRET` | Channel Secret |
| `LINE_CALLBACK_URL` | `https://naadisak.github.io/assettask/line_callback.html` |

2. ใน `js/config.js` ใส่:
```js
LINE_CHANNEL_ID: 'YOUR_CHANNEL_ID'
```

3. LINE Developers → Messaging API → **Callback URL**:
```
https://naadisak.github.io/assettask/line_callback.html
```

## 📱 PWA — Add to Home Screen

ทุกหน้ามี manifest.json แล้ว — เปิดใน mobile browser แล้วกด "Add to Home Screen" ได้เลย

