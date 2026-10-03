# Plan: เพิ่ม role ผู้อำนวยการ + อนุมัติใบลา 2 ขั้น

สถานะ (2026-10-03): deploy เสร็จแล้ว commit `c9fc1da` push ขึ้น `master` แล้ว และ `migrate deploy` ลง Neon `production` แล้ว (มี backup branch `backup-before-director`) `.env` ชี้กลับมาที่ `dev` แล้ว
- ที่เหลือ: เช็ค Vercel deployment, สร้างบัญชี ผอ. ผ่านหน้า Admin, ทดสอบสั้นๆ บน production
- Rollback: Vercel Instant Rollback (DB ไม่ต้องย้อน เพราะ migration เพิ่มอย่างเดียว)

## Flow

```
ครูยื่น / HR ยื่นแทน → pending (รอตรวจสอบ)
  ├─ HR ตรวจผ่าน → reviewed (รอ ผอ. อนุมัติ) → push แจ้งครู
  │    ├─ ผอ. อนุมัติ    → approved → push แจ้งครู
  │    ├─ ผอ. ไม่อนุมัติ → rejected → push แจ้งครู
  │    └─ HR ดึงกลับ     → pending  (ทำได้ระหว่างที่ ผอ. ยังไม่ตัดสิน)
  └─ HR ตีกลับ → rejected → push แจ้งครู
```

| การกระทำ | จากสถานะ | ไปสถานะ | ใครทำได้ |
|---|---|---|---|
| ตรวจผ่าน | pending | reviewed | hr, super_admin |
| ตีกลับ (ต้องมีเหตุผล ≥ 10 ตัวอักษร) | pending | rejected | hr, super_admin |
| ดึงกลับ | reviewed | pending | hr, super_admin |
| อนุมัติ | reviewed | approved | director, super_admin |
| ไม่อนุมัติ (ต้องมีเหตุผล ≥ 10 ตัวอักษร) | reviewed | rejected | director, super_admin |
| ครูยกเลิก | pending เท่านั้น | cancelled | เจ้าของใบลา |
| ย้อนสถานะ (danger zone) | approved | pending (ล้างข้อมูลตรวจ/อนุมัติ) | super_admin |

ข้อตกลงหลัก
- super_admin ทำได้ทุกขั้น
- ใบลาที่ HR ยื่นแทนครู (proxy) ต้องผ่าน flow เดียวกัน ไม่มีการข้ามขั้น
- ตรวจและอนุมัติทีละใบเท่านั้น ไม่มีการเลือกหลายใบแล้วกดทีเดียว
- ผอ. กดอนุมัติอย่างเดียว ไม่ต้องใส่ความเห็น
- ไม่แจ้ง ผอ. เมื่อมีใบใหม่เข้ามา ผอ. เข้ามาดูเอง
- ครูไม่เห็นชื่อคนตรวจและคนอนุมัติ เห็นแค่สถานะและเวลา

## นอก scope (ไม่แตะ)
- PDF ทั้ง `lib/pdf/*` และฟิลด์ snapshot ทั้งหมด ชื่อ ผอ. ใน PDF ยังดึงจาก `Settings.currentDirectorId` เหมือนเดิม
- `proxy.ts` ยังไม่เพิ่มการเช็ค role รอบนี้ (เก็บไว้ทำทีหลัง)
- ไม่ต้องเพิ่ม web push หรือ Telegram ให้ ผอ.

## 1. Database (`prisma/schema.prisma`)
- `enum HrRole` เพิ่มค่า `director`
- `enum LeaveStatus` เพิ่มค่า `reviewed`
- `Leave` เพิ่มฟิลด์ `reviewedAt DateTime?`, `reviewedById String?`, `approvedById String?` (relation ไปที่ `HrUser`)
- ใบลาที่เป็น `pending` อยู่ตอน deploy ไม่ต้องย้ายข้อมูล ใบเหล่านี้จะรอ HR ตรวจตาม flow ใหม่

## 2. สิทธิ์ (Roles)
- สร้าง `lib/roles.ts` ไว้รวม type `HrRole`, label ภาษาไทย และ helper `canReview()`, `canApprove()`, `canManage()`
- ใช้ helper เหล่านี้แทน type `'hr' | 'super_admin'` ที่เขียนซ้ำไว้ตาม component
- `lib/session.ts:17` เพิ่ม `'director'`
- ทำ audit logger ที่มีอยู่ 2 ไฟล์ให้ type ตรงกัน และรองรับ `director`

สิ่งที่ ผอ. ใช้ได้
- ทุกอย่างเหมือน hr (`canManage` รวม `director`) บวกกับหน้าอนุมัติใบลา
- ใช้ไม่ได้: ตรวจใบลา (`canReview` คงไว้แค่ hr, super_admin เพื่อให้การอนุมัติ 2 ขั้นยังมีผล), หน้า admin และ danger zone (super_admin เท่านั้นเหมือนเดิม)

