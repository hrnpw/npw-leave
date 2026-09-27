# งานที่ยังค้าง — แก้บั๊ก session หมดอายุตอนยื่นใบลา

บันทึกวันที่ 2026-09-27 ต่อเนื่องจากการแก้บั๊ก "ครูกดยื่นใบลาแล้วเด้งกลับหน้าแรก (public dashboard)"

## สถานะ

แก้โค้ดไปแล้ว 6 ไฟล์ **แต่ยังไม่ได้ verify เลย** ยังไม่ได้รัน build หรือ test แม้แต่ครั้งเดียว

---

## 1. ยังไม่ได้ verify (ต้องทำก่อนอย่างอื่น)

รัน build เพื่อให้คอมไพเลอร์ตรวจโค้ดที่แก้ไป

```
npm run build
```

จุดที่อยากให้ตรวจเป็นพิเศษ:

- **`proxy.ts`** — type ของพารามิเตอร์ใน `refreshIfNearExpiry` เขียนเป็น
  `Awaited<ReturnType<typeof getIronSession<T>>>` ซึ่งเป็น generic instantiation
  ใน `typeof` อาจไม่ผ่าน TypeScript ถ้าไม่ผ่านให้เปลี่ยนไปใช้ `IronSession<T>`
  ที่ import จาก `iron-session` ตรง ๆ (แบบที่ `lib/validateSession.ts` ใช้อยู่)
- **`app/teacher/leave/new/LeaveFormClient.tsx`** — ใน `saveDraft()` มี
  `const { files, ...serialisable } = formData` และใน catch มี
  `const { files, signatureDataUrl, ...rest }` ตัวแปร `files` ไม่ได้ถูกใช้
  อาจติด lint rule `no-unused-vars`
- รันเทสต์ที่มีอยู่ด้วย: `npm test` (มี `lib/__tests__/` อยู่ 3 ไฟล์)

---

## 2. Service worker — ยังไม่ได้แตะ

ไฟล์ `public/sw.js`

นี่คือส่วนที่ผม **ยังไม่ได้พิสูจน์** แต่สงสัยว่าเป็นตัวทำให้ไปโผล่หน้า
public dashboard (`/`) แทนที่จะไป `/verify` เพราะเส้นทางฝั่งครูในโค้ดทุกทาง
ชี้ไป `/verify` ทั้ง `proxy.ts` และ `app/teacher/leave/new/page.tsx:22`

ข้อสังเกตในไฟล์:

- บรรทัด 3–7: precache `/` ไว้ตั้งแต่ install
- บรรทัด 71–100: ใช้ CacheFirst กับ **ทุก** GET ที่ไม่ใช่ `/api/` ซึ่งรวม
  navigation request และ RSC payload ของ `router.push()` ด้วย
- `caches.match(request)` ไม่ได้ตั้ง `ignoreSearch` ทำให้ URL ที่มี `?_rsc=...`
  ถูกเก็บเป็น entry แยกกันเรื่อย ๆ
- `manifest.json` ตั้ง `start_url: "/"` + `display: standalone` เวลา session ตาย
  ใน standalone mode แอปอาจกลับไปเริ่มที่ `/`

แนวทางที่ควรทำ:

- ไม่ควร CacheFirst กับ navigation request (`request.mode === 'navigate'`)
  ควรเป็น NetworkFirst แล้ว fallback ไป `/offline`
- ข้าม request ที่มี `_rsc` ไปเลย หรืออย่างน้อยอย่าเก็บลง cache
- ไม่ควรเก็บ response ที่เป็น redirect (`response.redirected === true`)
  เพราะ `cache.put()` จะ throw กับ redirected response อยู่แล้ว
- บั๊มป์ `CACHE_NAME` จาก `leave-npw-v1` เป็น `v2` ไม่งั้น client เดิมยังกิน
  cache ชุดเก่า

Next 16 มี docs เรื่องนี้ที่
`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` และ
`offline-support.md` (แนะนำ Serwist ถ้าจะทำจริงจัง และมี
`experimental.useOffline` เป็นตัวเลือกใหม่) — **ยังไม่ได้อ่านจบ**

---

## 3. Sliding refresh ยังไม่ครอบ API routes

ตอนนี้ `refreshIfNearExpiry()` อยู่ใน `proxy.ts` เท่านั้น และ matcher คือ

```ts
matcher: ['/teacher/:path*', '/hr/:path*']
```

ไม่ครอบ `/api/*` ผลคือ **session ต่ออายุเฉพาะเวลาเปลี่ยนหน้า** ครูที่นั่งกรอก
ฟอร์มอยู่หน้าเดียวนิ่ง ๆ (ยิงแต่ API เช่น `calculate-days`, `check-overlap`)
จะไม่ได้ต่ออายุ ต้องพึ่งปุ่ม "ใช้งานต่อ" ที่ modal

