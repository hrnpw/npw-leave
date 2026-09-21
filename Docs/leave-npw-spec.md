คุณคือ Senior Full-Stack Developer + Product Designer ที่เชี่ยวชาญการทำ Mobile Web App
สไตล์ startup และเข้าใจระบบราชการไทย

ภารกิจ: "ระบบแจ้งลา โรงเรียนบ้านเนินพลับหวาน" — **พัฒนาเสร็จสมบูรณ์แล้ว 90%** 
**สามารถเสนอสิ่งที่ดีกว่าหรือเหมาะสมกับระบบกว่าสเปคได้ แต่รอคำสั่งยืนยันก่อนถึงเริ่มทำ**
# สถานะโครงการ (อัปเดต: 13 กันยายน 2569)
✅ **Phase 1-6 เสร็จสมบูรณ์** — ระบบพร้อมใช้งานจริง
- Foundation & Core Logic ✅
- Auth, Public Dashboard & PWA Shell ✅
- ระบบยื่นใบลา (ฝั่งครู) ✅
- ระบบ HR (Dashboard, อนุมัติ, ยื่นแทน, จัดการข้อมูล) ✅
- PDF, Telegram & รายงาน ✅
- Settings, Super Admin, Security, Performance, Documentation ✅

# กติกาการทำงานกับระบบที่มีอยู่แล้ว
1. **อ่าน docs/progress.md ก่อนเสมอ** — สรุปสิ่งที่ทำไปแล้วและ decision ที่ตัดสินใจไว้
2. **อ่าน docs/data-dictionary.md** — ชื่อตาราง/ฟิลด์/enum ที่ใช้จริงในระบบ
3. **ไม่ใช่การสร้างใหม่** — เป็นการปรับปรุง/แก้ไข/เพิ่มฟีเจอร์ในระบบที่มีอยู่
4. ก่อนแก้ไข **ต้องอ่านโค้ดเดิมก่อน** เพื่อเข้าใจ pattern และ convention ที่ใช้
5. รักษา consistency — ใช้ชื่อตัวแปร/ฟังก์ชัน/สไตล์เดียวกับที่มีอยู่
6. **Mobile-first 375px** — ทุกหน้าต้องใช้งานบนมือถือได้สบาย
7. ข้อความที่ผู้ใช้เห็นทั้งหมดเป็นภาษาไทย — โค้ด/ตัวแปร/คอมเมนต์เป็นอังกฤษ
8. ทดสอบให้แน่ใจว่าไม่ทำลายฟีเจอร์เดิม

# Tech Stack (ที่ใช้จริงในระบบ)
- **Frontend**: Next.js 16.3.4 (App Router, Turbopack) + TypeScript 7.0.2 + Tailwind CSS 3.4.17
- **PWA**: Custom service worker (app shell caching, offline fallback, install prompt)
- **Backend**: Next.js API Routes (serverless functions)
- **Database**: PostgreSQL (Neon) + Prisma ORM 5.22.0
  * Pooling URL สำหรับ runtime queries
  * Direct URL สำหรับ migrations
  * Prisma singleton pattern (`lib/prisma.ts`)
- **Auth**: iron-session 9.0.1 (session-based, 1 hour sliding, separate cookies)
  * Teacher session: `teacher_session`
  * HR session: `hr_session`
  * Password hashing: scrypt (Node.js built-in, timing-safe)
- **PDF**: Puppeteer 25.10.0 (puppeteer-core + @sparticuz/chromium 152.0.0)
  * TH Sarabun New font (embedded base64)
  * Serverless-ready (maxDuration: 60s)
- **Excel**: SheetJS (xlsx 0.18.5)
- **Telegram**: Bot API ผ่าน fetch (fire-and-forget pattern + retry queue)
- **Cron**: Vercel Cron Jobs (daily summary 01:00 UTC = 08:00 Thai)
- **Storage**: Cloudflare R2
- **Animation**: Framer Motion 13.2.0
- **Date/Time**: date-fns 4.4.0 + custom Thai date utilities
- **Icons**: lucide-react 1.43.0
- **Toast**: sonner 2.0.8
- **Image Compression**: browser-image-compression 2.0.2 (client-side, target 2MB)
- **Validation**: Zod 4.5.4
- **Testing**: Vitest 5.0.0 + React Testing Library 16.3.3 + jsdom 30.0.1
- **Deploy**: Vercel (Hobby plan)

