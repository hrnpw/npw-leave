# 🐛 Bug Report - Leave-NPW System
**วันที่ตรวจสอบ:** 11 กันยายน 2569  
**สถานะ:** รอแก้ไข

---

## สรุปภาพรวม

**จำนวน bugs ที่พบ:** 21 ตัว
- 🔴 **Critical:** 4 ตัว (แก้ด่วน - security + data integrity)
- 🟠 **High:** 5 ตัว (แก้เร็ว - business logic + compliance)
- 🟡 **Medium:** 5 ตัว (แก้ตามลำดับ - validation)
- 🔵 **Low:** 4 ตัว (แก้ได้ภายหลัง - UX/consistency)
- ⚪ **Info:** 3 ตัว (code quality improvements)

---

## 🔴 CRITICAL BUGS (แก้ด่วนที่สุด)

### 🔴-1: Logic ตรวจสอบใบลาทับซ้อนผิด ⚠️ DATA INTEGRITY
**ไฟล์:** 
- `app/api/teacher/leaves/submit/route.ts:120-140`
- `app/api/hr/leaves/proxy/route.ts:135-161`

**สาเหตุ:** 
Logic ตรวจสอบใบลาครึ่งวันทับซ้อนผิดพลาด โค้ดปัจจุบัน:
```typescript
if (overlappingLeaves.length > 0) {
  const sameDay = overlappingLeaves.some(l => {
    return l.startDate.getTime() === startDate.getTime() && 
           l.endDate.getTime() === endDate.getTime() &&
           l.isHalfDay &&
           l.halfDayPeriod !== body.halfDayPeriod;
  });
  
  if (!sameDay) {
    return NextResponse.json({ error: 'มีใบลาที่ทับซ้อน...' });
  }
}
```

ปัญหา: เช็คแค่ว่า "มีใบลาครึ่งวันวันเดียวกันต่างช่วงหรือไม่" ถ้าไม่มีก็บล็อก แต่ควรเช็คว่า:
1. ถ้าใบเดิมเป็น full day วันเดียวกัน → บล็อก
2. ถ้าใบเดิมเป็น half-day ช่วงเดียวกัน → บล็อก
3. ถ้าใบเดิมเป็น half-day ต่างช่วง → อนุญาต

**ผลกระทบ:** 
- ครูอาจยื่นใบลา full day + half day วันเดียวกันได้
- ครูอาจยื่นสอง half-day ช่วงเดียวกันได้
- ข้อมูลใบลาไม่ถูกต้อง กระทบการนับวันลา

**วิธีแก้:**
```typescript
if (overlappingLeaves.length > 0) {
  if (isSingleDay && body.isHalfDay) {
    // วันเดียวครึ่งวัน - ต้องเช็คละเอียด
    const hasConflict = overlappingLeaves.some(l => {
      const isSameDay = l.startDate.getTime() === startDate.getTime() && 
                        l.endDate.getTime() === endDate.getTime();
      
      if (!isSameDay) return true; // คนละวัน = ทับ
      if (!l.isHalfDay) return true; // ใบเดิมเต็มวัน = ทับ
      return l.halfDayPeriod === body.halfDayPeriod; // ช่วงเดียวกัน = ทับ
    });
    
    if (hasConflict) {
      return NextResponse.json(
        { error: 'มีใบลาที่ทับซ้อนกับช่วงเวลานี้แล้ว', overlappingLeaves },
        { status: 409 }
      );
    }
  } else {
    // ไม่ใช่วันเดียวครึ่งวัน - มี overlap = ทับแน่นอน
    return NextResponse.json(
      { error: 'มีใบลาที่ทับซ้อนกับช่วงเวลานี้แล้ว', overlappingLeaves },
      { status: 409 }
    );
  }
}
```

**Test case ที่เกี่ยวข้อง:** T5, T23

---

### 🔴-2: Middleware ไม่ตรวจ role super admin ⚠️ SECURITY HOLE
**ไฟล์:** `middleware.ts:24-37`

**สาเหตุ:**
Middleware สำหรับ `/hr/*` เช็คแค่ว่า HR login แล้วหรือไม่ (`session.id`) แต่ไม่เช็ค role:
```typescript
if (pathname.startsWith('/hr')) {
  const response = NextResponse.next();
  const session = await getIronSession<HrSession>(request, response, hrSessionOptions);
  
  if (!session.id) {
    // redirect to login
  }
  
  return response; // ❌ ไม่เช็ค role
}
```