ต้องปิดทั้งในเมนู UI และบล็อกที่ API (คืน 403) เพราะ `proxy.ts` ไม่ครอบ `/api/*`

## 3. API
ใหม่
- `POST /api/hr/reviews/[id]/approve` เปลี่ยน pending → reviewed และส่ง push
- `POST /api/hr/reviews/[id]/reject` เปลี่ยน pending → rejected และส่ง push
- `POST /api/hr/reviews/[id]/recall` เปลี่ยน reviewed → pending
- `GET /api/hr/reviews/pending` คืนรายการใบที่ `pending`

แก้
- `approvals/[id]/approve` และ `approvals/[id]/reject` เช็คว่าเป็น `canApprove` และรับเฉพาะใบที่ `reviewed`
- `approvals/pending` คืนเฉพาะใบที่ `reviewed`
- `leaves/pendingCount` คืนยอดตาม role ของคนที่ล็อกอิน
- ทุกการเปลี่ยนสถานะใช้ `updateMany({ where: { id, status: <สถานะเดิม> } })` ถ้า `count === 0` ให้คืน 409 กันการกดซ้ำพร้อมกัน
- รวม logic การเปลี่ยนสถานะไว้ที่ `lib/leaveWorkflow.ts` (state machine) แล้วให้ทุก route เรียกใช้ที่นี่
- Audit log: `REVIEW_LEAVE`, `RECALL_REVIEW`, `REJECT_LEAVE` (ใส่ `details.stage = 'review' | 'approval'`), `APPROVE_LEAVE` และแก้ `userType` ให้มาจาก role จริง ไม่ hard-code
- `admin/danger/revert-leave-status` ย้อนกลับเป็น pending แล้วล้าง `reviewedAt`, `reviewedById`, `approvedById` ด้วย
- `api/hr/admin/users` (สร้าง/แก้ user) รับ role `director`

## 4. Web push แจ้งครู
| เหตุการณ์ | หัวข้อ | ข้อความ |
|---|---|---|
| HR ตรวจผ่าน (ใหม่) | ใบลาผ่านการตรวจสอบแล้ว | ใบลาเลขที่ {leaveNo} ผ่านการตรวจสอบแล้ว รอผู้อำนวยการอนุมัติ |
| ผอ. อนุมัติ | ใช้ข้อความเดิม | ใช้ข้อความเดิม |
| HR ตีกลับ หรือ ผอ. ไม่อนุมัติ | ใช้ข้อความเดิม | ใช้ข้อความเดิม |

- ทุกแบบใช้ `tag: leave-{id}` และ `url: /teacher/leaves/{id}` เหมือนเดิม
- ข้อความไม่ใส่ชื่อคนตรวจหรือคนอนุมัติ
- ตอน HR ดึงกลับ ไม่ต้องส่ง push

## 5. หน้าจอ
หน้าใหม่ `/hr/reviews` สำหรับ HR
- แยกจาก `ApprovalsClient`
- มีปุ่ม ตรวจผ่าน / ตีกลับ
- มีแท็บ "ส่งต่อแล้ว" ที่มีปุ่มดึงกลับ

หน้า `/hr/approvals` สำหรับ ผอ.
- แสดงใบที่ `reviewed`
- มีปุ่ม อนุมัติ / ไม่อนุมัติ
- เอาปุ่มเลือกหลายใบแล้วอนุมัติทีเดียวออก (`ApprovalsClient.tsx:313`)

สิทธิ์ดูข้ามหน้า (ตกลง 2026-10-03)
- hr เข้า `/hr/approvals` ได้แต่ดูอย่างเดียว (ไม่มีปุ่มอนุมัติ/ไม่อนุมัติ)
- director เข้า `/hr/reviews` ได้แต่ดูอย่างเดียว (ไม่มีปุ่มตรวจผ่าน/ตีกลับ/ดึงกลับ)
- ดังนั้น `GET /api/hr/reviews/pending` ต้องให้ director อ่านได้ ส่วน POST ของ reviews และ approvals ยังคืน 403 ตามเดิม
- ส่วนรายการที่ใช้ร่วมกัน (ค้นหา, กรอง, รายละเอียด, ไฟล์แนบ) แยกเป็น component กลาง แต่ละหน้าใส่ปุ่มของตัวเอง
- ไม่มีปุ่มตรวจ/อนุมัติในหน้า `/hr/leaves/[id]`