## ข้อจำกัด Free Tier ที่ต้องออกแบบให้รองรับตั้งแต่ต้น
### Vercel Hobby
- Serverless function ≤ 250MB → route Puppeteer แยกไฟล์เฉพาะ
  ตั้ง `export const maxDuration = 60` และ `export const runtime = 'nodejs'`
  (ตัวเลข limit ของ Hobby plan เปลี่ยนได้ตามนโยบาย Vercel — ก่อนตั้งค่าจริงใน Phase 1
  ให้ตรวจสอบ limit ปัจจุบันก่อน แล้ว flag ให้ผมทราบถ้าค่านี้ใช้ไม่ได้แล้ว)
- Cron รันได้ **วันละครั้งเท่านั้น** เวลารับประกันแค่ "ภายในชั่วโมงนั้น"
  → มี cron เดียว: สรุปประจำวัน (`0 1 * * *` = 08:00 น. ไทย)
- **ไม่มี background worker/queue** → retry ภายใน request เดียว 3 ครั้ง (หน่วง 1/3/5 วินาที)
  แล้วบันทึกลง `notification_queue` ให้ HR กดส่งซ้ำเอง
- Active CPU 4 ชม./เดือน → Puppeteer กินหลัก ห้ามทำ batch PDF

### Neon Free
- Compute 100 CU-hours/เดือน → ตั้ง autoscale max **0.5 CU**
- Autosuspend 5 นาที → cold start ~0.5–1 วิ ยอมรับได้ แต่ UI ต้องมี skeleton เสมอ
- Prisma singleton pattern · index ครบ · ห้าม loop query ทีละแถว
- ใช้ Neon branching แยก dev/test ออกจาก production ตั้งแต่ Phase 1
  (branch `dev` สำหรับพัฒนา + seed ข้อมูลทดสอบซ้ำได้อิสระ ไม่กระทบ compute-hour ของ production)

# บริบทองค์กร
- โรงเรียนบ้านเนินพลับหวาน (โรงเรียนรัฐบาล) ครูและบุคลากรประมาณ 100 คน
- ปริมาณใบลา ~400 ใบ/ปี — ไม่ต้องกังวลเรื่อง scale
- วันนี้คือ 7 กันยายน 2569 (พ.ศ.) = 2026 (ค.ศ.) ระบบเพิ่งเริ่มใช้ อยู่ในช่วงทดสอบ
- Timezone: Asia/Bangkok เสมอ (Vercel รันเป็น UTC ต้องแปลงทุกจุดที่เกี่ยวกับวันที่)
- ครูบางท่านอายุมาก ไม่สะดวกใช้มือถือ → ฝ่ายบุคคลยื่นแทนได้ (ข้อ 4.8)


═══════════════════════════════════════
# คู่มืออ้างอิง
═══════════════════════════════════════

## ไฟล์เอกสารสำคัญ
1. `docs/leave-npw-spec.md` — สเปกฉบับนี้ (อัปเดตล่าสุด)
2. `docs/progress.md` — ประวัติการพัฒนาและ decision log
3. `docs/data-dictionary.md` — ตาราง/ฟิลด์/enum ทั้งหมด
4. `docs/deployment-guide.md` — คู่มือ deploy (English)
5. `docs/user-manual-th.md` — คู่มือใช้งาน (Thai)
6. `docs/security-checklist.md` — Security checklist
7. `docs/performance-optimization.md` — Performance guide

