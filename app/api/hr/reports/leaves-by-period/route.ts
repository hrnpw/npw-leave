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
    const period = searchParams.get('period'); // '1' or '2'
    const year = searchParams.get('year');
    const format = searchParams.get('format'); // 'json' or 'excel'

    if (!period || !year) {
      return NextResponse.json(
        { error: 'period and year are required' },
        { status: 400 }
      );
    }

    const periodNum = parseInt(period);
    const yearNum = parseInt(year);

    const { startDate, endDate } = getPeriodDates(periodNum, yearNum);

    const teachers = await prisma.teacher.findMany({
      where: { isActive: true },
      include: {
        leaves: {
          where: {
            status: 'approved',
            startDate: { gte: startDate, lte: endDate },
          },
        },
      },
      orderBy: { teacherCode: 'asc' },
    });

    const report = teachers.map((teacher) => {
      const sickPersonal = teacher.leaves
        .filter((l) => l.type === 'sick' || l.type === 'personal')
        .reduce(
          (acc, l) => ({
            working: acc.working + l.daysWorking,
            calendar: acc.calendar + l.daysCalendar,
          }),
          { working: 0, calendar: 0 }
        );

      const maternity = teacher.leaves
        .filter((l) => l.type === 'maternity')
        .reduce(
          (acc, l) => ({
            working: acc.working + l.daysWorking,
            calendar: acc.calendar + l.daysCalendar,
          }),
          { working: 0, calendar: 0 }
        );

      const religious = teacher.leaves
        .filter((l) => l.type === 'religious')
        .reduce(
          (acc, l) => ({
            working: acc.working + l.daysWorking,
            calendar: acc.calendar + l.daysCalendar,
          }),
          { working: 0, calendar: 0 }
        );

      const other = teacher.leaves
        .filter((l) => l.type === 'other')
        .reduce(
          (acc, l) => ({
            working: acc.working + l.daysWorking,
            calendar: acc.calendar + l.daysCalendar,
          }),
          { working: 0, calendar: 0 }
        );

      const exceedingSickPersonal = sickPersonal.calendar > 23;
      const exceedingMaternity = maternity.calendar > 90;
      const exceedingReligious = religious.calendar > 120;

      return {
        teacherId: teacher.id,
        teacherCode: teacher.teacherCode,
        title: teacher.title,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        position: teacher.position,
        department: teacher.department || '-',
        sickPersonalWorking: sickPersonal.working,
        sickPersonalCalendar: sickPersonal.calendar,
        maternityWorking: maternity.working,
        maternityCalendar: maternity.calendar,
        religiousWorking: religious.working,
        religiousCalendar: religious.calendar,
        otherWorking: other.working,
        otherCalendar: other.calendar,
        exceedingSickPersonal,
        exceedingMaternity,
        exceedingReligious,
      };
    });

    if (format === 'excel') {
      const excelData = report.map((r) => ({
        รหัสประจำตัว: r.teacherCode,
        ชื่อ: `${r.title}${r.firstName} ${r.lastName}`,
        ตำแหน่ง: r.position,
        'กลุ่มสาระ/ฝ่าย': r.department,
        'ป่วย+กิจ (วันทำการ)': r.sickPersonalWorking,
        'ป่วย+กิจ (ปฏิทิน)': r.sickPersonalCalendar,
        'เกิน 23 วัน': r.exceedingSickPersonal ? 'ใช่' : '',
        'คลอด (วันทำการ)': r.maternityWorking,
        'คลอด (ปฏิทิน)': r.maternityCalendar,
        'เกิน 90 วัน': r.exceedingMaternity ? 'ใช่' : '',
        'ศาสนา (วันทำการ)': r.religiousWorking,
        'ศาสนา (ปฏิทิน)': r.religiousCalendar,
        'เกิน 120 วัน': r.exceedingReligious ? 'ใช่' : '',
        'อื่นๆ (วันทำการ)': r.otherWorking,
        'อื่นๆ (ปฏิทิน)': r.otherCalendar,
      }));

      const buffer = exportToExcel(
        excelData,
        `leaves-by-period-${period}-${year}.xlsx`,
        'สรุปการลารายรอบ'
      );

      return createExcelResponse(
        buffer,
        `leaves-by-period-${period}-${year}.xlsx`
      );
    }

    return NextResponse.json({ report, period: periodNum, year: yearNum });
  } catch (error) {
    console.error('Failed to generate report:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

function getPeriodDates(
  period: number,
  year: number
): { startDate: Date; endDate: Date } {
  if (period === 1) {
    return {
      startDate: new Date(year, 3, 1),
      endDate: new Date(year, 8, 30),
    };
  } else {
    return {
      startDate: new Date(year - 1, 9, 1),
      endDate: new Date(year, 2, 31),
    };
  }
}