เมนูและ badge
- `HrSidebar`, `HrBottomNav`, `HrMenuClient` แสดงเมนูตาม role และเพิ่ม label "ผู้อำนวยการ"
- เมนู sidebar: hr เห็น "ตรวจใบลา" เป็นหลัก, director เห็น "อนุมัติใบลา" เป็นหลัก, ทั้งสองเห็นอีกหน้าในเมนูได้ (ดูอย่างเดียว), super_admin เห็นทั้งสองแบบใช้งานได้ แต่ละเมนูมี badge ของตัวเอง (ตรวจ = pending, อนุมัติ = reviewed) `pendingCount` ต้องคืนทั้งสองยอด
- `HrBottomNav` ช่องเดียว: hr และ super_admin → `/hr/reviews` "รอตรวจสอบ", director → `/hr/approvals` "รออนุมัติ"
- `HrLayoutWrapper` badge แสดงยอดตาม role (super_admin ใช้ยอด pending)
- Dashboard quick action (`HrDashboardClient.tsx:294`) ลิงก์และยอดตาม role แบบเดียวกับ bottom nav

ใบที่ rejected
- ฝั่งครูแสดง "ไม่อนุมัติ" พร้อมเหตุผลเหมือนเดิม
- ฝั่ง HR (`LeaveDetailClient`) แสดงว่าถูกตีกลับขั้นไหน โดยอ่านจาก audit `details.stage`

ป้ายสถานะใน `types/leave.ts`
- `pending` = รอตรวจสอบ
- `reviewed` = รอ ผอ. อนุมัติ (กำหนดสีใหม่ให้ด้วย)

จุดที่ hard-code ป้ายสถานะไว้ ต้องเปลี่ยนมาใช้ `types/leave.ts`
- `HrDashboardClient.tsx:835`
- `AllLeavesClient.tsx:181`
- `api/hr/reports/all-leaves/route.ts:130`
- `TeachersClient.tsx:979`
- `api/check/[leave_no]/route.ts:14` (เพิ่ม `cancelled` ด้วย)
- `app/check/[leave_no]/page.tsx:69`

ตัวกรองสถานะ เพิ่ม `reviewed`
- `LeavesClient.tsx:519, 635`
- `api/hr/leaves/route.ts`
- `api/hr/leaves/stats`
- `reports/all-leaves`

หน้า Admin
- ฟอร์มสร้างและแก้ user เพิ่มตัวเลือก role ผู้อำนวยการ (`AdminClient.tsx:595, 1222, 1341`)

หน้าใบลาของครู
- ปุ่มยกเลิกแสดงเฉพาะใบที่ `pending` (`TeacherLeaveDetailClient.tsx:189` และหน้า `teacher/leaves/[id]`)

Telegram
- สรุปรายวัน (`api/cron/daily-summary`) แยกยอด "รอตรวจสอบ" กับ "รอ ผอ. อนุมัติ"
- แจ้งใบใหม่ใช้แบบเดิม

## 6. จุดที่ต้องนับ `reviewed` เหมือน `pending`
- โควตาและวันลาซ้อนกัน
  - `api/teacher/leaves/quota:35`
  - `check-overlap:34`
  - `teacher/leaves/submit:144`
  - `hr/leaves/proxy:142`
  - `approvals/pending:148`
  - `hr/teachers/[id]/summary:50`
- ไทม์ไลน์ของครู
  - `api/teacher/leaves/timeline:48`
  - `timeline-lazy:29`

รายงาน, dashboard, heatmap และ PDF นับเฉพาะ `approved` อยู่แล้ว ไม่ต้องแก้

## 7. ข้อมูลทดสอบ
- `prisma/seed.ts` เพิ่ม user `director001` (role `director`) รันได้บน Neon `dev` เท่านั้น ห้ามรันกับ `production`
- Production ให้ super_admin สร้างบัญชี ผอ. ผ่านหน้า Admin
- push subscription และ Telegram บน `dev` ไม่ลบ แจ้งเตือนจริงได้ ทดสอบด้วยใบของครูทดสอบ เพื่อไม่ให้ครูจริงได้ push ของใบที่ไม่ได้เปลี่ยนบน prod

## 8. Database environment (Neon + Git)

| | ใช้ |
|---|---|
| DB ระหว่างพัฒนา | Neon `dev` (ก๊อปจาก `production`) ผ่าน `.env` บนคอม |
| DB production | Neon `production` (Vercel ใช้ตัวนี้ ไม่แตะ Vercel env) |
| Git | `master` ทำงานในเครื่องเท่านั้น ไม่ push จนกว่าจะ migrate `production` เสร็จ |
| ทดสอบ | บนคอมที่ `localhost:3000` ด้วย `npm run dev` และรัน `npm run build` ให้ผ่านก่อน push |

สถานะ
- Baseline `prisma/migrations/0_init` ทำแล้ว (ชุดเก่าย้ายไป `prisma/migrations_archive`)
- Neon `dev` สร้างแล้ว และ `.env` ชี้ไปที่ `dev` แล้ว (`DATABASE_URL` = Pooled, `DIRECT_URL` = Direct)
- มี Neon backup branch แล้ว 1 ชุด

