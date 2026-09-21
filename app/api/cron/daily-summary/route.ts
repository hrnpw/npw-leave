import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram/notify';
import { format, addDays } from 'date-fns';
import { th } from 'date-fns/locale';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = addDays(today, 1);
    const dayAfterTomorrow = addDays(today, 2);

    // Check if today is a holiday
    const todayHoliday = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (todayHoliday) {
      const message = `🏫 <b>สรุปประจำวัน</b>\n\n` +
        `วันที่: ${formatThaiDate(today)}\n\n` +
        `วันนี้เป็นวันหยุด (${todayHoliday.name})\nไม่มีการปฏิบัติงาน`;

      await sendTelegramMessage(message);
      return NextResponse.json({ success: true, type: 'holiday' });
    }

    // Get total active teachers
    const totalTeachers = await prisma.teacher.count({
      where: { isActive: true },
    });

    // Get leaves today
    const leavesToday = await prisma.leave.findMany({
      where: {
        status: 'approved',
        startDate: { lte: dayAfterTomorrow },
        endDate: { gte: today },
      },
      include: {
        teacher: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            teacherCode: true,
          },
        },
        leaveDays: {
          where: {
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
        },
      },
    });

    const activeLeavesToday = leavesToday.filter(
      (leave) => leave.leaveDays.length > 0
    );

    // Get leaves tomorrow
    const leavesTomorrow = await prisma.leave.count({
      where: {
        status: 'approved',
        startDate: { lte: dayAfterTomorrow },
        endDate: { gte: tomorrow },
      },
    });

    // Get pending count
    const pendingCount = await prisma.leave.count({
      where: { status: 'pending' },
    });

    // Get unprinted count
    const unprintedCount = await prisma.leave.count({
      where: {
        status: 'approved',
        printedAt: null,
      },
    });

    const typeMap: Record<string, string> = {
      sick: 'ป่วย',
      personal: 'กิจ',
      maternity: 'คลอด',
      religious: 'ศาสนา',
      other: 'อื่นๆ',
    };

    let message = `📊 <b>สรุปประจำวัน</b>\n\n`;
    message += `วันที่: ${formatThaiDate(today)}\n\n`;

    if (activeLeavesToday.length === 0) {
      message += `✅ <b>วันนี้ไม่มีครูลา</b>\n`;
      message += `มาปฏิบัติงานครบ ${totalTeachers} คน\n\n`;
    } else {
      const attending = totalTeachers - activeLeavesToday.length;
      message += `👥 มาปฏิบัติงาน: <b>${attending}</b> คน\n`;
      message += `🏖 ลาวันนี้: <b>${activeLeavesToday.length}</b> คน\n\n`;

      message += `<b>รายชื่อครูที่ลาวันนี้:</b>\n`;
      activeLeavesToday.slice(0, 15).forEach((leave, idx) => {
        const periodLabel =
          leave.leaveDays[0]?.halfDayPeriod === 'morning'
            ? ' (ครึ่งเช้า)'
            : leave.leaveDays[0]?.halfDayPeriod === 'afternoon'
            ? ' (ครึ่งบ่าย)'
            : '';

        message += `${idx + 1}. ${leave.teacher.title}${leave.teacher.firstName} ${leave.teacher.lastName} - ${typeMap[leave.type] || leave.customTypeName}${periodLabel}\n`;
      });

      if (activeLeavesToday.length > 15) {
        message += `...และอีก ${activeLeavesToday.length - 15} คน\n`;
      }
      message += `\n`;
    }

    message += `📅 ลาพรุ่งนี้: ${leavesTomorrow} คน\n`;
    message += `⏳ รออนุมัติ: ${pendingCount} ใบ\n`;

    if (unprintedCount > 0) {
      message += `🖨 รอพิมพ์: ${unprintedCount} ใบ\n`;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    await sendTelegramMessage(message, [
      {
        text: '📊 ไปที่ Dashboard',
        url: `${baseUrl}/hr/dashboard`,
      },
    ]);

    return NextResponse.json({
      success: true,
      type: 'daily_summary',
      stats: {
        totalTeachers,
        leavesToday: activeLeavesToday.length,
        leavesTomorrow,
        pendingCount,
        unprintedCount,
      },
    });
  } catch (error) {
    console.error('Cron daily summary failed:', error);
    return NextResponse.json(
      { error: 'Failed to send daily summary' },
      { status: 500 }
    );
  }
}

function formatThaiDate(date: Date): string {
  return format(date, 'EEEE d MMMM yyyy', { locale: th }).replace(
    /\d{4}/,
    (year) => String(parseInt(year) + 543)
  );
}
