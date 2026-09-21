# Data Dictionary — Leave-NPW

สรุปตาราง ฟิลด์ และ enum values ทั้งหมดในระบบ (อ้างอิงตลอดทุกเฟส)

## ตาราง

### teachers
ข้อมูลครูและบุคลากร

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| teacher_code | String | รหัสประจำตัวครู (unique) |
| citizen_id | String | เลขบัตรประชาชน 13 หลัก (unique) |
| title | String | คำนำหน้า |
| first_name | String | ชื่อ |
| last_name | String | นามสกุล |
| birth_date | Date | วันเกิด |
| position | String | ตำแหน่ง |
| department | String? | กลุ่มสาระ/ฝ่าย (nullable) |
| phone | String? | เบอร์โทร |
| is_active | Boolean | สถานะใช้งาน (default: true) |
| created_at | DateTime | วันที่สร้าง |
| updated_at | DateTime | วันที่แก้ไข |

### hr_users
บัญชีเจ้าหน้าที่ HR และ Super Admin

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| username | String | Username (unique) |
| password_hash | String | Password hash (scrypt) |
| first_name | String | ชื่อ |
| last_name | String | นามสกุล |
| role | HrRole | บทบาท (hr / super_admin) |
| is_active | Boolean | สถานะใช้งาน |
| last_login_at | DateTime? | ล็อกอินล่าสุด |
| last_login_ip | String? | IP ล่าสุด |
| created_at | DateTime | วันที่สร้าง |
| updated_at | DateTime | วันที่แก้ไข |

### leaves
ใบลาทั้งหมด

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| leave_no | String | เลขที่ใบลา รูปแบบ `LEAVE-{ปีงบ}/{รอบ}-{เลข}` เช่น LEAVE-69/1-0001, LEAVE-69/2-0015 (unique) |
| fiscal_year | Int | ปีงบประมาณ พ.ศ. (ปีงบ = ต.ค.ปีก่อน-ก.ย.ปีปัจจุบัน) |
| round | Int | รอบการลา: 1=ต.ค.-มี.ค. (รอบแรก), 2=เม.ย.-ก.ย. (รอบสอง) |
| running_no | Int | เลขรันนิ่งในรอบนั้น (reset ทุกรอบ, unique constraint: fiscal_year + round + running_no) |
| teacher_id | String | FK → teachers |
| type | LeaveType | ประเภทการลา |
| custom_type_name | String? | ชื่อประเภท (กรณี type=other) |
| start_date | Date | วันที่เริ่มลา |
| end_date | Date | วันที่สิ้นสุดลา |
| is_half_day | Boolean | ลาครึ่งวันหรือไม่ |
| half_day_period | HalfDayPeriod? | ครึ่งเช้า/ครึ่งบ่าย |
| reason | String | เหตุผลการลา |
| contact_address | String | ที่อยู่ติดต่อ |
| contact_phone | String | เบอร์โทรติดต่อ |
| status | LeaveStatus | สถานะ (default: pending) |
| rejection_reason | String? | เหตุผลไม่อนุมัติ |
| days_working | Float | จำนวนวันทำการ |
| days_calendar | Float | จำนวนวันปฏิทิน |
| submitted_by_type | SubmitType | ใครยื่น (teacher/hr) |
| submitted_by_hr_id | String? | FK → hr_users (ถ้า HR ยื่นแทน) |
| proxy_reason | String? | เหตุผลที่ยื่นแทน |
| proxy_note | String? | หมายเหตุเพิ่มเติม |
| teacher_signature_url | String? | URL ลายเซ็นครู (บน Vercel Blob) |
| pdf_url | String? | URL ไฟล์ PDF ใบลา |
| approver_name_snapshot | String? | ชื่อผู้อนุมัติ (snapshot) |
| approver_position_snapshot | String? | ตำแหน่งผู้อนุมัติ |
| director_name_snapshot | String? | ชื่อผู้อำนวยการ |
| director_position_snapshot | String? | ตำแหน่งผู้อำนวยการ |
| approved_at | DateTime? | วันที่อนุมัติ |
| printed_at | DateTime? | วันที่พิมพ์ |
| created_at | DateTime | วันที่ยื่น |
| updated_at | DateTime | วันที่แก้ไข |