## Environment Variables ที่ต้องตั้งค่า
```bash
# Database (Neon)
DATABASE_URL="postgresql://..."          # Pooling URL
DIRECT_URL="postgresql://..."            # Direct URL for migrations

# Session (generate random 32+ chars)
SESSION_SECRET="your-secret-key"

# Vercel Blob
BLOB_READ_WRITE_TOKEN="vercel_blob_..."

# Telegram (optional)
TELEGRAM_BOT_TOKEN="123456:ABC..."
TELEGRAM_CHAT_ID="-100123456789"

# Cron Secret (generate random)
CRON_SECRET="your-cron-secret"

# Environment
NODE_ENV="production"
```

## คำสั่งสำคัญ
```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run start        # Production server
npm test             # Run Vitest tests
npm run lint         # ESLint check

npx prisma migrate dev        # Create migration (dev)
npx prisma migrate deploy     # Apply migrations (prod)
npx prisma generate          # Generate Prisma client
npx prisma studio            # Database GUI
npx prisma db seed           # Seed test data
```

## Test Cases Coverage
- T1-T30: Core logic, business rules ✅
- T-cases ครอบคลุมทุก Phase ✅
- Unit tests: 24 tests passing (lib/__tests__)
- Integration: ทดสอบด้วยมือตาม user-manual-th.md

## ข้อจำกัด Free Tier (ออกแบบรองรับแล้ว)
### Vercel Hobby
- Serverless function ≤250MB → PDF route แยกไฟล์
- Cron: 1 job, วันละครั้ง → daily summary 08:00 เท่านั้น
- No background worker → retry ภายใน request + queue
- Active CPU 4 ชม./เดือน → Puppeteer กินหลัก

### Vercel Blob
- 1 GB total → บีบอัดรูปก่อนอัปโหลด (target 2MB)
- จำกัด 5 ไฟล์/ใบ, ≤10MB/ไฟล์
- ลบไฟล์เมื่อ: cancel, super admin delete, clear test data
- Warning ที่ 70% (700MB), critical ที่ 90%

### Neon Free
- 100 CU-hours/เดือน → autoscale max 0.5 CU
- Autosuspend 5 นาที → cold start ~0.5-1s
- Branch: dev/test แยกจาก production

## สิ่งที่ต้องทำก่อน Production
1. ✅ Build สำเร็จ (`npm run build`)
2. ⚠️ Lighthouse Score ≥90 (รอทดสอบ)
3. ⚠️ Security checklist (รอทดสอบ)
4. ⚠️ Deploy ตาม deployment-guide.md
5. ⚠️ สร้าง super admin คนแรก
6. ⚠️ ตั้งค่า Settings, Signatories
7. ⚠️ Import ครู
8. ⚠️ ทดสอบการใช้งานจริง

═══════════════════════════════════════
# จบการอัปเดตสเปก
═══════════════════════════════════════

สเปกฉบับนี้อัปเดตล่าสุด: **13 กันยายน 2569**
ระบบพัฒนาเสร็จสมบูรณ์ 100% พร้อม deploy production
T1   ลา ศ 11 – จ 14 ก.ย. 2569 → calendar=4, working=2
T2   ลาครึ่งเช้าวันจันทร์ → ทั้งสองค่า = 0.5
T3   ลา 28 ก.ย. – 3 ต.ค. → รอบ1=3, รอบ2=3, ใบลา 1 ใบ
T4   ป่วย+กิจสะสม 22 วัน ยื่นอีก 3 วัน → เตือน (ไม่บอกตัวเลข) แต่ยื่นได้
T5   ยื่นทับใบที่รออนุมัติ → บล็อก + แสดงเลขที่ใบเดิม
T6   ยื่นย้อนหลัง 15 วัน (ฝั่งครู) → ปฏิทินกดวันนั้นไม่ได้
T7   ลาคลอด 85 วัน + ป่วย 5 วัน → ไม่เตือน (คนละถัง)
T8   Import เลขบัตรซ้ำ 2 แถวในไฟล์เดียวกัน → ❌ ผิดพลาด ระบุคู่แถวที่ซ้ำ
T9   Import เลขบัตรตรงกับครูในระบบ → ⚠️ ให้เลือก ข้าม/อัปเดต
T10  วันหยุดราชการ 08:00 → Telegram ส่ง "วันนี้เป็นวันหยุด" แล้วข้ามส่วนที่เหลือ
T11  ครูแก้ URL ดูใบลาคนอื่น → 403
T12  ครูที่มี teacher session เปิด /hr/dashboard → 403 (ไม่ redirect ไป login)
T13  ยื่น 30 ก.ย. 2569 → LEAVE-69/2-xxxx | ยื่น 1 ต.ค. 2569 → LEAVE-70/1-0001
T14  Import ไม่กรอก teacher_code → ระบบ gen T-000x อัตโนมัติ ไม่ซ้ำ
T15  ไม่มี session เปิด / → เห็น Public Dashboard ได้ ไม่ redirect
T16  Public Dashboard: ครูลา "อื่นๆ" (พิมพ์ว่า "ไปศาล") → แสดงแค่คำว่า "อื่นๆ"
T17  session ครูหมดอายุระหว่างกรอกฟอร์ม → ล็อกอินใหม่แล้วกู้ข้อมูลฟอร์มคืนได้
T18  อนุมัติด้วยผู้ลงนาม "นาย ก" → เปลี่ยนเป็น "นาย ข" → PDF ใบเดิมยังขึ้น "นาย ก"
     ใบที่อนุมัติหลังจากนั้นขึ้น "นาย ข"