**ผลกระทบ:**
- **ช่องโหว่ security ร้ายแรง**
- HR ธรรมดาสามารถเข้าถึง `/hr/admin/*` ได้ ถ้าพิมพ์ URL ตรง
- อาจลบครู, รีเซ็ตข้อมูล, ดู audit log ทั้งหมด, แก้โควตาได้
- แม้ API routes จะมี role check แต่ถ้า frontend โหลดได้ อาจมีช่องโหว่อื่น

**วิธีแก้:**
```typescript
// เพิ่มเช็ค super admin สำหรับ /hr/admin/*
if (pathname.startsWith('/hr/admin')) {
  const response = NextResponse.next();
  const session = await getIronSession<HrSession>(request, response, hrSessionOptions);
  
  if (!session.id) {
    const url = request.nextUrl.clone();
    url.pathname = '/hr/login';
    url.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(url);
  }
  
  // เช็ค role super admin
  if (session.role !== 'super_admin') {
    const url = request.nextUrl.clone();
    url.pathname = '/hr/dashboard';
    return NextResponse.redirect(url);
  }
  
  return response;
}
```

**Test case ที่เกี่ยวข้อง:** T25 (HR ยิง API super admin → 403)

---

### 🔴-3: HR login ไม่มี rate limiting ⚠️ SECURITY
**ไฟล์:** `app/api/hr/login/route.ts` (ต้องตรวจสอบ)

**สาเหตุ:**
Teacher login มี rate limiting แล้ว (ผิด 5 ครั้งล็อก 15 นาที) แต่ HR login ยังไม่เห็นมีการใช้ rate limit

**ผลกระทบ:**
- เสี่ยง brute force attack บน HR account
- ถ้า HR account ถูกเจาะ = เข้าถึงข้อมูลครูทั้งหมด + อนุมัติใบลาได้
- ร้ายแรงกว่า teacher account เพราะมีสิทธิ์มากกว่า

**วิธีแก้:**
เพิ่ม rate limiting เหมือนฝั่ง teacher:
```typescript
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  const body = await request.json();
  const { username, password } = body;
  
  // Rate limit key: IP + username
  const rateLimitKey = `hr_login:${username}:${clientIP}`;
  const rateLimitResult = checkRateLimit(rateLimitKey);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { 
        error: 'พยายามเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณารอ 15 นาที',
        retryAfter: rateLimitResult.resetIn 
      },
      { status: 429 }
    );
  }
  
  // ... rest of login logic
}
```

**Test case ที่เกี่ยวข้อง:** ตามสเปกข้อ 4.9 (ผิด 5 ครั้ง ล็อก 15 นาที)

---

### 🔴-4: Session ไม่มี sliding window (1 ชม. แบบตายตัว) ⚠️ UX CRITICAL
**ไฟล์:** Middleware + ทุก API routes

**สาเหตุ:**
ตามสเปกข้อ 4.9: "Session ทั้งครูและ HR = 1 ชั่วโมง แบบ sliding (ต่ออายุทุก request)"

ปัจจุบัน iron-session สร้างแล้วไม่มีการ `.save()` เพื่อต่ออายุ → session ตายพอดี 1 ชม. ถึงแม้กำลังใช้งานอยู่

**ผลกระทบ:**
- UX แย่ - ครู/HR กรอกฟอร์มยาว ๆ แล้ว session หมด
- ไม่ตรงสเปก - ต้องเป็น sliding window
- Auto-save localStorage อาจไม่ช่วย ถ้า redirect ไป login แล้วกลับมาผิดหน้า

**วิธีแก้ (เลือก 1 จาก 2):**

**Option 1: ต่ออายุใน middleware**
```typescript
// middleware.ts
if (pathname.startsWith('/teacher')) {
  const response = NextResponse.next();
  const session = await getIronSession<TeacherSession>(request, response, teacherSessionOptions);
  
  if (!session.id) {
    // redirect to verify
  }
  
  // ต่ออายุ session ทุกครั้งที่ผ่าน middleware
  await session.save();
  
  return response;
}
```