### leave_days
รายละเอียดวันลาแต่ละวัน

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| leave_id | String | FK → leaves |
| date | Date | วันที่ |
| is_working_day | Boolean | เป็นวันทำการหรือไม่ |
| is_half_day | Boolean | ลาครึ่งวันหรือไม่ |
| half_day_period | HalfDayPeriod? | ช่วง (morning/afternoon) |

### attachments
ไฟล์แนบของใบลา

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| leave_id | String | FK → leaves |
| file_name | String | ชื่อไฟล์ |
| file_size | Int | ขนาดไฟล์ (bytes) |
| mime_type | String | MIME type |
| blob_url | String | URL บน Vercel Blob |
| uploaded_at | DateTime | วันที่อัปโหลด |

### holidays
วันหยุดราชการ

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| date | Date | วันที่ (unique) |
| name | String | ชื่อวันหยุด |
| year | Int | ปี ค.ศ. |
| created_at | DateTime | วันที่สร้าง |

### signatories
ผู้ลงนาม

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| role | SignatoryRole | บทบาท (director/hr_head) |
| title | String | คำนำหน้า |
| first_name | String | ชื่อ |
| last_name | String | นามสกุล |
| position | String | ตำแหน่ง |
| signature_url | String? | URL ไฟล์ลายเซ็น |
| is_active | Boolean | สถานะใช้งาน |
| created_at | DateTime | วันที่สร้าง |
| updated_at | DateTime | วันที่แก้ไข |

### settings
การตั้งค่าระบบ (singleton)

| Field | Type | Description |
|-------|------|-------------|
| id | String | "singleton" (fixed) |
| school_name | String | ชื่อโรงเรียน |
| system_start_date | Date | วันเริ่มต้นระบบ |
| backdate_limit_days | Int | จำนวนวันย้อนหลัง (ครู) |
| hr_backdate_limit_days | Int | จำนวนวันย้อนหลัง (HR) |
| quota_sick_personal | Int | โควตาป่วย+กิจ (วัน) |
| quota_maternity | Int | โควตาคลอดบุตร (วัน) |
| quota_religious | Int | โควตาทางศาสนา (วัน) |
| require_teacher_signature | Boolean | กำหนดให้ครูต้องเซ็นลายมือชื่อในระบบหรือไม่ (default: false) |
| current_director_id | String? | FK → signatories (ผู้อำนวยการปัจจุบัน) |
| current_hr_head_id | String? | FK → signatories (หัวหน้าฝ่ายบุคคลปัจจุบัน) |
| telegram_bot_token | String? | Telegram Bot Token |
| telegram_chat_id | String? | Telegram Chat ID |
| storage_warning_threshold | Int | เกณฑ์เตือน storage (%) default: 70 |
| storage_critical_threshold | Int | เกณฑ์วิกฤต storage (%) default: 90 |
| updated_at | DateTime | วันที่แก้ไข |

### audit_logs
บันทึกการใช้งาน (append-only)

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| user_id | String? | FK → hr_users |
| user_type | String | ประเภทผู้ใช้ (teacher/hr) |
| action | String | การกระทำ |
| resource | String | ทรัพยากร |
| resource_id | String? | ID ของทรัพยากร |
| details | Json? | รายละเอียดเพิ่มเติม |
| ip_address | String? | IP Address |
| user_agent | String? | User Agent |
| created_at | DateTime | วันเวลา |

### notification_queue
คิวแจ้งเตือนที่ส่งไม่สำเร็จ

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| type | String | ประเภท (telegram_new_leave, etc) |
| payload | Json | ข้อมูล |
| status | NotificationStatus | สถานะ |
| retry_count | Int | จำนวนครั้งที่ retry |
| last_error | String? | Error ล่าสุด |
| idempotency_key | String? | Idempotency key (unique) |
| created_at | DateTime | วันที่สร้าง |
| processed_at | DateTime? | วันที่ส่งสำเร็จ |

