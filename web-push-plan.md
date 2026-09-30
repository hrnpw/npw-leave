# Plan: Web Push แจ้งเตือนครูเมื่อใบลาได้รับการอนุมัติ/ไม่อนุมัติ

## เป้าหมาย

เมื่อ HR กดอนุมัติหรือไม่อนุมัติใบลา ให้ส่ง Web Push ไปยังทุกอุปกรณ์ที่ครูเจ้าของใบลาเปิดการแจ้งเตือนไว้ แตะแจ้งเตือนแล้วเปิดหน้ารายละเอียดใบลา

## หลักการผูกอุปกรณ์กับครู

- ครูล็อกอินอยู่ (cookie `teacher_session` มี `id` = `Teacher.id`) แล้วกดปุ่ม "เปิดการแจ้งเตือน"
- Browser สร้าง `PushSubscription` (`endpoint`, `keys.p256dh`, `keys.auth`) แล้ว client POST ไปที่ server
- Server อ่าน `teacherId` จาก session เท่านั้น (ห้ามรับ teacherId จาก body) แล้ว upsert ตาม `endpoint`
- ครู 1 คนมีได้หลายอุปกรณ์ `endpoint` ซ้ำกันไม่ได้ ถ้าคนอื่นล็อกอินบนเครื่องเดิมแล้วเปิดแจ้งเตือน ให้ย้าย row ไปเป็นของครูคนล่าสุด
- Session หมดอายุ (30 นาที) ไม่ลบ subscription ครูยังได้รับแจ้งเตือน

## อ่านก่อนเขียนโค้ด (Next.js 16 ในโปรเจกต์นี้มี breaking changes)

