import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { exportToExcel, createExcelResponse } from '@/lib/excel/export';

export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const formatType = searchParams.get('format');

    const teachers = await prisma.teacher.findMany({
      where: { isActive: true },
      include: {
        leaves: {
          where: { status: 'approved' },
        },
      },
      orderBy: { department: 'asc' },
    });

    const grouped = teachers.reduce((acc, teacher) => {
      const dept = teacher.department || 'ไม่ระบุ';
      if (!acc[dept]) {
        acc[dept] = {
          department: dept,
          teacherCount: 0,
          totalDays: 0,
        };
      }

      acc[dept].teacherCount++;
      acc[dept].totalDays += teacher.leaves.reduce(
        (sum, l) => sum + l.daysWorking,
        0
      );

      return acc;
    }, {} as Record<string, { department: string; teacherCount: number; totalDays: number }>);

    const report = Object.values(grouped).map((g) => ({
      department: g.department,
      teacherCount: g.teacherCount,
      totalDays: g.totalDays,
      averageDays: g.teacherCount > 0 ? g.totalDays / g.teacherCount : 0,
    }));

    if (formatType === 'excel') {
      const excelData = report.map((r) => ({
        'กลุ่มสาระ/ฝ่าย': r.department,
        'จำนวนครู': r.teacherCount,
        'วันลารวม': r.totalDays.toFixed(1),
        'เฉลี่ยต่อคน': r.averageDays.toFixed(2),
      }));

      const buffer = exportToExcel(
        excelData,
        'leaves-by-department.xlsx',
        'สถิติรายกลุ่มสาระ'
      );

      return createExcelResponse(buffer, 'leaves-by-department.xlsx');
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Failed to generate department report:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