### fiscal_counter
ตัวนับเลขรันนิ่งตามปีงบประมาณและรอบ (Composite PK)

| Field | Type | Description |
|-------|------|-------------|
| fiscal_year | Int | ปีงบประมาณ พ.ศ. (PK ร่วมกับ round) |
| round | Int | รอบการลา 1=ต.ค.-มี.ค., 2=เม.ย.-ก.ย. (PK ร่วมกับ fiscal_year) |
| last_number | Int | เลขรันนิ่งล่าสุดในรอบนั้น (default: 0) |
| updated_at | DateTime | วันที่แก้ไข |

**หมายเหตุ:** แต่ละรอบมี counter แยกกัน เช่น ปีงบ 69 รอบ 1 กับรอบ 2 นับแยกกัน

---

## Enum Values

### HrRole
```typescript
enum HrRole {
  hr = "hr"
  super_admin = "super_admin"
}
```

### LeaveType
```typescript
enum LeaveType {
  sick = "sick"              // ลาป่วย
  personal = "personal"      // ลากิจส่วนตัว
  maternity = "maternity"    // ลาคลอดบุตร
  religious = "religious"    // ลาทางศาสนา
  other = "other"           // อื่นๆ (ต้องระบุ custom_type_name)
}
```

### HalfDayPeriod
```typescript
enum HalfDayPeriod {
  morning = "morning"      // ครึ่งเช้า
  afternoon = "afternoon"  // ครึ่งบ่าย
}
```

### LeaveStatus
```typescript
enum LeaveStatus {
  pending = "pending"      // รออนุมัติ
  approved = "approved"    // อนุมัติแล้ว
  rejected = "rejected"    // ไม่อนุมัติ
  cancelled = "cancelled"  // ยกเลิก
}
```

### SubmitType
```typescript
enum SubmitType {
  teacher = "teacher"  // ครูยื่นเอง
  hr = "hr"           // HR ยื่นแทน
}
```

### SignatoryRole
```typescript
enum SignatoryRole {
  director = "director"  // ผู้อำนวยการ
  hr_head = "hr_head"   // หัวหน้าฝ่ายบุคคล
}
```

### NotificationStatus
```typescript
enum NotificationStatus {
  pending = "pending"        // รอส่ง
  processing = "processing"  // กำลังส่ง
  success = "success"       // ส่งสำเร็จ
  failed = "failed"         // ส่งไม่สำเร็จ
}
```

---

## สีประเภทการลา (ใช้ตลอดทั้งระบบ)

```typescript
const LEAVE_TYPE_COLORS = {
  sick: {
    light: 'bg-red-100 text-red-700 border-red-200',
    dark: 'dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    dot: 'bg-red-500',
  },
  personal: {
    light: 'bg-blue-100 text-blue-700 border-blue-200',
    dark: 'dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  maternity: {
    light: 'bg-pink-100 text-pink-700 border-pink-200',
    dark: 'dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800',
    dot: 'bg-pink-500',
  },
  religious: {
    light: 'bg-purple-100 text-purple-700 border-purple-200',
    dark: 'dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  other: {
    light: 'bg-slate-100 text-slate-700 border-slate-200',
    dark: 'dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
    dot: 'bg-slate-500',
  },
} as const;
```

## สีสถานะใบลา

```typescript
const LEAVE_STATUS_COLORS = {
  pending: {
    light: 'bg-amber-100 text-amber-700 border-amber-200',
    dark: 'dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  },
  approved: {
    light: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dark: 'dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  },
  rejected: {
    light: 'bg-rose-100 text-rose-700 border-rose-200',
    dark: 'dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
  },
  cancelled: {
    light: 'bg-slate-100 text-slate-700 border-slate-200',
    dark: 'dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
  },
} as const;
```