ทางเลือก:

- **ก.** เพิ่ม `/api/teacher/:path*` กับ `/api/hr/:path*` เข้า matcher
  ข้อควรระวัง: proxy จะรันทุก API call เพิ่ม overhead และต้องกันไม่ให้
  redirect ตอบกลับเป็น HTML ให้ fetch (API ควรได้ 401 JSON ไม่ใช่ 307)
- **ข.** ทำ helper ฝั่ง server แล้วเรียกใน route handler ที่สำคัญ
  ข้อควรระวัง: `getTeacherSession()` ใน `lib/getSession.ts` ใช้ `cookies()` จาก
  `next/headers` ซึ่งใน Server Component เป็น read-only เรียก `save()` จะ throw
  ต้องเรียกจาก route handler เท่านั้น
- **ค.** ปล่อยไว้แบบนี้ เพราะ TTL 30 นาที + ปุ่มต่อเวลา อาจพอแล้วในการใช้งานจริง

ยังไม่ได้ตัดสินใจ

---

## 4. ยังไม่ได้ทดสอบ flow จริง

เคสที่ควรลองด้วยมือ:

- เปิดหน้า `/teacher/leave/new` ทิ้งไว้เกิน 30 นาที แล้วกดยื่น → ต้องเซฟ draft
  แล้วไป `/verify?returnUrl=/teacher/leave/new` ไม่ใช่ `/`
- login กลับเข้ามา → ต้องเห็น toast "กู้คืนข้อมูลที่กรอกไว้ก่อนหน้าแล้ว"
  และข้อมูลในฟอร์มกลับมา (ยกเว้นไฟล์แนบ ซึ่งตั้งใจไม่เก็บ)
- กดปุ่ม "ใช้งานต่อ" ใน modal ตอนอยู่หน้าฟอร์ม → ฟอร์มต้องไม่หาย
  (จุดนี้คือเหตุผลที่เลิกใช้ `window.location.reload()`)
- ลายเซ็น base64 ขนาดใหญ่ + localStorage quota → ดูว่า fallback ที่ตัด
  `signatureDataUrl` ออกทำงานจริงไหม
- ฝั่ง HR: session หมดอายุ → ต้องไป `/hr/login?returnUrl=...` ไม่ใช่ `/`

---

## 5. เรื่องที่เจอระหว่างทาง ยังไม่ได้แก้

- **`lib/apiClient.ts` ไม่ถูก import ที่ไหนเลย** เป็น dead code ทั้งไฟล์
  ผมแก้พฤติกรรม 401 ไว้แล้วแต่ไม่ได้ลบ ถ้าไม่มีแผนใช้ก็ควรลบทิ้ง
- **มีหน้า leave detail ซ้ำกันสองชุด** `app/teacher/leave/[id]/` กับ
  `app/teacher/leaves/[id]/` ไม่รู้ว่าอันไหนใช้จริง
- **`app/teacher/history/` มี client 2 ไฟล์** `LeaveHistoryClient.tsx` กับ
  `LeaveHistoryClientOptimized.tsx`
- **`lib/pdf/` มีไฟล์ชื่อแปลก** `2 -template .ts`, `3 -generator.ts` และโฟลเดอร์
  `Backup/` ปนอยู่ใน source
- **`app/api/` มี route คู่ `-optimized`** เช่น `approvals/pending` กับ
  `approvals/pending-optimized`, `leaves/history` กับ `history-optimized`
- **`console.log` เยอะมากใน production path** เช่น
  `app/api/teacher/leaves/submit/route.ts` มี log ทั้ง `[OVERLAP CHECK]`,
  `[DEBUG]`, `[SIGNATURE]` และ `lib/fetchCache.ts` log ทุก request
- **`check-db.js` กับ `to to list.txt`** อยู่ที่ root ดูเหมือนไฟล์ชั่วคราว

---

## สรุปไฟล์ที่แก้ไปแล้ว (ยังไม่ commit)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `lib/constants.ts` | TTL 30 นาที, แยก early/critical warning |
| `lib/session.ts` | อ่านค่าจาก constants เลิก hardcode 5 นาที |
| `proxy.ts` | เพิ่ม `refreshIfNearExpiry()` 3 สาขา, สาขา `/hr` เลิกเด้งไป `/` |
| `components/SessionWarning.tsx` | แก้เงื่อนไข early toast, เลิก reload ตอนต่อเวลา |
| `app/teacher/leave/new/page.tsx` | ส่ง `createdAt` เข้า client |
| `app/teacher/leave/new/LeaveFormClient.tsx` | วาง `SessionWarning`, เช็ค 401, เซฟ/กู้ draft |
| `lib/apiClient.ts` | 401 ไป login page พร้อม returnUrl แทน `/` |
