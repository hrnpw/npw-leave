# Performance Improvements

เอกสารนี้บันทึกการปรับปรุง performance ของระบบ Leave-NPW

## ปัญหาที่พบ (26 ก.ย. 2026)

### 1. Dashboard API ถูกเรียกซ้ำ 3 ครั้ง

**Public Dashboard:**
- Request 1: 6.91s
- Request 2: 5.79s  
- Request 3: 121ms

**Teacher Dashboard:**
- Request 1: 8.54s
- Request 2: 9.05s  
- Request 3: 112ms

**สาเหตุ:**
- React 19 Lazy Loading ทำให้ `TeacherDashboardClient` mount ซ้ำ
- useEffect ไม่มี dependency array ที่ถูกต้อง
- Heatmap month change trigger ทำให้เรียก API อีกครั้ง
- ไม่มี Request Deduplication

### 2. API Response ช้ามาก (6-9 วินาที)

**สาเหตุ:**
- Prisma Query มี complex conditions หลายเงื่อนไข
- N+1 Query Problem ในการ select relations
- **Public Dashboard:** Heatmap query ใช้ `leaveDay.findMany()` + `include: { leave }` ช้ามาก
- **Teacher Dashboard:** Query หลายตัวไม่ optimize

---

## การแก้ไข

### ✅ 1. แก้ Duplicate API Calls

#### 1.1 ลบ Lazy Loading (app/teacher/page.tsx)
```typescript
// ❌ Before
const TeacherDashboardClient = lazy(() => import('./TeacherDashboardClient'));

// ✅ After
import TeacherDashboardClient from './TeacherDashboardClient';
```

#### 1.2 สร้าง fetchCache Utility (lib/fetchCache.ts)
```typescript
class FetchCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();

  async fetch<T>(url: string, options?: RequestInit & { cacheDuration?: number }): Promise<T> {
    // 1. Deduplicate: ถ้ามี request ซ้ำ ใช้ promise เดิม
    // 2. Cache: ถ้ามี cache ยังไม่หมดอายุ ใช้ cache
    // 3. Fetch: ถ้าไม่มี ค่อย fetch ใหม่
  }
}
```

**ฟีเจอร์:**
- ✅ Request Deduplication - ป้องกัน duplicate requests
- ✅ In-memory Cache - cache ข้อมูล 30-60 วินาที
- ✅ Console Logging - debug ง่าย

#### 1.3 เพิ่ม initialLoadRef ป้องกัน useEffect ซ้ำ

**app/page.tsx:**
```typescript
const initialLoadRef = useRef(false);
const initialDateRef = useRef(new Date().getTime());

useEffect(() => {
  if (!initialLoadRef.current) {
    initialLoadRef.current = true;
    fetchData();
  }
}, []);
```

**app/teacher/TeacherDashboardClient.tsx:**
```typescript
const initialLoadRef = useRef(false);

useEffect(() => {
  if (!initialLoadRef.current && teacher) {
    initialLoadRef.current = true;
    fetchDashboard();
  }
}, [teacher]);
```

---

### ✅ 2. ปรับปรุง Database Performance

#### 2.1 เพิ่ม Database Indexes (prisma/schema.prisma)

```prisma
model Leave {
  // ... existing indexes ...
  @@index([teacherId, status, startDate])  // ใหม่: สำหรับ dashboard queries
  @@index([teacherId, createdAt])          // ใหม่: สำหรับ recent leaves
}

model LeaveDay {
  @@index([date, leaveId])  // ใหม่: สำหรับ heatmap
}
```

#### 2.2 Optimize Public Dashboard API (app/api/public/dashboard/route.ts)

**❌ Before: Query จาก LeaveDay (ช้า)**
```typescript
// Query leaveDays → include leave → include teacher (N+1 problem)
prisma.leaveDay.findMany({
  where: {
    date: { gte: monthStart, lte: monthEnd },
    leave: { status: 'approved' },
  },
  include: {
    leave: {
      select: { id, type, teacher: {...} }
    }
  }
})
```

**✅ After: Query จาก Leave (เร็ว)**
```typescript
// Query leaves → include filtered leaveDays (1 query แทน N queries)
prisma.leave.findMany({
  where: {
    status: 'approved',
    startDate: { lte: monthEnd },
    endDate: { gte: monthStart },
  },
  select: {
    id: true,
    type: true,
    teacher: {...},
    leaveDays: {
      where: { date: { gte: monthStart, lte: monthEnd } },
      select: { date, isHalfDay, halfDayPeriod }
    }
  }
})
```

**ข้อดี:**
- ลด N+1 Problem → แทนที่จะ query หลายครั้ง ใช้แค่ 1 query
- ลด joins → query จาก leave แทน leaveDay
- Filter leaveDays ใน nested select → ได้เฉพาะวันที่ต้องการ

