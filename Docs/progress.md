## 🎯 เพิ่มระบบรอบการลา (Round-based Leave System) - 19 กันยายน 2569

### สิ่งที่ทำ
1. ✅ **อัปเดต Schema** - เพิ่มฟิลด์ `round` ใน Prisma schema
   - `leaves.round`: ระบุรอบการลา (1 หรือ 2)
   - `fiscal_counter.round`: เปลี่ยน PK เป็น (fiscal_year, round)
   - Unique constraint: (fiscal_year, round, running_no)

2. ✅ **อัปเดต Data Dictionary** - เพิ่มคำอธิบายฟิลด์ใหม่
   - ระบุ business rules ของแต่ละรอบ
   - รอบ 2: เมษายน-กันยายน, รอบ 1: ตุลาคม-มีนาคม

3. ✅ **Migration Database** - migrate ข้อมูลเดิมให้เข้ารอบที่ 1
   - เพิ่ม column `round` ใน `leaves` และ `fiscal_counter`
   - Set default = 1 สำหรับข้อมูลเดิม
   - อัปเดต primary key และ unique constraints

4. ✅ **อัปเดต Business Logic** - ฟังก์ชันจัดการรอบการลา
   - `getCurrentFiscalYearAndRound()`: คำนวณรอบจากวันที่ปัจจุบัน
   - `formatLeaveNumber()`: รองรับรูปแบบ `LEAVE-{ปีงบ}/{รอบ}-{เลข}`
   - เช่น: `LEAVE-69/1-0001`, `LEAVE-69/2-0015`

5. ✅ **อัปเดต API Route** - ใช้ระบบรอบใหม่
   - `app/api/teacher/leaves/submit/route.ts`: ใช้ `getCurrentFiscalYearAndRound()`
   - สร้างเลขใบลาแบบใหม่ `LEAVE-{ปีงบ}/{รอบ}-{เลข}`
   - รองรับ composite primary key สำหรับ fiscal_counter

6. ✅ **Test Coverage** - ตรวจสอบความถูกต้อง
   - ทดสอบ `getLeavePeriod()` สำหรับทุกเดือน
   - ทดสอบ `formatLeaveNumber()` ทั้ง 2 รอบ
   - ทดสอบ `parseLeaveNumber()` parse รูปแบบใหม่
   - All tests pass (27 tests total, 8 fiscal year tests)

### ไฟล์ที่เกี่ยวข้อง
- `prisma/schema.prisma` - เพิ่มฟิลด์ round
- `docs/data-dictionary.md` - อัปเดตคำอธิบาย
- `scripts/migrate-round.js` - Migration script
- `lib/fiscalYear.ts` - Business logic (formatLeaveNumber, getCurrentFiscalYearAndRound)
- `lib/__tests__/fiscalYear.test.ts` - Test cases
- `app/api/teacher/leaves/submit/route.ts` - API route ที่สร้างใบลาใหม่
- `vitest.config.ts` - แก้ไข exclude backup folders

### การทำงานของระบบ
- **รอบ 1 (ต.ค.-มี.ค.)**: เลขใบลา `LEAVE-69/1-0001`, `LEAVE-69/1-0002`, ...
- **รอบ 2 (เม.ย.-ก.ย.)**: เลขใบลา `LEAVE-69/2-0001`, `LEAVE-69/2-0002`, ...
- แต่ละรอบมี counter แยกกัน (reset ทุกรอบ)
- ระบบตรวจจับรอบอัตโนมัติจากวันที่ปัจจุบัน

### UI ที่แสดงผลถูกต้องแล้ว
- ✅ PDF template (`lib/pdf/template.ts`) - แสดง `leave.leaveNo` ที่มีรูปแบบใหม่แล้ว
- ✅ HR leaves list (`app/hr/leaves/LeavesClient.tsx`) - แสดง `leave.leaveNo` โดยตรง
- ✅ API response - ส่ง `leaveNo` ที่ถูกต้องกลับไปให้ client

### ต่อไป (Next Steps)
- ทดสอบการสร้างใบลาข้ามรอบ (เช่น สร้างใบลาในรอบ 2 แล้วดูว่า counter reset ถูกต้องไหม)
- ตรวจสอบ UI อื่น ๆ ที่อาจแสดงเลขใบลา (teacher dashboard, leave detail pages)
- พิจารณาเพิ่ม filter by round ในหน้า HR leaves list

---