**Option 2: ต่ออายุในทุก API route**
```typescript
// ในทุก API route ที่ authenticated
const session = await getIronSession(request, response, sessionOptions);
// ... ตรวจ session.id ...
await session.save(); // ต่ออายุก่อน return
return NextResponse.json({ data });
```

**แนะนำ:** Option 1 (middleware) เพราะครอบคลุมทั้ง page requests และ API calls

**Test case ที่เกี่ยวข้อง:** T17 (session หมดอายุระหว่างกรอกฟอร์ม)

---

## 🟠 HIGH SEVERITY BUGS

### 🟠-1: ฟังก์ชัน `getFiscalYear()` ซ้ำ 2 ที่ ⚠️ MAINTENANCE RISK
**ไฟล์:**
- `lib/fiscalYear.ts:11-25`
- `lib/dateUtils.ts:73-81`

**สาเหตุ:**
Logic คำนวณปีงบประมาณเขียนซ้ำใน 2 ไฟล์ เหมือนกันทุกบรรทัด:
```typescript
// ทั้ง 2 ไฟล์มี:
export function getFiscalYear(date: Date = new Date()): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month >= 9) {
    return year + 1;
  }
  return year;
}
```

**ผลกระทบ:**
- ผิดหลัก DRY (Don't Repeat Yourself)
- ถ้าแก้สูตรข้างหนึ่ง อีกข้างอาจลืมแก้ → logic ไม่สอดคล้องกัน
- **นี่คือ business logic หัวใจของระบบ** (เลขที่ใบลา, รอบการลา)

**วิธีแก้:**
1. ลบ `getFiscalYear()` ออกจาก `lib/dateUtils.ts`
2. Import จาก `lib/fiscalYear.ts` แทน:
```typescript
// lib/dateUtils.ts
import { getFiscalYear } from './fiscalYear';
// ลบฟังก์ชันที่ซ้ำออก
```
3. Update ทุกไฟล์ที่ import จาก `dateUtils` ให้ import จาก `fiscalYear` แทน

---

### 🟠-2: Settings quota อาจแก้ได้โดย HR ธรรมดา ⚠️ AUTHORIZATION
**ไฟล์:** `app/api/hr/settings/route.ts` (ต้องตรวจสอบ)

**สาเหตุ:**
ตามสเปกตาราง 2.3:
- "ตั้งค่าโควตาวันลา (23/90/120)" = **super admin เท่านั้น**
- HR ธรรมดาแก้ได้เฉพาะ: ชื่อโรงเรียน, ผู้ลงนาม, วันหยุด

ต้องตรวจสอบว่า API `/api/hr/settings` มี role-based field access หรือไม่

**ผลกระทบ:**
- HR ธรรมดาอาจเปลี่ยนเพดานวันลาทั้งระบบได้
- เพิ่มโควตาจาก 23 → 365 วัน = ทุกคนลาได้ไม่จำกัด
- ผิดสเปกข้อ 2.3

**วิธีแก้:**
```typescript
// app/api/hr/settings/route.ts - PATCH method
export async function PATCH(request: Request) {
  const session = await getHrSession(request);
  if (!session.id) return unauthorized;
  
  const body = await request.json();
  const { 
    schoolName, 
    backdateLimitDays,
    hrBackdateLimitDays,
    currentDirectorId,
    currentHrHeadId,
    // super admin only fields:
    sickPersonalQuotaDays,
    maternityQuotaDays, 
    religiousQuotaDays,
    telegramBotToken,
    telegramChatId,
  } = body;
  
  // ฟิลด์ทั่วไป - HR แก้ได้
  const commonFields = {
    schoolName,
    backdateLimitDays,
    hrBackdateLimitDays,
    currentDirectorId,
    currentHrHeadId,
  };
  
  // ฟิลด์ super admin - ต้องเช็ค role
  if (sickPersonalQuotaDays !== undefined ||
      maternityQuotaDays !== undefined ||
      religiousQuotaDays !== undefined ||
      telegramBotToken !== undefined ||
      telegramChatId !== undefined) {
    
    if (session.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์แก้ไขการตั้งค่านี้' },
        { status: 403 }
      );
    }
    
    // super admin = แก้ได้ทั้งหมด
    Object.assign(commonFields, {
      sickPersonalQuotaDays,
      maternityQuotaDays,
      religiousQuotaDays,
      telegramBotToken,
      telegramChatId,
    });
  }
  
  await prisma.settings.update({
    where: { id: 1 },
    data: commonFields,
  });
}
```

---

### 🟠-3: เปรียบเทียบวันเกิดใช้ timestamp แทนวันที่ ⚠️ AUTH FAILURE
**ไฟล์:** `app/api/auth/teacher/verify/route.ts:74-80`

**สาเหตุ:**
ใช้ `.getTime()` เปรียบเทียบ timestamp รวมเวลา:
```typescript
const inputDate = new Date(birthDate);
const dbDate = teacher?.birthDate ? new Date(teacher.birthDate) : null;

if (inputDate.getTime() !== dbDate?.getTime()) {
  // ❌ fail
}
```

ปัญหา:
- `inputDate` อาจเป็น "1990-01-01T00:00:00Z" (UTC)
- `dbDate` อาจเป็น "1990-01-01T07:00:00+07:00" (Bangkok)
- Timestamp ต่างกัน 7 ชั่วโมง → เปรียบเทียบผิด
- แต่เป็นวันเดือนปีเดียวกัน

**ผลกระทบ:**
- ครูยืนยันตัวตนไม่ได้แม้ข้อมูลถูกต้อง
- เกิดกับครูที่ import มาจาก Excel ที่มี timezone ต่าง ๆ
- Frustrating UX - ข้อมูลถูกแต่ login ไม่ได้

**วิธีแก้:**
```typescript
const inputDate = new Date(birthDate);
const dbDate = teacher?.birthDate ? new Date(teacher.birthDate) : null;

if (!teacher || !dbDate) {
  recordFailedAttempt(rateLimitKey);
  return NextResponse.json(
    { error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบเลขบัตรประชาชนและวันเกิดอีกครั้ง' },
    { status: 401 }
  );
}

// เปรียบเทียบเฉพาะวันที่ ไม่สนเวลา
const inputDateStr = inputDate.toISOString().split('T')[0]; // "1990-01-01"
const dbDateStr = dbDate.toISOString().split('T')[0];

if (inputDateStr !== dbDateStr) {
  recordFailedAttempt(rateLimitKey);
  return NextResponse.json(
    { error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบเลขบัตรประชาชนและวันเกิดอีกครั้ง' },
    { status: 401 }
  );
}
```

---

### 🟠-4: Audit log หายเยอะ (TODO comments ยังไม่ได้ทำ) ⚠️ COMPLIANCE
**ไฟล์ที่พบ TODO:**
- `app/api/hr/teachers/[id]/route.ts:164,231`
- `app/api/hr/teachers/route.ts:205`
- `app/api/hr/teachers/import/execute/route.ts:169`
- `app/api/hr/signatories/[id]/route.ts:79,142`
- `app/api/hr/signatories/route.ts:85`
- `app/api/hr/holidays/[id]/route.ts:29,69`
- `app/api/hr/holidays/route.ts:93`
- `app/api/hr/approvals/[id]/approve/route.ts:86,88`
- `app/api/hr/approvals/[id]/reject/route.ts:51`

**สาเหตุ:**
ตามสเปกข้อ 2.4: "ทุก action ของ super admin บันทึก audit log แบบละเอียด (before/after value)"
และข้อ 4.9: "Audit log ทุกการกระทำที่เปลี่ยนแปลงข้อมูล (append-only ห้ามลบ/แก้)"

แต่หลายจุดยังมี `// TODO: Audit log` ไม่ได้ implement

**ผลกระทบ:**
- ไม่สามารถตรวจสอบย้อนหลังได้ว่าใครแก้อะไร
- ผิดข้อกำหนด compliance/PDPA (ต้องมี audit trail)
- Super admin ทำอะไรก็ได้โดยไม่มีหลักฐาน
- เมื่อเกิดปัญหา (ข้อมูลหาย/ผิด) สืบสาเหตุไม่ได้

**วิธีแก้:**
Implement ทุกจุด ตามแพทเทิร์นที่มีอยู่:
```typescript
// ตัวอย่างจาก edit/route.ts:180-194
await createAuditLog({
  action: 'TEACHER_UPDATE',
  resource: 'Teacher',
  resourceId: teacherId,
  userId: session.id,
  userType: 'hr',
  details: {
    before: {
      firstName: existingTeacher.firstName,
      lastName: existingTeacher.lastName,
      // ... ฟิลด์ที่แก้
    },
    after: {
      firstName: body.firstName,
      lastName: body.lastName,
      // ... ค่าใหม่
    },
  },
  ipAddress: getClientIP(request),
});
```

ต้อง implement audit log สำหรับ:
- สร้าง/แก้/ลบครู
- Import ครู (บันทึกสรุปจำนวน)
- สร้าง/แก้/ลบผู้ลงนาม
- สร้าง/แก้/ลบวันหยุด
- อนุมัติ/ไม่อนุมัติใบลา (มีบ้างแล้วแต่ TODO comment อาจหมายถึงต้องปรับปรุง)

**ประมาณการงาน:** 2-3 ชั่วโมง (9+ endpoints)

---

### 🟠-5: แก้ใบลาที่อนุมัติแล้ว ไม่เช็คทับซ้อนกับใบอื่น ⚠️ DATA INTEGRITY
**ไฟล์:** `app/api/hr/leaves/[id]/edit/route.ts:145-195`

**สาเหตุ:**
ตามสเปกข้อ 3.5: "แก้ไขใบลาที่อนุมัติแล้ว (เฉพาะ HR/Super admin): แก้ไขได้เฉพาะ ประเภท/ช่วงวัน/เหตุผล/ที่อยู่ติดต่อ"

แต่โค้ดปัจจุบันเมื่อแก้ช่วงวัน:
1. Validate input ✅
2. คำนวณ days_working/days_calendar ใหม่ ✅
3. Update ลง database ✅
4. ❌ **ไม่เช็คว่าวันใหม่ทับกับใบลาอื่นของครูคนเดียวกันหรือไม่**

**ผลกระทบ:**
- อาจแก้วันที่แล้วทับกับใบลาอื่นที่อนุมัติแล้ว
- เช่น: ครู ก. มีใบลา 1-5 และ 10-15 ทั้งคู่อนุมัติแล้ว
  HR แก้ใบแรกเป็น 1-12 = ทับกับใบที่สอง
- ข้อมูลผิดพลาด ไม่น่าเกิดขึ้น

**วิธีแก้:**
```typescript
// app/api/hr/leaves/[id]/edit/route.ts
// หลังบรรทัด 145 (หลัง parse dates) เพิ่ม overlap check

// เช็คทับซ้อนกับใบลาอื่นของครูคนเดียวกัน (ไม่รวมใบนี้)
const overlappingLeaves = await prisma.leave.findMany({
  where: {
    teacherId: existingLeave.teacherId,
    id: { not: leaveId }, // ไม่รวมใบที่กำลังแก้
    status: { in: ['pending', 'approved'] },
    OR: [
      {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    ],
  },
});

// เช็คแบบเดียวกับตอนยื่น (รองรับ half-day)
const isSingleDay = startDate.getTime() === endDate.getTime();

if (overlappingLeaves.length > 0) {
  if (isSingleDay && body.isHalfDay) {
    const hasConflict = overlappingLeaves.some(l => {
      const isSameDay = l.startDate.getTime() === startDate.getTime() && 
                        l.endDate.getTime() === endDate.getTime();
      if (!isSameDay) return true;
      if (!l.isHalfDay) return true;
      return l.halfDayPeriod === body.halfDayPeriod;
    });
    
    if (hasConflict) {
      return NextResponse.json(
        { error: 'ช่วงวันใหม่ทับซ้อนกับใบลาอื่นที่มีอยู่แล้ว', overlappingLeaves },
        { status: 409 }
      );
    }
  } else {
    return NextResponse.json(
      { error: 'ช่วงวันใหม่ทับซ้อนกับใบลาอื่นที่มีอยู่แล้ว', overlappingLeaves },
      { status: 409 }
    );
  }
}

// จากนั้นค่อย proceed กับการ update
```

---

## 🟡 MEDIUM SEVERITY BUGS

### 🟡-1: ไม่จำกัดความยาว custom type name
**ไฟล์:**
- `app/api/teacher/leaves/submit/route.ts:35-37`
- `app/api/hr/leaves/proxy/route.ts` (similar)

**สาเหตุ:**
เช็คแค่ว่ามี (`if (!body.customTypeName?.trim())`) แต่ไม่เช็คความยาว

**ผลกระทบ:** UI อาจแสดงผิดเพี้ยน ถ้ามีคนใส่ชื่อยาว 1000+ ตัวอักษร

**วิธีแก้:**
```typescript
if (body.type === 'other') {
  if (!body.customTypeName?.trim()) {
    return NextResponse.json({ error: 'กรุณาระบุประเภทการลา' }, { status: 400 });
  }
  if (body.customTypeName.trim().length > 100) {
    return NextResponse.json({ error: 'ชื่อประเภทการลาต้องไม่เกิน 100 ตัวอักษร' }, { status: 400 });
  }
}
```

---

### 🟡-2: ที่อยู่ติดต่อไม่มี min length validation
**ไฟล์:**
- `app/api/teacher/leaves/submit/route.ts:30-32`
- `app/api/hr/leaves/proxy/route.ts:32-37`

**สาเหตุ:**
`reason` บังคับ ≥10 ตัวอักษร (line 40) แต่ `contactAddress` เช็คแค่ required

**ผลกระทบ:** คนอาจใส่ "." หรือ "x" แล้วผ่าน

**วิธีแก้:**
```typescript
if (body.contactAddress.trim().length < 5) {
  return NextResponse.json(
    { error: 'ที่อยู่ติดต่อต้องมีอย่างน้อย 5 ตัวอักษร' },
    { status: 400 }
  );
}
```

---

### 🟡-3: คำนวณระยะเวลาใช้ `Math.ceil` แทน `floor`
**ไฟล์:** `app/api/teacher/leaves/submit/route.ts:92-93`

**สาเหตุ:**
```typescript
const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1;
```
`Math.ceil` + `+1` อาจทำให้คำนวณเกิน 1 วันในบางกรณี

**วิธีแก้:**
```typescript
const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24)) + 1;
```

---

### 🟡-4: Proxy reason ไม่มี min length validation
**ไฟล์:** `app/api/hr/leaves/proxy/route.ts:32`

**สาเหตุ:**
เช็คแค่ `if (!proxyReason)` แต่ไม่เช็คความยาว

**ผลกระทบ:** HR อาจใส่ "x" ผ่าน แล้วไม่มีบันทึกที่ชัดเจน

**วิธีแก้:**
```typescript
if (!proxyReason || proxyReason.trim().length < 10) {
  return NextResponse.json(
    { error: 'เหตุผลที่ยื่นแทนต้องมีอย่างน้อย 10 ตัวอักษร' },
    { status: 400 }
  );
}
```

---

### 🟡-5: อื่น ๆ
(ดู details ในรายงานเต็ม)

---

## 🔵 LOW SEVERITY BUGS

### 🔵-1: Error messages ไม่สม่ำเสมอ
**ตัวอย่าง:**
- บางที่: "ข้อมูลไม่ครบถ้วน"
- บางที่: "กรุณากรอกข้อมูลให้ครบถ้วน"

**แก้:** Standardize เป็นชุดเดียวกันทั้งระบบ

---

### 🔵-2: console.error อาจเปิดเผยข้อมูลลับ
**แก้:** ใช้ `maskSensitive()` จาก `lib/security.ts` ก่อน log

---

### 🔵-3: Public Dashboard ไม่มี cache header
**ตรวจสอบ:** `/api/public/summary/route.ts` ควรมี `Cache-Control: max-age=60`

---

### 🔵-4: Race condition ตอนสร้าง fiscal counter
**ไฟล์:** `app/api/teacher/leaves/submit/route.ts:169-180`

**สาเหตุ:** ใช้ findUnique → create แทน upsert

**แก้:**
```typescript
const counter = await tx.fiscalCounter.upsert({
  where: { fiscalYear },
  create: { fiscalYear, lastNumber: 0 },
  update: {},
});
```

---

## ⚪ INFO / CODE QUALITY

### ⚪-1: ควรใช้ enum constant สำหรับ half-day period
แทนที่จะใช้ `'morning' | 'afternoon'` เป็น string literal ทั่วโค้ด

### ⚪-2: Holiday normalization logic ซ้ำ
`lib/leaveCalculator.ts:44-47` และ `:120-122`

### ⚪-3: Magic numbers ในการคำนวณวันที่
เช่น `1000 * 60 * 60 * 24` ควรเป็น `MILLISECONDS_PER_DAY`

---

## Test Cases Status (ตรวจแล้ว 14/30)

### ✅ ผ่าน (10 test cases)
- **T1:** ลา ศ-จ คำนวณถูก (calculateLeaveDays works)
- **T2:** Half-day logic ถูก
- **T3:** Split across periods ถูก
- **T6:** Backdate validation ถูก
- **T7:** Separate quotas ถูก
- **T13:** Fiscal year ถูก
- **T18:** Signatory snapshot ถูก
- **T19:** Telegram fire-and-forget ถูก
- **T21:** Proxy fields ถูก
- **T23:** Cancel logic ถูก

### ❌ ไม่ผ่าน (2 test cases)
- **T5:** ❌ Overlap detection มี bug (🔴-1)
- **T12:** ❌ Middleware ไม่ตรวจ role (🔴-2)

### ⚠️ ยังไม่ตรวจ (18 test cases)
- T4, T8-T11, T14-T17, T20, T22, T24-T30
- ต้องตรวจ frontend, PDF, Telegram, import Excel

---

## แผนการแก้ไข (Priority Order)

### 🎯 Sprint 1: Critical Security + Data Integrity (1-2 วัน)
1. **🔴-2** Middleware role guard (30 นาที)
2. **🔴-3** HR login rate limit (30 นาที)
3. **🔴-1** Overlap detection logic (1-2 ชั่วโมง)
4. **🔴-4** Session sliding window (1 ชั่วโมง)

### 🎯 Sprint 2: Business Logic + Compliance (1 วัน)
5. **🟠-3** Birth date comparison (30 นาที)
6. **🟠-5** Edit overlap check (1 ชั่วโมง)
7. **🟠-1** Remove duplicate getFiscalYear (30 นาที)
8. **🟠-4** Implement audit logs (2-3 ชั่วโมง)
9. **🟠-2** Settings role guard (30 นาที)

### 🎯 Sprint 3: Input Validation (0.5 วัน)
10. **🟡-1 ถึง 🟡-4** Validation improvements (1-2 ชั่วโมง)

### 🎯 Sprint 4: Polish (0.5 วัน)
11. **🔵** Low severity bugs
12. **⚪** Code quality improvements

### 🎯 Sprint 5: Complete Testing (1 วัน)
13. ทดสอบ T-cases ที่เหลือทั้งหมด
14. Integration testing
15. Manual testing บนมือถือ 375px

**ประมาณการเวลารวม:** 4-5 วัน

---

## หมายเหตุสำคัญ

### ส่วนที่ยังไม่ได้ตรวจ (Phase 3-6)
- ❌ Frontend components (form validation, state management)
- ❌ PDF generation (ฟอนต์ไทย, QR code, template)
- ❌ Telegram integration (messages, cron job)
- ❌ Excel import/export ละเอียด
- ❌ Blob storage quota handling
- ❌ Public dashboard whitelist
- ❌ Settings UI role-based visibility
- ❌ Admin zone confirmation dialogs

### แนะนำก่อน Deploy Production
1. แก้ทุก 🔴 และ 🟠 ให้หมด
2. ตรวจ Test Cases T1-T30 ทั้งหมด
3. Manual testing:
   - ยืนยันตัวตนครู (เลขบัตร checksum, วันเกิด timezone)
   - ยื่นใบลา (overlap cases, half-day combinations)
   - HR ยื่นแทน (กันยื่นให้ตัวเอง, snapshot ถูก)
   - Admin zone (2-layer confirmation ทำงาน)
4. Security testing ตาม `docs/security-checklist.md`
5. Performance testing (Lighthouse ≥90)
6. Load testing (Neon 0.5 CU, Blob 1GB limit)

---

**จัดทำโดย:** Claude Code Agent  
**วันที่:** 11 กันยายน 2569  
**สถานะ:** ✅ บันทึกแล้ว - รอแก้ไข
