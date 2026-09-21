import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getFiscalYear, getLeavePeriod } from '@/lib/fiscalYear';

export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || String(getFiscalYear(new Date())));
    const round = parseInt(searchParams.get('round') || String(getLeavePeriod(new Date()))) as 1 | 2;

    // Calculate date range
    let startDate: Date;
    let endDate: Date;

    if (round === 1) {
      const ceYear = fiscalYear - 543;
      startDate = new Date(ceYear - 1, 9, 1);
      endDate = new Date(ceYear, 2, 31);
    } else {
      const ceYear = fiscalYear - 543;
      startDate = new Date(ceYear, 3, 1);
      endDate = new Date(ceYear, 8, 30);
    }

    // Get data
    const teachers = await prisma.teacher.findMany({
      where: { isActive: true },
      select: {
        id: true,
        teacherCode: true,
        title: true,
        firstName: true,
        lastName: true,
        department: true,
      },
      orderBy: [{ teacherCode: 'asc' }],
    });

    const leaves = await prisma.leave.findMany({
      where: {
        status: 'approved',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        teacherId: true,
        type: true,
        daysWorking: true,
      },
    });

    // Build CSV
    const teacherStats = teachers.map((teacher) => {
      const teacherLeaves = leaves.filter((l) => l.teacherId === teacher.id);

      const sickCount = teacherLeaves.filter((l) => l.type === 'sick').length;
      const sickDays = teacherLeaves
        .filter((l) => l.type === 'sick')
        .reduce((sum, l) => sum + l.daysWorking, 0);

      const personalCount = teacherLeaves.filter((l) => l.type === 'personal').length;
      const personalDays = teacherLeaves
        .filter((l) => l.type === 'personal')
        .reduce((sum, l) => sum + l.daysWorking, 0);

      const maternityCount = teacherLeaves.filter((l) => l.type === 'maternity').length;
      const maternityDays = teacherLeaves
        .filter((l) => l.type === 'maternity')
        .reduce((sum, l) => sum + l.daysWorking, 0);

      const religiousCount = teacherLeaves.filter((l) => l.type === 'religious').length;
      const religiousDays = teacherLeaves
        .filter((l) => l.type === 'religious')
        .reduce((sum, l) => sum + l.daysWorking, 0);

      const otherCount = teacherLeaves.filter((l) => l.type === 'other').length;
      const otherDays = teacherLeaves
        .filter((l) => l.type === 'other')
        .reduce((sum, l) => sum + l.daysWorking, 0);

      const totalCount = sickCount + personalCount + maternityCount + religiousCount + otherCount;
      const totalDays = sickDays + personalDays + maternityDays + religiousDays + otherDays;

      return {
        code: teacher.teacherCode,
        name: `${teacher.title}${teacher.firstName} ${teacher.lastName}`,
        department: teacher.department || '-',
        sickCount,
        sickDays,
        personalCount,
        personalDays,
        maternityCount,
        maternityDays,
        religiousCount,
        religiousDays,
        otherCount,
        otherDays,
        totalCount,
        totalDays,
      };
    });

    // Generate CSV
    const headers = [
      'รหัสครู',
      'ชื่อ-สกุล',
      'กลุ่มสาระ',
      'ลาป่วย (ครั้ง)',
      'ลาป่วย (วัน)',
      'ลากิจ (ครั้ง)',
      'ลากิจ (วัน)',
      'ลาคลอด (ครั้ง)',
      'ลาคลอด (วัน)',
      'ลาทางศาสนา (ครั้ง)',
      'ลาทางศาสนา (วัน)',
      'อื่นๆ (ครั้ง)',
      'อื่นๆ (วัน)',
      'รวม (ครั้ง)',
      'รวม (วัน)',
    ];
    const rows = teacherStats.map((t) => [
      t.code,
      t.name,
      t.department,
      t.sickCount,
      t.sickDays.toFixed(1),
      t.personalCount,
      t.personalDays.toFixed(1),
      t.maternityCount,
      t.maternityDays.toFixed(1),
      t.religiousCount,
      t.religiousDays.toFixed(1),
      t.otherCount,
      t.otherDays.toFixed(1),
      t.totalCount,
      t.totalDays.toFixed(1),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const bom = '﻿'; // UTF-8 BOM for Excel

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leave-summary-${fiscalYear}-round${round}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting leave summary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
