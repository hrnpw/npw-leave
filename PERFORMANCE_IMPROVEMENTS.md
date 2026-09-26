# Performance Improvements - Dashboard Loading

## วันที่: 2026-09-26

## ปัญหาที่พบ
จาก Network tab พบว่า:
1. Dashboard API ถูกเรียกซ้ำ 3 ครั้ง (8.54s, 9.05s, 112ms)
2. API response ช้ามาก 8-9 วินาที สำหรับ data ขนาด 1-2 KB
3. ไม่มี request deduplication

## การแก้ไข

### 1. แก้ Duplicate API Calls

#### ก. ลบ lazy loading ที่ทำให้ component mount ซ้ำ
**ไฟล์:** `app/teacher/page.tsx`
```typescript
// Before
const TeacherDashboardClient = lazy(() => import('./TeacherDashboardClient'));

// After
import TeacherDashboardClient from './TeacherDashboardClient';
```

#### ข. เพิ่ม initialLoadRef เพื่อป้องกัน double fetch
**ไฟล์:** `app/page.tsx`, `app/teacher/TeacherDashboardClient.tsx`
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

#### ค. สร้าง Fetch Cache Utility สำหรับ deduplication
**ไฟล์:** `lib/fetchCache.ts`
- ป้องกัน duplicate requests ที่เกิดพร้อมกัน
- Cache results เป็นเวลา 30-60 วินาที
- Automatic cleanup

**การใช้งาน:**
```typescript
import { fetchCache } from '@/lib/fetchCache';

const data = await fetchCache.fetch('/api/teacher/dashboard', {
  cacheDuration: 30000 // 30 seconds
});
```

### 2. Database Query Optimization

#### ก. เพิ่ม Database Indexes
**ไฟล์:** `prisma/schema.prisma`

เพิ่ม indexes ใหม่:
- `@@index([teacherId, status, startDate])` - สำหรับ dashboard queries
- `@@index([teacherId, createdAt])` - สำหรับ recent leaves
- `@@index([date, leaveId])` - สำหรับ leave days heatmap

#### ข. ลด N+1 Query Problem
**ไฟล์:** `app/api/teacher/dashboard/route.ts`

**Before:**
```typescript
leaveDays: {
  select: { isHalfDay: true, halfDayPeriod: true },
  take: 1,
}
```

**After:**
```typescript
// Fetch leaveDays separately, only for upcoming leaves
const leaveDaysForUpcoming = await prisma.leaveDay.findMany({
  where: { leaveId: { in: upcomingLeaveIds } },
  select: { leaveId: true, isHalfDay: true, halfDayPeriod: true },
});
```

### 3. API Response Headers
เพิ่ม cache control headers ที่เหมาะสม:

**Public Dashboard:**
```typescript
headers: {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
}
```

**Teacher Dashboard:**
```typescript
headers: {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
}
```

## ผลลัพธ์ที่คาดหวัง

### Before:
- ❌ API เรียก 3 ครั้ง
- ❌ Response time: 8-9 วินาที
- ❌ ไม่มี deduplication

### After:
- ✅ API เรียก 1 ครั้ง (deduplication ทำงาน)
- ✅ Response time คาดว่าจะลดลง 50-70% (จาก index + query optimization)
- ✅ Subsequent loads จาก cache (< 100ms)
- ✅ Database load ลดลง

## การทดสอบ

1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. ดู Network tab:
   - ต้องเห็น dashboard API ถูกเรียกครั้งเดียว
   - Response time ควรเร็วขึ้น
   - Request ที่ 2-3 ต้องมา from cache

4. ทดสอบ pull-to-refresh:
   - Cache ถูก clear
   - Data refresh ได้

## Files Changed

- ✅ `app/page.tsx` - เพิ่ม fetchCache + ปรับ useEffect
- ✅ `app/teacher/page.tsx` - ลบ lazy loading
- ✅ `app/teacher/TeacherDashboardClient.tsx` - เพิ่ม fetchCache + ปรับ useEffect
- ✅ `app/api/teacher/dashboard/route.ts` - ปรับ query optimization
- ✅ `prisma/schema.prisma` - เพิ่ม indexes
- ✅ `lib/fetchCache.ts` - สร้าง fetch cache utility

## Next Steps (Optional)

หากต้องการปรับปรุงเพิ่มเติม:
1. เพิ่ม Redis cache ที่ API layer
2. ใช้ React Query สำหรับ client-side caching
3. Implement Incremental Static Regeneration (ISR) สำหรับ public dashboard
4. Add API rate limiting
5. Implement GraphQL สำหรับ flexible data fetching