- `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` (หัวข้อ Web Push)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`
- `CLAUDE.md`

## สภาพโค้ดปัจจุบัน (ตรวจแล้ว)

- `public/sw.js`: SW แบบ plain JS มี `install`/`activate`/`fetch`/`message` ยังไม่มี `push`
- `components/PWARegister.tsx`: register `/sw.js` เฉพาะตอน `NODE_ENV === 'production'`
- `lib/getSession.ts`: `getTeacherSession()` / `getHrSession()`
- `lib/session.ts`: `TeacherSession { id, teacherCode, firstName, lastName, createdAt }`
- `app/api/hr/approvals/[id]/approve/route.ts`: อัปเดต status เป็น `approved` แล้วเรียก audit log แบบ fire-and-forget (มี `leave.teacherId`, `leave.leaveNo` อยู่แล้ว)
- `app/api/hr/approvals/[id]/reject/route.ts`: อัปเดต status เป็น `rejected` (`include: teacher` จึงมี `leave.teacherId`, `leave.leaveNo`)
- `app/api/auth/teacher/logout/route.ts`: แค่ `session.destroy()`
- `app/teacher/TeacherDashboardClient.tsx`: เรียก logout ที่บรรทัด ~183, header ที่ ~310
- หน้ารายละเอียดใบลาของครูที่ dashboard ใช้คือ `/teacher/leaves/{id}`
- Prisma + Neon PostgreSQL, migrations อยู่ที่ `prisma/migrations/` (deploy ด้วย `npx prisma migrate deploy`)
- มี vitest (`npm test`) และตัวอย่างเทสต์ใน `lib/__tests__/`

## ขั้นตอน

### 1. Dependency และ env

- `npm install web-push@3.6.7 --save-exact` และ `npm install -D @types/web-push --save-exact`
- สร้าง key: `npx web-push generate-vapid-keys` (ผู้ใช้ทำเองแล้วใส่ใน Vercel env ห้าม commit ค่าจริง)
- เพิ่มใน `.env.example` (ใช้ placeholder แบบเดียวกับตัวอื่นในไฟล์):

```
# Web Push (VAPID) - generate with: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY="............................"
VAPID_PRIVATE_KEY="............................"
VAPID_SUBJECT="mailto:admin@example.com"
```

หมายเหตุ: `.env.example` มีการแก้ค้างอยู่ใน working tree (ไม่ใช่งานนี้) ให้เพิ่มต่อท้ายโดยไม่แตะส่วนอื่น

### 2. Prisma schema + migration

เพิ่มใน `prisma/schema.prisma`:

```prisma
model PushSubscription {
  id         String   @id @default(cuid())
  teacherId  String   @map("teacher_id")
  endpoint   String   @unique
  p256dh     String
  auth       String
  userAgent  String?  @map("user_agent")
  createdAt  DateTime @default(now()) @map("created_at")
  lastUsedAt DateTime @default(now()) @map("last_used_at")
  teacher    Teacher  @relation(fields: [teacherId], references: [id], onDelete: Cascade)

  @@index([teacherId])
  @@map("push_subscriptions")
}
```

และเพิ่ม `pushSubscriptions PushSubscription[]` ใน `model Teacher`

สร้าง migration ใหม่ `prisma/migrations/<timestamp>_add_push_subscriptions/migration.sql` ด้วย `npx prisma migrate dev --create-only --name add_push_subscriptions` ถ้าเชื่อม DB ไม่ได้ ให้เขียน SQL เองตาม schema (CREATE TABLE + unique index บน endpoint + index บน teacher_id + FK cascade) ห้ามรัน `migrate reset` หรือ `db push` กับ DB จริง

### 3. `lib/push/send.ts` (server only)

- ตั้งค่า `webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)` แบบ lazy ครั้งเดียว ถ้า env ไม่ครบให้ `console.warn` แล้ว return เงียบ ๆ (เหมือน `lib/telegram/notify.ts`)
- `export async function sendPushToTeacher(teacherId: string, payload: PushPayload)`
  - `PushPayload = { title: string; body: string; url: string; tag?: string }`
  - ดึง subscriptions ของ teacherId แล้วส่งด้วย `Promise.allSettled`
  - options: `{ TTL: 60 * 60 * 24, urgency: 'normal' }`
  - ถ้า error `statusCode` เป็น 404 หรือ 410 ให้ลบ row นั้น (`deleteMany` ตาม endpoint)
  - ส่งสำเร็จให้อัปเดต `lastUsedAt`
  - ห้าม throw ออกไป log แล้วจบ
- ข้อความ (ภาษาไทย ห้ามใส่ประเภทการลา/เหตุผลเพราะโชว์บนหน้าจอล็อก):
  - อนุมัติ: title `ใบลาได้รับการอนุมัติ`, body `ใบลาเลขที่ {leaveNo} ได้รับการอนุมัติแล้ว`
  - ไม่อนุมัติ: title `ใบลาไม่ได้รับการอนุมัติ`, body `ใบลาเลขที่ {leaveNo} ไม่ได้รับการอนุมัติ แตะเพื่อดูรายละเอียด`
  - `url`: `/teacher/leaves/{leaveId}`, `tag`: `leave-{leaveId}`

### 4. API subscribe / unsubscribe

`app/api/teacher/push/subscribe/route.ts`

- `POST`: เช็ค `getTeacherSession()` ถ้าไม่มี `session.id` ตอบ 401
- validate body ด้วย zod: `{ endpoint: z.string().url().startsWith('https://'), keys: { p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) } }` จำกัดความยาว endpoint (เช่น max 1000)
- `prisma.pushSubscription.upsert({ where: { endpoint }, create: {...}, update: { teacherId: session.id, p256dh, auth, userAgent, lastUsedAt: new Date() } })`
- จำกัดไม่เกิน 10 subscriptions ต่อครู (เกินให้ลบอันที่ `lastUsedAt` เก่าสุด)
- `DELETE`: รับ `{ endpoint }` ลบเฉพาะ row ที่ `endpoint` ตรงและ `teacherId === session.id`

ดูรูปแบบ response/error จาก route อื่นใน `app/api/teacher/` แล้วทำให้เหมือนกัน

### 5. Service Worker (`public/sw.js`)

- bump `CACHE_NAME` เป็น `leave-npw-v4`
- เพิ่มใน `realtimeEndpoints`: `'/api/teacher/push/'` (ไม่ต้องแคช แม้ตอนนี้จะเป็น POST/DELETE อยู่แล้ว)
- เพิ่ม handler:

```js
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'Leave-NPW';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/teacher' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/teacher', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Browser rotated the subscription - re-register it with the server
self.addEventListener('pushsubscriptionchange', (event) => {
  // ถ้า event.newSubscription มี ให้ fetch POST ไป /api/teacher/push/subscribe
  // (cookie จะติดไปด้วยถ้า session ยังไม่หมด ถ้า 401 ก็ปล่อยไป client จะ sync ใหม่ตอนเปิดแอป)
});
```

เช็คชื่อไฟล์ icon จริงใน `public/icons/` และ `public/manifest.json` ก่อนใช้

### 6. Client: `components/PushNotificationToggle.tsx`

- `'use client'` ใช้ `navigator.serviceWorker.ready` (ห้าม register SW ซ้ำ `PWARegister` ทำอยู่แล้ว)
- ตรวจ support: `'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window`
- สถานะที่ต้องแสดง:
  - ไม่รองรับ: ถ้าเป็น iOS และไม่ได้อยู่ใน standalone (`matchMedia('(display-mode: standalone)')` หรือ `navigator.standalone`) ให้บอก "เพิ่มแอปไปยังหน้าจอโฮมก่อนเพื่อรับการแจ้งเตือน" นอกนั้นซ่อนปุ่ม
  - `Notification.permission === 'denied'`: บอกให้เปิดสิทธิ์ในการตั้งค่าเครื่อง
  - ยังไม่ subscribe: ปุ่ม "เปิดการแจ้งเตือน"
  - subscribe แล้ว: ปุ่ม "ปิดการแจ้งเตือน"
