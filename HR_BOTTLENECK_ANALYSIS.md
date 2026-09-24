# HR Section - Performance Bottleneck Analysis

วิเคราะห์เมื่อ: 2026-09-24

---

## 📋 สรุปผล

พบ bottlenecks หลัก **3 จุด**:

1. ✅ **HR Dashboard** - รวม API แล้ว (ดีอยู่)
2. ⚠️ **Approvals Pending** - N+1 query problem (ร้ายแรง)
3. ⚠️ **Leaves List** - ใช้ skip/take pagination (ช้าเมื่อหน้าใหญ่)

---

## 🔍 การวิเคราะห์แต่ละส่วน

### 1. ✅ HR Dashboard - **ไม่มีปัญหา**

**ไฟล์:** `app/api/hr/dashboard/all/route.ts`

**สถานะ:** ✅ Optimized แล้ว

**เหตุผล:**
- ใช้ `Promise.all()` รวม 8 queries ทำงาน parallel
- มี caching (`revalidate = 60`)
- ไม่ซ้ำซ้อนกับ Public dashboard
- โหลดข้อมูลเฉพาะที่จำเป็น

**ไม่ต้องแก้**

---

### 2. ⚠️ **Approvals Pending - N+1 Query Problem**

**ไฟล์:** `app/api/hr/approvals/pending/route.ts`

**ปัญหา:**
```typescript
// ❌ ปัญหา: query quota สำหรับทุกใบลา (N+1)
const leavesWithQuota = await Promise.all(
  leaves.map(async (leave) => {
    // สำหรับแต่ละใบลา:
    const periodLeaves = await prisma.leave.findMany({...}); // +1 query
    // คำนวณ quota...
  })
);
```

**ผลกระทบ:**
- ถ้ามี 20 ใบลา = 1 + 20 = **21 queries**
- ถ้ามี 50 ใบลา = 1 + 50 = **51 queries**
- เวลาโหลดช้ามาก เมื่อมีใบลารออนุมัติเยอะ

**แก้ไขอย่างไร:**
ดึงข้อมูล quota ทั้งหมดใน 1 query แล้วคำนวณใน memory

---

### 3. ⚠️ **Leaves List - Skip/Take Pagination**

**ไฟล์:** `app/api/hr/leaves/route.ts`

**ปัญหา:**
```typescript
// ❌ ใช้ skip/take pagination
const skip = (page - 1) * limit;
prisma.leave.findMany({
  skip,
  take: limit,
  // ...
});
```

**ผลกระทบ:**
- หน้า 1: skip 0 → เร็ว
- หน้า 10: skip 180 → ช้า
- หน้า 50: skip 980 → **ช้ามาก**

**เหมือนกับ Teacher History ที่แก้ไปแล้ว**

**แก้ไขอย่างไร:**
ใช้ cursor-based pagination เหมือน `history-optimized`

---

## 📊 ความรุนแรงของปัญหา

| ส่วน | ปัญหา | ความรุนแรง | ผลกระทบ |
|------|-------|-----------|----------|
| Dashboard | ไม่มี | - | ✅ โหลดเร็ว |
| Approvals | N+1 queries | 🔴 สูง | ช้ามากเมื่อมีใบลารออนุมัติเยอะ |
| Leaves List | Skip/take | 🟡 ปานกลาง | ช้าเมื่อเปิดหน้าใหญ่ (10+) |

---

## 💡 แนะนำการแก้ไข

### ลำดับความสำคัญ

**1. แก้ Approvals Pending ก่อน (สำคัญที่สุด)**
- ปัญหารุนแรงที่สุด
- ส่งผลต่อ UX ของ HR โดยตรง
- แก้ไม่ยาก: รวม query แล้วคำนวณใน memory

**2. แก้ Leaves List Pagination (สำคัญรอง)**
- ใช้ cursor-based เหมือน Teacher History
- Optional: เพราะ HR ไม่ค่อยเปิดหน้าใหญ่
- แต่ถ้าแก้จะดีมาก (future-proof)

