import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { formatDateForAPI } from '@/lib/dateFormat';

/**
 * Optimized pending leaves API - fixes N+1 query problem
 * GET /api/hr/approvals/pending-optimized?page=1&limit=20
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

    // Get settings for quota checking
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    const quotas = {
      sickPersonal: settings?.quotaSickPersonal || 23,
      maternity: settings?.quotaMaternity || 90,
      religious: settings?.quotaReligious || 120,
    };

    // Fetch pending leaves and total count in parallel
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

    // Early return if no leaves
    if (leaves.length === 0) {
      return NextResponse.json({
        leaves: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Get unique teacher IDs
    const teacherIds = [...new Set(leaves.map(l => l.teacherId))];

    // Calculate date ranges for each leave to determine their period
    const leavePeriodData = leaves.map(leave => {
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

      return {
        leaveId: leave.id,
        teacherId: leave.teacherId,
        periodStart,
        periodEnd,
      };
    });

    // Get ALL period start/end dates
    const allPeriodStarts = leavePeriodData.map(p => p.periodStart);
    const allPeriodEnds = leavePeriodData.map(p => p.periodEnd);
    const minPeriodStart = new Date(Math.min(...allPeriodStarts.map(d => d.getTime())));
    const maxPeriodEnd = new Date(Math.max(...allPeriodEnds.map(d => d.getTime())));

    // Fetch ALL approved + pending leaves for these teachers in one query
    // This is the key optimization: 1 query instead of N queries
    const allTeacherLeaves = await prisma.leave.findMany({
      where: {
        teacherId: {
          in: teacherIds,
        },
        status: {
          in: ['approved', 'pending'],
        },
        startDate: {
          gte: minPeriodStart,
          lte: maxPeriodEnd,
        },
      },
      select: {
        id: true,
        teacherId: true,
        type: true,
        daysCalendar: true,
        startDate: true,
      },
    });

    // Build a map: teacherId -> period -> leaves
    const teacherPeriodLeavesMap = new Map<string, Map<string, typeof allTeacherLeaves>>();

    for (const leave of allTeacherLeaves) {
      if (!teacherPeriodLeavesMap.has(leave.teacherId)) {
        teacherPeriodLeavesMap.set(leave.teacherId, new Map());
      }

      const teacherMap = teacherPeriodLeavesMap.get(leave.teacherId)!;

      // Determine which period this leave belongs to
      const month = leave.startDate.getMonth();
      let periodKey: string;

      if (month >= 3 && month <= 8) {
        periodKey = `${leave.startDate.getFullYear()}-1`;
      } else if (month >= 9) {
        periodKey = `${leave.startDate.getFullYear()}-2`;
      } else {
        periodKey = `${leave.startDate.getFullYear() - 1}-2`;
      }

      if (!teacherMap.has(periodKey)) {
        teacherMap.set(periodKey, []);
      }

      teacherMap.get(periodKey)!.push(leave);
    }

    // Calculate quota for each leave
    const leavesWithQuota = leaves.map(leave => {
      const periodData = leavePeriodData.find(p => p.leaveId === leave.id)!;
      const month = leave.startDate.getMonth();
      let periodKey: string;

      if (month >= 3 && month <= 8) {
        periodKey = `${leave.startDate.getFullYear()}-1`;
      } else if (month >= 9) {
        periodKey = `${leave.startDate.getFullYear()}-2`;
      } else {
        periodKey = `${leave.startDate.getFullYear() - 1}-2`;
      }

      // Get leaves for this teacher in this period
      const teacherMap = teacherPeriodLeavesMap.get(leave.teacherId);
      const periodLeaves = teacherMap?.get(periodKey) || [];

      // Calculate usage
      let sickPersonalUsed = 0;
      let maternityUsed = 0;
      let religiousUsed = 0;

      for (const l of periodLeaves) {
        if (l.type === 'sick' || l.type === 'personal') {
          sickPersonalUsed += l.daysCalendar;
        } else if (l.type === 'maternity') {
          maternityUsed += l.daysCalendar;
        } else if (l.type === 'religious') {
          religiousUsed += l.daysCalendar;
        }
      }

      // Check if exceeds
      let exceedsQuota = false;
      let quotaDetails = null;

      if (leave.type === 'sick' || leave.type === 'personal') {
        if (sickPersonalUsed > quotas.sickPersonal) {
          exceedsQuota = true;
          quotaDetails = {
            type: 'sickPersonal',
            used: sickPersonalUsed,
            quota: quotas.sickPersonal,
            exceeds: sickPersonalUsed - quotas.sickPersonal,
          };
        }
      } else if (leave.type === 'maternity') {
        if (maternityUsed > quotas.maternity) {
          exceedsQuota = true;
          quotaDetails = {
            type: 'maternity',
            used: maternityUsed,
            quota: quotas.maternity,
            exceeds: maternityUsed - quotas.maternity,
          };
        }
      } else if (leave.type === 'religious') {
        if (religiousUsed > quotas.religious) {
          exceedsQuota = true;
          quotaDetails = {
            type: 'religious',
            used: religiousUsed,
            quota: quotas.religious,
            exceeds: religiousUsed - quotas.religious,
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
    console.error('Get pending leaves optimized error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