#### 2.3 Optimize Teacher Dashboard API (app/api/teacher/dashboard/route.ts)

**ปรับปรุง:**
- แยก fetch `leaveDays` ออกมา query เฉพาะที่ต้องใช้
- ใช้ Map สำหรับ lookup แทน nested loops
- ลด data ที่ select ออกมา

---

## ผลลัพธ์ที่คาดหวัง

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Duplicate Calls** | 3 ครั้ง | 1 ครั้ง | ✅ ลด 67% |
| **Public Dashboard** | 6.91s | ~1-2s | 🎯 เร็วขึ้น 70-80% |
| **Teacher Dashboard** | 8.54s | ~2-3s | 🎯 เร็วขึ้น 60-70% |
| **Cache Hit** | ไม่มี | < 100ms | ✅ เร็วมาก |
| **Database Load** | สูง | ต่ำ | ✅ ลด 50-70% |

---

## การทดสอบ

### 1. Production Cold Start Test
```bash
# รอ 5 นาที แล้ว refresh หน้า
# เปิด DevTools > Network tab
```

**Expected:**
- เห็น `dashboard?year=2026&month=9` **1 ครั้งเดียว**
- Response time ลดลงเหลือ **1-3 วินาที**
- Console แสดง `[FetchCache] New request: ...`

### 2. Cache Test
```bash
# Refresh หน้าภายใน 60 วินาที
```

**Expected:**
- Response time < 100ms
- Console แสดง `[FetchCache] Cache hit: ...`

### 3. Pull-to-Refresh Test
```bash
# ลากลงเพื่อ refresh
```

**Expected:**
- ถ้ามี duplicate requests จะเห็น `[FetchCache] Deduplicating request: ...`

---

## ไฟล์ที่เปลี่ยนแปลง

### ไฟล์ใหม่:
- ✅ `lib/fetchCache.ts` - Request deduplication & caching utility
- ✅ `PERFORMANCE_IMPROVEMENTS.md` - เอกสารนี้

### ไฟล์ที่แก้ไข:
- ✅ `app/page.tsx` - เพิ่ม fetchCache + initialLoadRef
- ✅ `app/teacher/page.tsx` - ลบ lazy loading
- ✅ `app/teacher/TeacherDashboardClient.tsx` - เพิ่ม fetchCache + initialLoadRef
- ✅ `app/api/public/dashboard/route.ts` - Optimize heatmap query
- ✅ `app/api/teacher/dashboard/route.ts` - Optimize queries
- ✅ `prisma/schema.prisma` - เพิ่ม 3 indexes

---

## Next Steps (ถ้าต้องการปรับปรุงเพิ่ม)

### 1. Redis Cache (สำหรับ Production Scale)
**เหมาะกับ:** Traffic สูง > 100 คน/วัน

```typescript
// Cache ที่ server-side แทน client-side
const cached = await redis.get('dashboard:2026:9');
if (cached) return cached;

const data = await prisma.leave.findMany(...);
await redis.setex('dashboard:2026:9', 60, data);
```

**ข้อดี:**
- ลด database load 90%+
- เร็วมาก < 100ms
- Share cache ระหว่าง users

### 2. React Query (สำหรับ Complex Client State)
**เหมาะกับ:** App ที่มีหลายหน้า, ต้องการ advanced caching

```typescript
const { data } = useQuery({
  queryKey: ['dashboard', teacher.id],
  queryFn: () => fetch('/api/teacher/dashboard').then(r => r.json()),
  staleTime: 30000,
  refetchOnWindowFocus: true,
});
```

**ข้อดี:**
- ลดโค้ด (ไม่ต้องเขียน useState, useEffect)
- Background refetch
- Optimistic updates
- DevTools

### 3. ISR (Incremental Static Regeneration)
**เหมาะกับ:** หน้า Public Dashboard

```typescript
// app/page.tsx
export const revalidate = 60; // Generate ใหม่ทุก 60 วินาที

export default async function HomePage() {
  const data = await fetch('/api/public/dashboard');
  return <div>{data.summary.totalTeachers}</div>;
}
```

**ข้อดี:**
- เร็วมาก < 50ms (ส่ง HTML สำเร็จรูป)
- SEO ดี
- ลด API calls เกือบหมด

---

## สรุป

การแก้ไขครั้งนี้แก้ปัญหาหลัก 2 ข้อ:

1. ✅ **Duplicate API Calls** → แก้ด้วย fetchCache + ปรับ useEffect
2. ✅ **Slow API Response** → แก้ด้วย Query Optimization + Indexes

**Next Step:** Deploy และทดสอบบน Production เพื่อดูผลลัพธ์จริง

หากต้องการปรับปรุงเพิ่มเติม สามารถเพิ่ม Redis Cache, React Query หรือ ISR ได้ตามความเหมาะสม
