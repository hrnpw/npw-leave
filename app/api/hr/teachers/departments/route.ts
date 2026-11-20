import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Uses cookies for auth

export async function GET() {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await prisma.teacher.findMany({
      where: { isActive: true, department: { not: null } },
      select: { department: true, teacherCode: true },
    });

    // เรียงตามรหัสกลุ่มสาระ = 2 ตัวแรกของรหัสครู (เช่น 1101 -> "11")
    // กลุ่มที่มีครูหลายรหัสใช้ค่าน้อยที่สุด ถ้ารหัสเท่ากันเรียงตามชื่อ
    const prefixByDept = new Map<string, string>();
    for (const r of rows) {
      if (!r.department) continue;
      const prefix = r.teacherCode.slice(0, 2);
      const current = prefixByDept.get(r.department);
      if (current === undefined || prefix < current) {
        prefixByDept.set(r.department, prefix);
      }
    }

    const departments = [...prefixByDept.entries()]
      .sort(
        ([nameA, prefixA], [nameB, prefixB]) =>
          prefixA.localeCompare(prefixB) || nameA.localeCompare(nameB, 'th')
      )
      .map(([name]) => name);

    return NextResponse.json(
      { departments },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (error) {
    console.error('Failed to fetch departments:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