- ขอ permission เฉพาะตอนผู้ใช้กดปุ่มเท่านั้น (iOS บังคับ)
- subscribe: `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) })` แล้ว POST `JSON.parse(JSON.stringify(sub))`
- ตอน mount ถ้ามี subscription อยู่แล้วให้ POST sync ซ้ำเงียบ ๆ (กรณีเครื่องนี้เคยเป็นของครูคนอื่น หรือ row ถูกลบไป)
- ใช้ `sonner` toast แจ้งผล, ไอคอนจาก `lucide-react` (`Bell` / `BellOff`), Tailwind รองรับ dark mode ตามสไตล์ใน `TeacherDashboardClient.tsx`, ปุ่มต้องมี `aria-label` / `aria-pressed`
- ใน dev SW ไม่ถูก register จึงทดสอบ push ได้เฉพาะ `npm run build && npm start` ให้ component จัดการกรณี `serviceWorker.ready` ไม่ resolve (ใช้ `getRegistration()` ก่อน ถ้าไม่มีก็ซ่อนปุ่ม)

วาง component ใน `app/teacher/TeacherDashboardClient.tsx` บริเวณ header หรือการ์ดด้านบน (เลือกตำแหน่งที่เข้ากับ layout เดิม)

### 7. Logout

ใน `TeacherDashboardClient.tsx` ก่อนเรียก `/api/auth/teacher/logout` (บรรทัด ~183):

- ถ้ามี subscription: เรียก `DELETE /api/teacher/push/subscribe` กับ endpoint แล้ว `sub.unsubscribe()`
- ครอบด้วย try/catch และตั้ง timeout สั้น ๆ ห้ามทำให้ logout ค้างหรือล้มเหลว

ถ้ามีจุด logout อื่นของครู (ค้นหา `/api/auth/teacher/logout` ทั้งโปรเจกต์) ให้ทำเหมือนกัน ควรแยกเป็น helper `lib/push/client.ts` แล้วใช้ร่วมกัน

### 8. เรียกส่ง push ใน approve / reject

ใน `app/api/hr/approvals/[id]/approve/route.ts` และ `reject/route.ts` หลัง `prisma.leave.update` สำเร็จ:

```ts
import { after } from 'next/server';
import { sendPushToTeacher } from '@/lib/push/send';

after(() =>
  sendPushToTeacher(leave.teacherId, { ... })
);
```

- ใช้ `after()` เพื่อไม่ block response (บน Vercel ถ้าใช้ fire-and-forget ธรรมดา function อาจถูก kill ก่อนส่งเสร็จ) ยืนยันการใช้ `after` ใน route handler จาก docs ข้อ "อ่านก่อน"
- ค้นหาจุดอื่นที่เปลี่ยน status เป็น approved/rejected (เช่น `grep -rn "status: 'approved'" app/api`) แล้วรายงานไว้ในสรุป ไม่ต้องใส่ push ให้ ยกเว้นเป็น flow อนุมัติปกติแบบเดียวกัน
- ห้ามเปลี่ยน logic หรือ response เดิมของทั้งสอง route

### 9. Tests

- `lib/__tests__/pushSend.test.ts` (vitest): mock `web-push` และ `@/lib/prisma`
  - ไม่มี env → ไม่เรียก `sendNotification`
  - ส่งครบทุก subscription ของครู
  - 410/404 → ลบ subscription นั้น, error อื่น → ไม่ลบ และไม่ throw
- เทสต์ zod schema ของ subscribe route (endpoint ไม่ใช่ https ต้อง reject)

## Verification

1. `npx prisma generate`, `npx tsc --noEmit`, `npm test`, `npm run build` ต้องผ่านทั้งหมด
2. ทดสอบมือ (production build, ใส่ VAPID key ใน `.env.local`):
   - Android Chrome / desktop Chrome: ล็อกอินครู เปิดแจ้งเตือน, ล็อกอิน HR อนุมัติ → ได้แจ้งเตือน แตะแล้วเปิด `/teacher/leaves/{id}`
   - ไม่อนุมัติ → ได้แจ้งเตือนแบบไม่อนุมัติ
   - iOS 16.4+ ต้องติดตั้งลงหน้าจอโฮมก่อน ทดสอบบน HTTPS (deploy preview) เท่านั้น
3. ลบไฟล์ชั่วคราวที่สร้างระหว่างทดสอบ

## นอกขอบเขต (ห้ามทำ)

- แจ้งเตือน HR เมื่อมีใบลาใหม่ (ใช้ Telegram อยู่แล้ว)
- ใช้ `NotificationQueue` ทำ retry (อาจทำภายหลัง)
- เปลี่ยน `app/manifest` หรือย้าย SW ไปเป็น `app/manifest.ts`
- commit / push git ถ้าผู้ใช้ไม่ได้สั่ง

## สรุปที่ต้องส่งกลับ

ไฟล์ที่แก้/สร้าง, ผล build/test, สิ่งที่ทดสอบมือได้และไม่ได้, env ที่ผู้ใช้ต้องตั้งเอง, จุดอื่นที่เปลี่ยนสถานะใบลาที่พบในข้อ 8
