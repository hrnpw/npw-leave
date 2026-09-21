import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const LEAVE_TYPE_NAMES: Record<string, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจส่วนตัว',
  maternity: 'ลาคลอดบุตร',
  religious: 'ลาทำศาสนกิจ',
  other: 'อื่นๆ',
};

const STATUS_NAMES: Record<string, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
};

function formatThaiDate(date: Date): string {
  return format(date, 'd MMMM yyyy', { locale: th }).replace(/\d{4}/, (year) =>
    String(parseInt(year) + 543)
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leave_no: string }> }
) {
  try {
    const { leave_no } = await params;

    // Fetch leave with minimal info (public-safe)
    const leave = await prisma.leave.findUnique({
      where: { leaveNo: leave_no },
      select: {
        leaveNo: true,
        teacher: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            teacherCode: true,
          },
        },
        type: true,
        customTypeName: true,
        startDate: true,
        endDate: true,
        period: true,
        daysWorking: true,
        status: true,
        approvedAt: true,
        createdAt: true,
      },
    });

    if (!leave) {
      return NextResponse.json(
        { error: 'ไม่พบใบลาที่ต้องการตรวจสอบ' },
        { status: 404 }
      );
    }

    // Return public-safe data only
    const leaveTypeName =
      leave.type === 'other' && leave.customTypeName
        ? 'อื่นๆ'
        : LEAVE_TYPE_NAMES[leave.type] || leave.type;

    const periodText =
      leave.period === 'morning'
        ? ' (ครึ่งเช้า)'
        : leave.period === 'afternoon'
        ? ' (ครึ่งบ่าย)'
        : '';

    return NextResponse.json({
      leaveNo: leave.leaveNo,
      teacher: {
        name: `${leave.teacher.title}${leave.teacher.firstName} ${leave.teacher.lastName}`,
        code: leave.teacher.teacherCode,
      },
      type: leaveTypeName,
      dateRange: `${formatThaiDate(leave.startDate)} ถึง ${formatThaiDate(leave.endDate)}${periodText}`,
      daysWorking: leave.daysWorking,
      status: STATUS_NAMES[leave.status] || leave.status,
      submittedAt: formatThaiDate(leave.createdAt),
      approvedAt: leave.approvedAt ? formatThaiDate(leave.approvedAt) : null,
    });
  } catch (error) {
    console.error('Failed to fetch leave verification:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