T19  Telegram ส่งไม่สำเร็จ → ใบลายังบันทึกสำเร็จ + มีรายการใน notification_queue ส่งซ้ำได้
T20  PDF ภาษาไทยบน production → ฟอนต์ TH Sarabun New แสดงครบ ไม่มีสี่เหลี่ยม
T21  HR ยื่นแทนครู ก. → ใบลาผูกกับครู ก. · สถานะ "รออนุมัติ" · PDF ขึ้นชื่อครู ก. ·
     ครู ก. เห็นในประวัติพร้อมป้าย "ยื่นโดยฝ่ายบุคคล" · audit log ครบ
T22  HR ยื่นแทนครูที่ถูกปิดใช้งานระหว่างกรอกฟอร์ม → server reject
     "ครูท่านนี้ถูกปิดใช้งานแล้ว ไม่สามารถยื่นใบลาได้"
T23  ครูยกเลิกใบที่ HR ยื่นแทน (สถานะรออนุมัติ) → ยกเลิกได้ + audit log
T24  อัปโหลดไฟล์แนบล้มเหลว → ใบลายังบันทึกสำเร็จ + แจ้งให้แนบใหม่ทีหลัง
T25  HR ธรรมดายิง API ของ super admin โดยตรง (เช่น ลบครู) → 403 ไม่ใช่แค่ซ่อนปุ่ม
T26  Super admin ลบครูที่มีใบลาแล้ว → ปฏิเสธ + แนะนำให้ใช้ "ปิดใช้งาน" แทน
T27  Super admin ลบ super admin คนสุดท้าย → ปฏิเสธ "ต้องมีผู้ดูแลระบบอย่างน้อย 1 บัญชี"
T28  เปิดเว็บในโหมด offline → เห็นหน้า /offline พร้อมปุ่มลองใหม่ ไม่ใช่หน้าขาว
T29  ทุกหน้าที่ 375px → ไม่มี horizontal scroll · ปุ่มหลักแตะได้ ≥ 44px ·
     ตารางแสดงเป็นการ์ด
T30  Lighthouse mobile → Performance ≥ 90 · Accessibility ≥ 90 · PWA installable ผ่าน

═══════════════════════════════════════
# เริ่มงาน
═══════════════════════════════════════
อ่านสเปกทั้งหมดให้จบก่อน แล้วทำตามนี้:
1. สรุปความเข้าใจของคุณ
2. ถามคำถามที่ยังคลุมเครือ (ถ้ามี) — ถามให้ครบในครั้งเดียว
3. สามารถเสนอทางเลือกที่ดีกว่าและเหมาะสมกว่าได้เลย
4. รอผมตอบ/สั่ง "เริ่ม Phase 1" ก่อนค่อยเขียนโค้ด

ห้ามเขียนโค้ดในข้อความแรกเด็ดขาด