import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { formatDateForAPI } from '@/lib/dateFormat';

export const dynamic = 'force-dynamic'; // Uses cookies for auth

/**
 * Get pending leaves for approval
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [leaves, total] = await Promise.all([
      prisma.leave.findMany({
        where: {
          status: 'pending',
        },
        orderBy: {
          createdAt: 'asc', // Oldest first (waiting longest)
        },
        skip,
        take: limit,
        select: {
          id: true,
          leaveNo: true,
          fiscalYear: true,
          round: true,
          type: true,
          customTypeName: true,
          startDate: true,
          endDate: true,
          isHalfDay: true,
          halfDayPeriod: true,
          daysWorking: true,
          daysCalendar: true,
          reason: true,
          contactAddress: true,
          submittedByType: true,
          teacherId: true,
          createdAt: true,
          teacher: {
            select: {
              teacherCode: true,
              title: true,
              firstName: true,
              lastName: true,
              position: true,
              department: true,
            },
          },
          submittedByHr: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
            },
          },
        },
      }),
      prisma.leave.count({
        where: {
          status: 'pending',
        },
      }),
    ]);

    // Get settings for quota checking
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    const quotas = {
      sickPersonal: settings?.quotaSickPersonal || 23,
      maternity: settings?.quotaMaternity || 90,
      religious: settings?.quotaReligious || 120,
    };

    // Get unique teacher IDs
    const teacherIds = [...new Set(leaves.map(l => l.teacherId))];

    // Calculate period ranges for all leaves (group by period)
    const periodRanges = new Map<string, { start: Date; end: Date }>();

    for (const leave of leaves) {
      const startDate = leave.startDate;
      const month = startDate.getMonth();
      let periodStart: Date, periodEnd: Date;

      if (month >= 3 && month <= 8) {
        // Period 1: Apr 1 - Sep 30
        periodStart = new Date(startDate.getFullYear(), 3, 1);
        periodEnd = new Date(startDate.getFullYear(), 8, 30);
      } else {
        // Period 2: Oct 1 - Mar 31
        if (month >= 9) {
          periodStart = new Date(startDate.getFullYear(), 9, 1);
          periodEnd = new Date(startDate.getFullYear() + 1, 2, 31);
        } else {
          periodStart = new Date(startDate.getFullYear() - 1, 9, 1);
          periodEnd = new Date(startDate.getFullYear(), 2, 31);
        }
      }

      const key = `${periodStart.getTime()}-${periodEnd.getTime()}`;
      if (!periodRanges.has(key)) {
        periodRanges.set(key, { start: periodStart, end: periodEnd });
      }
    }

    // Fetch ALL relevant leaves for these teachers in ONE query
    const allPeriods = Array.from(periodRanges.values());
    const minDate = new Date(Math.min(...allPeriods.map(p => p.start.getTime())));
    const maxDate = new Date(Math.max(...allPeriods.map(p => p.end.getTime())));

    const allTeacherLeaves = await prisma.leave.findMany({
      where: {
        teacherId: { in: teacherIds },
        status: { in: ['approved', 'pending'] },
        startDate: { gte: minDate, lte: maxDate },
      },
      select: {
        teacherId: true,
        type: true,
        daysCalendar: true,
        startDate: true,
      },
    });

    // Build a map: teacherId -> period -> usage
    const usageMap = new Map<string, Map<string, { sickPersonal: number; maternity: number; religious: number }>>();

    for (const tLeave of allTeacherLeaves) {
      const month = tLeave.startDate.getMonth();
      let periodStart: Date, periodEnd: Date;

      if (month >= 3 && month <= 8) {
        periodStart = new Date(tLeave.startDate.getFullYear(), 3, 1);
        periodEnd = new Date(tLeave.startDate.getFullYear(), 8, 30);
      } else {
        if (month >= 9) {
          periodStart = new Date(tLeave.startDate.getFullYear(), 9, 1);
          periodEnd = new Date(tLeave.startDate.getFullYear() + 1, 2, 31);
        } else {
          periodStart = new Date(tLeave.startDate.getFullYear() - 1, 9, 1);
          periodEnd = new Date(tLeave.startDate.getFullYear(), 2, 31);
        }
      }

      const periodKey = `${periodStart.getTime()}-${periodEnd.getTime()}`;

      if (!usageMap.has(tLeave.teacherId)) {
        usageMap.set(tLeave.teacherId, new Map());
      }

      const teacherMap = usageMap.get(tLeave.teacherId)!;
      if (!teacherMap.has(periodKey)) {
        teacherMap.set(periodKey, { sickPersonal: 0, maternity: 0, religious: 0 });
      }

      const usage = teacherMap.get(periodKey)!;
      if (tLeave.type === 'sick' || tLeave.type === 'personal') {
        usage.sickPersonal += tLeave.daysCalendar;
      } else if (tLeave.type === 'maternity') {
        usage.maternity += tLeave.daysCalendar;
      } else if (tLeave.type === 'religious') {
        usage.religious += tLeave.daysCalendar;
      }
    }

    // Calculate quota for each leave (NO more queries!)
    const leavesWithQuota = leaves.map((leave) => {
      const startDate = leave.startDate;
      const month = startDate.getMonth();
      let periodStart: Date, periodEnd: Date;

      if (month >= 3 && month <= 8) {
        periodStart = new Date(startDate.getFullYear(), 3, 1);
        periodEnd = new Date(startDate.getFullYear(), 8, 30);
      } else {
        if (month >= 9) {
          periodStart = new Date(startDate.getFullYear(), 9, 1);
          periodEnd = new Date(startDate.getFullYear() + 1, 2, 31);
        } else {
          periodStart = new Date(startDate.getFullYear() - 1, 9, 1);
          periodEnd = new Date(startDate.getFullYear(), 2, 31);
        }
      }

      const periodKey = `${periodStart.getTime()}-${periodEnd.getTime()}`;
      const usage = usageMap.get(leave.teacherId)?.get(periodKey) || { sickPersonal: 0, maternity: 0, religious: 0 };

      let exceedsQuota = false;
      let quotaDetails = null;

      if (leave.type === 'sick' || leave.type === 'personal') {
        if (usage.sickPersonal > quotas.sickPersonal) {
          exceedsQuota = true;
          quotaDetails = {
            type: 'sickPersonal',
            used: usage.sickPersonal,
            quota: quotas.sickPersonal,
            exceeds: usage.sickPersonal - quotas.sickPersonal,
          };
        }
      } else if (leave.type === 'maternity') {
        if (usage.maternity > quotas.maternity) {
          exceedsQuota = true;
          quotaDetails = {
            type: 'maternity',
            used: usage.maternity,
            quota: quotas.maternity,
            exceeds: usage.maternity - quotas.maternity,
          };
        }
      } else if (leave.type === 'religious') {
        if (usage.religious > quotas.religious) {
          exceedsQuota = true;
          quotaDetails = {
            type: 'religious',
            used: usage.religious,
            quota: quotas.religious,
            exceeds: usage.religious - quotas.religious,
          };
        }
      }

      return {
        ...leave,
        exceedsQuota,
        quotaDetails,
      };
    });

    return NextResponse.json({
      leaves: leavesWithQuota.map((leave) => ({
        id: leave.id,
        leaveNo: leave.leaveNo,
        type: leave.type,
        customTypeName: leave.customTypeName,
        startDate: formatDateForAPI(leave.startDate),
        endDate: formatDateForAPI(leave.endDate),
        isHalfDay: leave.isHalfDay,
        halfDayPeriod: leave.halfDayPeriod,
        daysWorking: leave.daysWorking,
        daysCalendar: leave.daysCalendar,
        reason: leave.reason,
        contactAddress: leave.contactAddress,
        submittedByType: leave.submittedByType,
        submittedByHr: leave.submittedByHr,
        teacher: leave.teacher,
        attachments: leave.attachments,
        createdAt: leave.createdAt.toISOString(),
        exceedsQuota: leave.exceedsQuota,
        quotaDetails: leave.quotaDetails,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get pending leaves error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
