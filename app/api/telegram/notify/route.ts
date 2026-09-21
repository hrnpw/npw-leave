import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage, retryWithBackoff } from '@/lib/telegram/notify';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export async function POST(request: NextRequest) {
  console.log('[TELEGRAM NOTIFY] === POST handler started ===');
  try {
    const body = await request.json();
    console.log('[TELEGRAM NOTIFY] Request body:', body);
    const { leaveId, type = 'new_leave' } = body;

    if (!leaveId) {
      console.log('[TELEGRAM NOTIFY] ERROR: leaveId missing');
      return NextResponse.json(
        { error: 'leaveId is required' },
        { status: 400 }
      );
    }

    console.log('[TELEGRAM NOTIFY] Processing leaveId:', leaveId);

    console.log('[TELEGRAM NOTIFY] Fetching leave from database...');
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        teacher: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
          },
        },
        submittedByHr: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        attachments: true,
      },
    });

    console.log('[TELEGRAM NOTIFY] Leave found:', !!leave);
    if (!leave) {
      console.log('[TELEGRAM NOTIFY] ERROR: Leave not found');
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    const typeMap: Record<string, string> = {
      sick: 'ลาป่วย',
      personal: 'ลากิจส่วนตัว',
      maternity: 'ลาคลอดบุตร',
      religious: 'ลาทางศาสนา',
      other: leave.customTypeName || 'อื่นๆ',
    };

    const formatThaiDate = (date: Date) => {
      return format(date, 'd MMM yyyy', { locale: th }).replace(
        /\d{4}/,
        (year) => String(parseInt(year) + 543)
      );
    };

    // Build message
    let message = `<b>📋 ใบลาใหม่</b>\n\n`;
    message += `เลขที่: <b>${leave.leaveNo}</b>\n`;
    message += `ครู: ${leave.teacher.title}${leave.teacher.firstName} ${leave.teacher.lastName}\n`;
    message += `ประเภท: ${typeMap[leave.type]}\n`;
    message += `จำนวน: ${leave.daysWorking} วันทำการ\n`;
    message += `ช่วงเวลา: ${formatThaiDate(leave.startDate)} - ${formatThaiDate(leave.endDate)}\n`;

    if (leave.attachments.length > 0) {
      message += `ไฟล์แนบ: ${leave.attachments.length} ไฟล์\n`;
    }

    // Check exceeding quota
    const { startDate: periodStart, endDate: periodEnd } = getPeriodDates(
      leave.startDate
    );
    const quotaCheck = await checkQuotaExceeding(
      leave.teacherId,
      leave.type,
      periodStart,
      periodEnd,
      leave.daysCalendar
    );

    if (quotaCheck.exceeding) {
      message += `\n⚠️ <b>รวมในรอบนี้ ${quotaCheck.total}/${quotaCheck.limit} วัน</b>`;
    }

    // Check backdate
    const daysDiff = Math.floor(
      (new Date().getTime() - leave.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 3) {
      message += `\n🕐 ย้อนหลัง ${daysDiff} วัน`;
    }

    // Check HR proxy
    if (leave.submittedByType === 'hr' && leave.submittedByHr) {
      message += `\n🖊️ <b>ยื่นแทนโดย:</b> ${leave.submittedByHr.firstName} ${leave.submittedByHr.lastName}`;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.startsWith('http://');

    console.log('[TELEGRAM NOTIFY] Sending message with retry...');
    console.log('[TELEGRAM NOTIFY] Message preview:', message.substring(0, 100));
    console.log('[TELEGRAM NOTIFY] BaseURL:', baseUrl, '| isLocalhost:', isLocalhost);

    // Send with retry - skip inline button if localhost (Telegram doesn't allow http URLs)
    const inlineButtons = isLocalhost
      ? undefined
      : [
          {
            text: '🔍 ดูรายละเอียด',
            url: `${baseUrl}/hr/leaves/${leave.id}`,
          },
        ];

    const result = await retryWithBackoff(
      () => sendTelegramMessage(message, inlineButtons),
      3,
      [1000, 3000, 5000]
    );

    console.log('[TELEGRAM NOTIFY] Send result:', result);

    if (!result.success) {
      console.log('[TELEGRAM NOTIFY] Failed after retries, queuing...');
      // Save to notification queue
      await prisma.notificationQueue.create({
        data: {
          type: 'telegram',
          status: 'failed',
          payload: {
            leaveId,
            message,
            type,
          },
          lastError: result.error,
          idempotencyKey: `${type}-${leaveId}`,
        },
      });

      return NextResponse.json(
        { success: false, queued: true, error: result.error },
        { status: 200 }
      );
    }

    console.log('[TELEGRAM NOTIFY] === Message sent successfully ===');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TELEGRAM NOTIFY] ERROR in catch block:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

function getPeriodDates(date: Date): { startDate: Date; endDate: Date } {
  const month = date.getMonth();
  const year = date.getFullYear();

  if (month >= 3 && month <= 8) {
    return {
      startDate: new Date(year, 3, 1),
      endDate: new Date(year, 8, 30),
    };
  } else {
    const startYear = month >= 9 ? year : year - 1;
    return {
      startDate: new Date(startYear, 9, 1),
      endDate: new Date(startYear + 1, 2, 31),
    };
  }
}

async function checkQuotaExceeding(
  teacherId: string,
  type: string,
  periodStart: Date,
  periodEnd: Date,
  currentDays: number
): Promise<{ exceeding: boolean; total: number; limit: number }> {
  const limits: Record<string, number> = {
    sick: 23,
    personal: 23,
    maternity: 90,
    religious: 120,
  };

  const limit = limits[type];
  if (!limit) {
    return { exceeding: false, total: 0, limit: 0 };
  }

  const approvedLeaves = await prisma.leave.findMany({
    where: {
      teacherId,
      type:
        type === 'sick' || type === 'personal'
          ? { in: ['sick', 'personal'] as const }
          : (type as any),
      status: 'approved',
      startDate: { gte: periodStart, lte: periodEnd },
    },
  });

  const previousDays = approvedLeaves.reduce(
    (sum, l) => sum + l.daysCalendar,
    0
  );
  const total = previousDays + currentDays;

  return {
    exceeding: total > limit,
    total,
    limit,
  };
}
