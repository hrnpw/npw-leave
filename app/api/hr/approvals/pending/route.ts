import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { formatDateForAPI } from '@/lib/dateFormat';

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

    // Calculate quota usage for each teacher
    const leavesWithQuota = await Promise.all(
      leaves.map(async (leave) => {
        // Get current period
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

        // Get approved + pending leaves in period
        const periodLeaves = await prisma.leave.findMany({
          where: {
            teacherId: leave.teacherId,
            status: {
              in: ['approved', 'pending'],
            },
            startDate: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
          select: {
            type: true,
            daysCalendar: true,
          },
        });

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
      })
    );

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
