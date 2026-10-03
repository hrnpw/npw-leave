import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { formatDateForAPI } from '@/lib/dateFormat';

export const dynamic = 'force-dynamic'; // Uses cookies for auth

/**
 * GET /api/hr/reviews/pending
 * คืนรายการใบลาที่รอ HR ตรวจสอบ (status=pending) หรือที่ส่งต่อแล้ว (status=reviewed)
 * ทุก role ของ HR อ่านได้ (ผอ. ดูอย่างเดียว) ส่วนการตรวจ/ตีกลับ/ดึงกลับ เช็คสิทธิ์ที่ POST
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const statusParam = searchParams.get('status') === 'reviewed' ? 'reviewed' : 'pending';
    const skip = (page - 1) * limit;

    const [leaves, total] = await Promise.all([
      prisma.leave.findMany({
        where: { status: statusParam },
        orderBy: {
          createdAt: statusParam === 'pending' ? 'asc' : 'desc', // รอตรวจ: เก่าสุดก่อน / ส่งต่อแล้ว: ใหม่สุดก่อน
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
          reviewedAt: true,
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
      prisma.leave.count({ where: { status: statusParam } }),
    ]);

    return NextResponse.json({
      leaves: leaves.map((leave) => ({
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
        reviewedAt: leave.reviewedAt?.toISOString() ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get reviews pending error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