ข้อตกลง
- ห้าม `git push` ระหว่างพัฒนา เพราะ Vercel deploy จาก GitHub ทันที ขณะที่ `production` ยังไม่ได้ migrate
- Build script คงเดิม (`prisma generate && next build`) ไม่เพิ่ม `migrate deploy`
- `prisma migrate dev` และ seed ใช้ได้กับ `dev` เท่านั้น ห้ามรัน `migrate dev` หรือ `db push` กับ `production`
- โฟลเดอร์ migration จาก `prisma migrate dev` commit พร้อมโค้ดทั้งหมดตอนพัฒนาเสร็จ (ก่อน `migrate deploy`)
- Vercel เกี่ยวตอน push อย่างเดียว build script ไม่รัน migration จึงต้อง `migrate deploy` ใส่ `production` ก่อน push (ข้อ 11)
- ใช้คอมเครื่องเดียว

## 9. ลำดับการทำงาน
1. ✅ Schema, migration (`migrate dev` บน Neon `dev`) และ seed
2. ✅ `lib/roles.ts`, `lib/leaveWorkflow.ts` พร้อม unit test
3. ✅ นับ `reviewed` ในโควตา, การเช็ควันซ้อน และไทม์ไลน์ (ทำก่อน API เพื่อไม่ให้ทดสอบสับสน)
4. ✅ API ฝั่ง review และ approval รวมถึง push (POST ของ reviews/approvals เช็คสิทธิ์คืน 403 ส่วน GET `reviews/pending` เปิดให้ทุก role ของ HR อ่านได้ ตามข้อตกลงดูข้ามหน้า)
5. ✅ ให้ `director` ใช้งานจัดการได้เหมือน hr (`canManage`), แก้ `userType` ใน leaves edit/cancel ให้มาจาก role จริง, `admin/users` รับ role `director`
6. ✅ UI: หน้า reviews/approvals, เมนู, ป้ายสถานะ, ตัวกรอง, Admin, ปุ่มยกเลิกของครู
7. ✅ ทดสอบ (ข้อ 10)
8. ✅ Deploy (ข้อ 11) ทำข้อ 1-5 แล้ว เหลือข้อ 6 สร้างบัญชี ผอ.

## 10. การทดสอบ
- Unit test (vitest) สำหรับ `leaveWorkflow` ทุก transition ทั้งที่ทำได้และที่ห้าม และสำหรับ helper ใน `lib/roles.ts`
- รัน `npm run build` ให้ผ่าน
- ทดสอบด้วยมือบนคอม (Neon `dev`) ด้วย user 4 แบบ (ครู, hr, director, super_admin)
  - ยื่นใบลา → ตรวจผ่าน → อนุมัติ (ได้รับ push 2 ครั้ง)
  - HR ตีกลับ
  - ผอ. ไม่อนุมัติ
  - HR ดึงกลับ
  - ครูยกเลิก (ทำได้เฉพาะ pending)
  - ผอ. เปิดหน้าตรวจใบลาได้แต่ไม่มีปุ่ม, POST `/api/hr/reviews/*` ต้องได้ 403, hr เปิดหน้าอนุมัติได้แต่ไม่มีปุ่ม, POST `/api/hr/approvals/*` ต้องได้ 403
  - ผอ. เข้าหน้า admin หรือ danger zone (ต้องได้ 403 หรือถูก redirect)
  - โควตานับใบที่ reviewed ด้วย
  - กดซ้ำพร้อมกัน (ต้องได้ 409)

## 11. Deploy ขึ้น production
1. แจ้ง HR และ ผอ. ล่วงหน้าว่า flow จะเปลี่ยน และใบที่ค้าง pending อยู่ต้องให้ HR ตรวจก่อน
2. สร้าง Neon backup branch ใหม่จาก `production` ชื่อ `backup-before-director` (ใช้เป็นแผน rollback เพราะลบค่า enum ออกไม่ได้ง่าย)
3. ชี้ `.env` ไปที่ `production` ชั่วคราว แล้วรัน `npx prisma migrate deploy` (ห้ามใช้ `migrate dev`)
4. ชี้ `.env` กลับไปที่ `dev`
5. `git push` ขึ้น `master` แล้ว Vercel จะ deploy
6. สร้างบัญชี ผอ. ผ่านหน้า Admin

Migration รอบนี้เพิ่มค่า enum และคอลัมน์อย่างเดียว ไม่ลบอะไร ช่วงไม่กี่นาทีระหว่างข้อ 3 กับ deploy เสร็จ โค้ดเก่าจึงไม่พัง

## งานที่พักไว้
- `proxy.ts` เช็ค role
