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
    const action = searchParams.get('action');

    // Get available fiscal years from database
    if (action === 'years') {
      const years = await prisma.leave.findMany({
        where: { status: 'approved' },
        select: { fiscalYear: true },
        distinct: ['fiscalYear'],
        orderBy: { fiscalYear: 'desc' },
      });
      return NextResponse.json({ years: years.map(y => y.fiscalYear) });
    }

    const fiscalYear = parseInt(searchParams.get('fiscalYear') || String(getFiscalYear(new Date())));
    const round = parseInt(searchParams.get('round') || String(getLeavePeriod(new Date()))) as 1 | 2;

    // Calculate date range for the round
    let startDate: Date;
    let endDate: Date;

    if (round === 1) {
      // Round 1: Oct - Mar (previous CE year Oct to current CE year Mar)
      const ceYear = fiscalYear - 543;
      startDate = new Date(ceYear - 1, 9, 1); // Oct 1 of previous year
      endDate = new Date(ceYear, 2, 31); // Mar 31
    } else {
      // Round 2: Apr - Sep
      const ceYear = fiscalYear - 543;
      startDate = new Date(ceYear, 3, 1); // Apr 1
      endDate = new Date(ceYear, 8, 30); // Sep 30
    }

    // Get all active teachers with their leaves in one query
    const teachers = await prisma.teacher.findMany({
      where: { isActive: true },
      select: {
        id: true,
        teacherCode: true,
        title: true,
        firstName: true,
        lastName: true,
        department: true,
        leaves: {
          where: {
            status: 'approved',
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: {
            id: true,
            leaveNo: true,
            type: true,
            customTypeName: true,
            startDate: true,
            endDate: true,
            daysWorking: true,
            isHalfDay: true,
          },
        },
      },
      orderBy: [{ teacherCode: 'asc' }],
    });

    // Calculate stats using the already-loaded leaves
    const teacherStats = teachers.map((teacher) => {
      const teacherLeaves = teacher.leaves;

      const sickLeaves = teacherLeaves.filter((l) => l.type === 'sick');
      const sickCount = sickLeaves.length;
      const sickDays = sickLeaves.reduce((sum, l) => sum + l.daysWorking, 0);

      const personalLeaves = teacherLeaves.filter((l) => l.type === 'personal');
      const personalCount = personalLeaves.length;
      const personalDays = personalLeaves.reduce((sum, l) => sum + l.daysWorking, 0);

      const maternityLeaves = teacherLeaves.filter((l) => l.type === 'maternity');
      const maternityCount = maternityLeaves.length;
      const maternityDays = maternityLeaves.reduce((sum, l) => sum + l.daysWorking, 0);

      const religiousLeaves = teacherLeaves.filter((l) => l.type === 'religious');
      const religiousCount = religiousLeaves.length;
      const religiousDays = religiousLeaves.reduce((sum, l) => sum + l.daysWorking, 0);

      const otherLeaves = teacherLeaves.filter((l) => l.type === 'other');
      const otherCount = otherLeaves.length;
      const otherDays = otherLeaves.reduce((sum, l) => sum + l.daysWorking, 0);

      const totalDays = sickDays + personalDays + maternityDays + religiousDays + otherDays;
      const totalCount = sickCount + personalCount + maternityCount + religiousCount + otherCount;

      return {
        id: teacher.id,
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
        leaves: teacherLeaves.map((l) => ({
          id: l.id,
          leaveNo: l.leaveNo,
          type: l.type,
          customTypeName: l.customTypeName,
          startDate: l.startDate.toISOString().split('T')[0],
          endDate: l.endDate.toISOString().split('T')[0],
          daysWorking: l.daysWorking,
          isHalfDay: l.isHalfDay,
        })),
      };
    });

    // Calculate totals
    const totalTeachers = teachers.length;
    const totalSickDays = teacherStats.reduce((sum, t) => sum + t.sickDays, 0);
    const totalPersonalDays = teacherStats.reduce((sum, t) => sum + t.personalDays, 0);
    const totalDays = teacherStats.reduce((sum, t) => sum + t.totalDays, 0);

    return NextResponse.json({
      fiscalYear,
      round,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      summary: {
        totalTeachers,
        totalSickDays,
        totalPersonalDays,
        totalDays,
      },
      teachers: teacherStats,
    });
  } catch (error) {
    console.error('Error fetching leave summary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
