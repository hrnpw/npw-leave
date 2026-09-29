# ปัญหา: หน้าเว็บ Refresh/โหลดข้อมูล 2 ครั้ง

## สาเหตุ

มีการโหลด heatmap data ซ้ำซ้อนเนื่องจาก **state update chain** ที่ไม่ตั้งใจ:

### Flow ที่เกิดขึ้น

```
1. useEffect แรก (บรรทัด 78-83)
   → เรียก fetchData()

2. fetchData() ทำงาน:
   → โหลด summary
   → โหลด heatmap
   → setCurrentHeatmapDate(today)  ← จุดที่เกิดปัญหา

3. การเซ็ต currentHeatmapDate trigger useEffect ที่สอง (บรรทัด 85-91)
   → เรียก fetchHeatmapData() อีกครั้ง ← โหลดซ้ำ!
```

### โค้ดที่เป็นปัญหา (บรรทัด 118-121)

```tsx
setHeatmapData(heatmapData.heatmap);
setHolidays(heatmapData.holidays);
initialDateRef.current = today.getTime();
setCurrentHeatmapDate(today); // ← บรรทัดนี้ trigger useEffect ที่สอง
```

แม้จะมี `initialDateRef` เพื่อป้องกัน แต่ timing ของ React state batching อาจทำให้ยังโหลดซ้ำได้

## วิธีแก้

**ไม่ต้องเซ็ต `currentHeatmapDate` ใน `fetchData()`** เพราะ:
- State นี้ initialize เป็น `new Date()` อยู่แล้ว (บรรทัด 62)
- การ fetch ครั้งแรกใช้ค่า today ที่คำนวณใหม่ใน fetchData() 
- ไม่จำเป็นต้อง sync กลับไปที่ state

### แก้ไข: ลบบรรทัดที่ 121

```diff
  setHeatmapData(heatmapData.heatmap);
  setHolidays(heatmapData.holidays);
  initialDateRef.current = today.getTime();
- setCurrentHeatmapDate(today);
```

### เหตุผล

- `currentHeatmapDate` ใช้เฉพาะเมื่อ user เปลี่ยนเดือนผ่าน HeatmapCalendar
- การโหลดครั้งแรกไม่จำเป็นต้องเซ็ต state นี้
- useEffect ที่สองจะทำงานก็ต่อเมื่อ user คลิกเปลี่ยนเดือนจริงๆ

## ผลลัพธ์

- ลด API calls จาก 3 ครั้ง (summary + heatmap + heatmap ซ้ำ) เหลือ 2 ครั้ง (summary + heatmap)
- หน้าเว็บไม่มีอาการ "กระตุก" หรือ flicker จาก re-render ที่ไม่จำเป็น
- ประหยัด bandwidth และ server load
