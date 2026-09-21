# Debug Session Login Issue

## วิธีตรวจสอบปัญหา

### 1. เช็ค SESSION_SECRET
```bash
# ดูว่ามีค่าหรือเปล่า
echo $env:SESSION_SECRET
```

### 2. เพิ่ม Logging ใน getSession
```typescript
// lib/getSession.ts
export async function getHrSession() {
  const session = await getIronSession<HrSession>(await cookies(), hrSessionOptions);
  console.log('🔍 Session Debug:', {
    hasId: !!session.id,
    id: session.id,
    username: session.username,
    createdAt: session.createdAt,
    age: session.createdAt ? Math.floor((Date.now() - session.createdAt) / 1000) : null,
  });
  return session;
}
```

### 3. เพิ่ม Logging ใน dashboard page
```typescript
// app/hr/dashboard/page.tsx
export default async function HrDashboardPage() {
  const session = await getHrSession();
  
  console.log('📊 Dashboard Access:', {
    hasId: !!session.id,
    sessionData: session,
    willRedirect: !session.id,
  });

  if (!session.id) {
    console.log('❌ Redirecting to login - no session.id');
    redirect('/hr/login');
  }
  // ...
}
```

### 4. ดู Browser DevTools
- เปิด Network tab
- ดู Cookies tab
- เช็ค `hr_session` cookie:
  - มีค่าหรือเปล่า
  - Expires เมื่อไหร่
  - Path, Domain, SameSite ถูกต้องไหม

### 5. ดู Server Logs
```bash
npm run dev
# แล้วดู console output เวลา login และเข้า dashboard
```

## แนวทางแก้ไข

### Option A: แก้ไข Middleware ให้เช็ค session จริงๆ
```typescript
// middleware.ts
import { getIronSession } from 'iron-session';
import { hrSessionOptions, HrSession } from './lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/hr') && pathname !== '/hr/login') {
    try {
      const session = await getIronSession<HrSession>(
        request as any,
        hrSessionOptions
      );
      
      if (!session.id) {
        const url = request.nextUrl.clone();
        url.pathname = '/hr/login';
        url.searchParams.set('returnUrl', pathname);
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error('Middleware session error:', error);
      const url = request.nextUrl.clone();
      url.pathname = '/hr/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}
```

### Option B: ลบการเช็คซ้ำใน page
```typescript
// app/hr/dashboard/page.tsx
export default async function HrDashboardPage() {
  const session = await getHrSession();

  // Middleware จัดการแล้ว ถ้าถึงตรงนี้แสดงว่า session ถูกต้อง
  // แต่ต้อง handle edge case
  if (!session.id) {
    console.error('Session disappeared between middleware and page render');
    redirect('/hr/login');
  }

  return <HrDashboardClient user={...} />;
}
```

### Option C: ใช้ revalidation path แทน
```typescript
// ใช้ใน login success
import { revalidatePath } from 'next/cache';

// หลัง session.save()
revalidatePath('/hr/dashboard');
```

## การแก้ปัญหา SESSION_SECRET

ถ้าเป็นเรื่อง SESSION_SECRET:
1. Logout ทุก session
2. Clear cookies ใน browser
3. Restart dev server
4. Login ใหม่