---

## 🎯 Solution ที่แนะนำ

### Solution 1: ✅ แก้ Approvals N+1 Query

**สร้างไฟล์ใหม่:** `app/api/hr/approvals/pending-optimized/route.ts`

**แนวทาง:**
1. ดึงใบลา pending ทั้งหมด (1 query)
2. ดึงข้อมูล quota ของ teachers ทั้งหมดใน 1 query
3. Join และคำนวณใน memory (JavaScript)

**ผลลัพธ์:**
- จาก N+1 queries → **3 queries** (fixed)
- เร็วขึ้น ~10x เมื่อมีใบลาเยอะ

**Breaking changes:** ไม่มี (สร้าง API ใหม่)

---

### Solution 2: Optional - Leaves Cursor Pagination

**สร้างไฟล์ใหม่:** `app/api/hr/leaves-optimized/route.ts`

**แนวทาง:**
- Copy logic จาก `teacher/leaves/history-optimized`
- เพิ่ม filters ทั้งหมด (status, type, department, etc.)
- ใช้ cursor-based pagination

**ผลลัพธ์:**
- หน้าใหญ่โหลดเร็วขึ้น ~5-10x
- UX ดีขึ้น (optional infinite scroll)

**Breaking changes:** ไม่มี (สร้าง API ใหม่)

---

## 📈 ประมาณการผลลัพธ์

### ถ้าแก้ Approvals (แนะนำ)

| Scenario | ก่อนแก้ | หลังแก้ | ปรับปรุง |
|----------|---------|---------|----------|
| 10 ใบลา | ~500ms | ~150ms | **-70%** |
| 30 ใบลา | ~1500ms | ~200ms | **-87%** |
| 50 ใบลา | ~2500ms | ~250ms | **-90%** |

### ถ้าแก้ Leaves Pagination (Optional)

| Scenario | ก่อนแก้ | หลังแก้ | ปรับปรุง |
|----------|---------|---------|----------|
| หน้า 1 | ~100ms | ~100ms | เท่าเดิม |
| หน้า 10 | ~400ms | ~100ms | **-75%** |
| หน้า 50 | ~1500ms | ~100ms | **-93%** |

---

## ⚠️ หมายเหตุ

### Client Components
- `HrDashboardClient.tsx` - ✅ ดีอยู่ (เรียก `/api/hr/dashboard/all`)
- `ApprovalsClient.tsx` - ⚠️ จะได้ประโยชน์จากการแก้ API
- `LeavesClient.tsx` - 🟡 ใช้ skip/take pagination (แต่ไม่วิกฤต)

### Database Indexes
ตรวจสอบแล้ว - **มี indexes ครบ**:
- `Leave: [teacherId, status, createdAt]` ✅
- `Leave: [status, startDate, endDate]` ✅
- `Leave: [teacherId, type, status, createdAt]` ✅

---

## 🚀 ขั้นตอนต่อไป

**ถ้าต้องการแก้:**

1. ✅ **แก้ Approvals N+1 Query** (แนะนำมาก)
   - สร้าง API ใหม่ที่ดึง quota ใน 1 query
   - เร็วขึ้นเยอะมาก (~10x)
   - แก้ปัญหาที่ร้ายแรงที่สุด

2. 🟡 **แก้ Leaves Pagination** (Optional)
   - สร้าง cursor-based API
   - ดีสำหรับ future-proofing
   - แต่ไม่ด่วนเท่า Approvals

3. ⏭️ **ไม่ต้องแก้อะไร**
   - Dashboard ดีอยู่แล้ว
   - ปัญหาไม่ร้ายแรงพอ

---

**ต้องการให้แก้หรือไม่?**
- ถ้าใช่: บอกว่าต้องการแก้อะไร (Approvals, Leaves, หรือทั้งคู่)
- ถ้าไม่: เอกสารนี้เก็บไว้เป็นข้อมูลอ้างอิง