### อัปเดต `docs/leave-npw-spec.md` ให้สอดคล้องกับระบบที่พัฒนาเสร็จแล้ว

**หมวดที่อัปเดต:**
1. ✅ **กติกาการทำงาน** - เปลี่ยนจาก "พัฒนาใหม่" → "ปรับปรุงระบบที่มีอยู่"
   * เพิ่มกติกาการทำงานกับโค้ดเบส (อ่าน progress.md, data-dictionary.md ก่อน)
   * เน้นการรักษา consistency และไม่ทำลายฟีเจอร์เดิม

2. ✅ **Tech Stack** - ระบุเวอร์ชันที่ใช้จริง
   * Next.js 16.3.4 + TypeScript 7.0.2 + Tailwind 3.4.17
   * Puppeteer 25.10.0 + @sparticuz/chromium 152.0.0
   * iron-session 9.0.1 + scrypt password hashing
   * date-fns 4.4.0 + Zod 4.5.4 + Vitest 5.0.0
   * ระบุ pattern ที่ใช้จริง (Prisma singleton, fire-and-forget Telegram)

3. ✅ **Design Principles** - ปรับให้สอดคล้องกับ UI ที่มี
   * Primary: Sky blue #38BDF8, CTA: Orange #F97316
   * Background: Slate #0F172A, Text: #F8FAFC
   * Spacing กระชับ: py-4, gap-3, p-4 (ไม่ใช่ py-6)
   * ฟอนต์: System fonts (Inter fallback)
   * ไอคอน: lucide-react เท่านั้น

4. ✅ **Route Map** - เพิ่มรายละเอียดเส้นทางที่มีจริง
   * ครบทุก route ที่ implement แล้ว
   * เพิ่ม API endpoints สำคัญ
   * ระบุ parameters และ features

5. ✅ **Session & Security** - ระบุรายละเอียดการ implement
   * scrypt hashing (timing-safe, Node.js built-in)
   * Rate limiting details (lib/rateLimit.ts)
   * Security headers (next.config.ts)
   * Zod validation (lib/validation.ts)
   * Security utilities (lib/security.ts)

6. ✅ **PDF Generation** - เพิ่มรายละเอียดเทคนิค
   * ระบุไฟล์ที่เกี่ยวข้อง (lib/pdf/*)
   * TH Sarabun New embedding
   * QR code library (qrcode 1.5.4)
   * Serverless config (maxDuration, runtime)
   * Dev vs Production setup

7. ✅ **Telegram Notifications** - เพิ่มรายละเอียด API
   * Fire-and-forget pattern + retry logic
   * Notification queue + idempotency key
   * ระบุไฟล์ทั้งหมด (lib/telegram/*, api/telegram/*)
   * Cron config (vercel.json)

8. ✅ **Super Admin Zone** - เขียนสเปกเต็มรูปแบบ
   * แยกทั้ง 4 sections ชัดเจน
   * User Management features + guards
   * System Status cards (5 cards)
   * Audit Log Viewer features
   * Danger Zone operations (4 operations)
   * UI patterns + animations
   * ระบุไฟล์ที่เกี่ยวข้อง

9. ✅ **สรุปสถานะโครงการ** - ย้าย Phase plan → Project Summary
   * สรุปทั้ง 6 Phase ว่าทำอะไรไปบ้าง
   * ระบุไฟล์สำคัญแต่ละ Phase
   * Test cases coverage
   * Mobile-first UI refinement log

10. ✅ **คู่มืออ้างอิง** - รวมข้อมูลที่จำเป็นต้องรู้
    * ไฟล์เอกสารทั้งหมด
    * Environment variables
    * คำสั่งสำคัญ
    * Test cases coverage
    * ข้อจำกัด Free Tier
    * สิ่งที่ต้องทำก่อน Production

**เหตุผลในการอัปเดต:**
- สเปกเดิมเขียนไว้ตอนเริ่มพัฒนา (สไตล์ "วางแผน")
- ตอนนี้ระบบพัฒนาเสร็จแล้ว → ต้องเปลี่ยนเป็นสไตล์ "อ้างอิง"
- เพิ่มรายละเอียดเทคนิคที่ใช้จริง (เวอร์ชัน, ไฟล์, pattern)
- ช่วยให้ดูแลรักษาระบบง่ายขึ้น (developer ใหม่อ่านแล้วเข้าใจเร็ว)

**ไฟล์ที่อัปเดต:**
- `docs/leave-npw-spec.md` - สเปกหลักของโปรเจกต์

---
