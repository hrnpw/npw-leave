# Authentication Cookie / Session Problem — Debugging Brief

## 1. Problem Summary

ระบบ Web Application มีปัญหา Authentication แบบ intermittent:

* Login สำเร็จเป็นบางครั้ง
* บางครั้ง Login แล้วเข้า Dashboard ได้
* บางครั้ง Login แล้วเข้า Dashboard ได้เพียงประมาณ `0.1–0.2 วินาที` แล้วถูก redirect กลับไปหน้า Login
* ปัญหาเกิดทั้ง:

  * Safari
  * Chrome Desktop
* ดังนั้น **ยังไม่ควรสรุปว่าเป็นปัญหาเฉพาะ Safari**
* ลักษณะอาการบ่งชี้ว่าควรตรวจ Authentication / Cookie / Session lifecycle และ post-login auth checks ก่อน

### Observed Flow

```text
User Login
    ↓
Login succeeds
    ↓
Dashboard appears
    ↓
~0.1–0.2 sec
    ↓
Authentication check fails
    ↓
Redirect to /login
```

---

# 2. Current Technology Stack

```text
Frontend:
- Next.js
- App Router
- TypeScript
- Tailwind CSS
- shadcn/ui

PWA:
- Serwist
- Service Worker

Backend:
- Next.js API Routes
- Next.js Server Actions

Database:
- PostgreSQL
- Neon
- Prisma ORM

Authentication:
- iron-session
- Session-based authentication
- Session stored in encrypted/signed Cookie

Password:
- scrypt
- Node.js built-in crypto

Testing:
- Vitest
- React Testing Library

Deployment:
- Vercel
- Serverless

Browsers affected:
- Safari
- Chrome Desktop
```

---

# 3. Important Architecture Detail

The application uses `iron-session`.

Unlike traditional server-side sessions where a random session ID points to a session stored in Redis/database/memory, `iron-session` stores the session data in an encrypted/signed Cookie.

Conceptually:

```text
Login
  ↓
Validate username/password
  ↓
Create/update session
  ↓
session.save()
  ↓
Set-Cookie
  ↓
Browser stores Cookie
  ↓
Request /dashboard
  ↓
iron-session reads Cookie
  ↓
Decrypt/verify session
  ↓
Read authenticated user
```

Therefore, debugging should focus heavily on:

```text
Login
  ↓
session creation
  ↓
session.save()
  ↓
Set-Cookie
  ↓
Browser stores Cookie
  ↓
Next request sends Cookie
  ↓
Server reads Cookie
  ↓
iron-session decrypts/verifies
  ↓
Auth check
  ↓
Dashboard
```

---