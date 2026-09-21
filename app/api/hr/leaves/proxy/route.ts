import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { calculateLeaveDays } from '@/lib/leaveCalculator';
import { isWeekend, parseISODateSafe } from '@/lib/dateUtils';
import { getCurrentFiscalYearAndRound } from '@/lib/fiscalYear';
import type { LeaveType, HalfDayPeriod } from '@/types/leave';

export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      teacherId,
      type,
      customTypeName,
      startDate: startDateStr,
      endDate: endDateStr,
      isHalfDay,
      halfDayPeriod,
      reason,
      contactAddress,
      contactPhone,
      proxyReason,
      proxyNote,
      attachments = [],
    } = body;

    // Validation
    if (!teacherId || !type || !startDateStr || !endDateStr || !reason || !contactAddress || !contactPhone || !proxyReason) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    if (reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร' },
        { status: 400 }
      );
    }

    if (contactPhone.trim().length < 9) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ต้องมีอย่างน้อย 9 หลัก' },
        { status: 400 }
      );
    }

    const startDate = parseISODateSafe(startDateStr);
    const endDate = parseISODateSafe(endDateStr);

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
    }

    // Check teacher exists and is active
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, isActive: true },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลครู' },
        { status: 404 }
      );
    }

    if (!teacher.isActive) {
      return NextResponse.json(
        { error: 'ครูท่านนี้ถูกปิดใช้งานแล้ว ไม่สามารถยื่นใบลาได้' },
        { status: 400 }
      );
    }

    // Get settings for backdate limit
    const settings = await prisma.settings.findFirst();
    const hrBackdateLimit = settings?.hrBackdateLimitDays || 30;
    const systemStartDate = settings?.systemStartDate || new Date('2026-09-07');

    // Check backdate limit for HR
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earliestAllowed = new Date(today);
    earliestAllowed.setDate(earliestAllowed.getDate() - hrBackdateLimit);

    const effectiveEarliest =
      earliestAllowed > systemStartDate ? earliestAllowed : systemStartDate;

    if (startDate < effectiveEarliest) {
      return NextResponse.json(
        {
          error: `ไม่สามารถยื่นย้อนหลังเกิน ${hrBackdateLimit} วัน หรือก่อนวันที่เริ่มใช้งานระบบ`,
        },
        { status: 400 }
      );
    }

    // Check date range
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 120) {
      return NextResponse.json(
        { error: 'ไม่สามารถลาเกิน 120 วัน' },
        { status: 400 }
      );
    }

    // Check max future date (90 days ahead)
    const maxFutureDays = 90;
    const now = new Date();
    const maxFutureDate = new Date(now);
    maxFutureDate.setDate(maxFutureDate.getDate() + maxFutureDays);

    if (startDate > maxFutureDate) {
      return NextResponse.json(
        { error: `ไม่สามารถยื่นใบลาล่วงหน้าเกิน ${maxFutureDays} วัน` },
        { status: 400 }
      );
    }

    // Check half-day logic
    if (isHalfDay && diffDays > 1) {
      return NextResponse.json(
        { error: 'ครึ่งวันใช้ได้เฉพาะลาวันเดียวเท่านั้น' },
        { status: 400 }
      );
    }

    // Check overlap
    // Two date ranges overlap if: (start1 <= end2) AND (end1 >= start2)
    const overlapping = await prisma.leave.findFirst({
      where: {
        teacherId,
        status: { in: ['pending', 'approved'] },
        AND: [
          { startDate: { lte: new Date(endDateStr + 'T00:00:00.000Z') } },   // existing start <= new end
          { endDate: { gte: new Date(startDateStr + 'T00:00:00.000Z') } },   // existing end >= new start
        ],
      },
      select: {
        id: true,
        leaveNo: true,
        startDate: true,
        endDate: true,
        isHalfDay: true,
        halfDayPeriod: true,
      },
    });

    if (overlapping) {
      // Check same-day half-day exception
      const isSameDay =
        overlapping.startDate.toDateString() === startDate.toDateString() &&
        overlapping.endDate.toDateString() === endDate.toDateString();

      if (
        isSameDay &&
        overlapping.isHalfDay &&
        isHalfDay &&
        overlapping.halfDayPeriod !== halfDayPeriod
      ) {
        // Allow: different half-day periods on same day
      } else {
        return NextResponse.json(
          {
            error: `ช่วงวันลาทับซ้อนกับใบลา ${overlapping.leaveNo}`,
            overlappingLeave: {
              leaveNo: overlapping.leaveNo,
              startDate: overlapping.startDate.toISOString(),
              endDate: overlapping.endDate.toISOString(),
            },
          },
          { status: 400 }
        );
      }
    }

    // Calculate days - fetch holidays first
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { date: true },
    });

    const { daysWorking, daysCalendar, leaveDays } = calculateLeaveDays(
      startDate,
      endDate,
      holidays.map(h => h.date),
      isHalfDay,
      halfDayPeriod as 'morning' | 'afternoon' | undefined
    );

    // Generate leave number with transaction
    const leave = await prisma.$transaction(async (tx) => {
      const { fiscalYear, round } = getCurrentFiscalYearAndRound();

      // Use SELECT FOR UPDATE to prevent race condition
      const counterRows = await tx.$queryRaw<Array<{ last_number: number }>>`
        SELECT "last_number"
        FROM "fiscal_counter"
        WHERE "fiscal_year" = ${fiscalYear} AND "round" = ${round}
        FOR UPDATE
      `;

      let newNumber: number;

      if (counterRows.length === 0) {
        // Create new counter starting at 1
        await tx.fiscalCounter.create({
          data: { fiscalYear, round, lastNumber: 1 },
        });
        newNumber = 1;
      } else {
        // Increment existing counter
        newNumber = counterRows[0].last_number + 1;
        await tx.fiscalCounter.update({
          where: {
            fiscalYear_round: {
              fiscalYear,
              round,
            },
          },
          data: { lastNumber: newNumber },
        });
      }

      const leaveNo = `LEAVE-${fiscalYear % 100}/${round}-${String(newNumber).padStart(4, '0')}`;

      // Create leave - use original date strings with UTC to prevent timezone shift
      const newLeave = await tx.leave.create({
        data: {
          leaveNo,
          fiscalYear,
          round,
          runningNo: newNumber,
          teacherId,
          type: type as LeaveType,
          customTypeName: type === 'other' ? customTypeName : null,
          startDate: new Date(startDateStr + 'T00:00:00.000Z'),
          endDate: new Date(endDateStr + 'T00:00:00.000Z'),
          isHalfDay,
          halfDayPeriod: isHalfDay ? (halfDayPeriod as HalfDayPeriod) : null,
          daysWorking,
          daysCalendar,
          reason: reason.trim(),
          contactAddress: contactAddress.trim(),
          contactPhone: contactPhone.trim(),
          status: 'pending',
          submittedByType: 'hr',
          submittedByHrId: session.id!,
          proxyReason: proxyReason.trim(),
          proxyNote: proxyNote?.trim() || null,
        },
      });

      // Create leave days - convert dates to UTC to prevent timezone shift
      if (leaveDays.length > 0) {
        await tx.leaveDay.createMany({
          data: leaveDays.map((day) => {
            const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
            return {
              leaveId: newLeave.id,
              date: new Date(dateStr + 'T00:00:00.000Z'),
              isWorkingDay: day.isWorkingDay,
              isHalfDay: !!day.halfDayPeriod,
              halfDayPeriod: day.halfDayPeriod || null,
            };
          }),
        });
      }

      // TODO: Handle attachments (Phase 5 - Vercel Blob)
      // TODO: Audit log (will implement in Phase 6)

      return newLeave;
    });

    // Send Telegram notification (await to ensure it completes)
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        const response = await fetch(`${baseUrl}/api/telegram/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leaveId: leave.id, type: 'new_leave' }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Telegram notification failed:', error);
        }
      } catch (err) {
        console.error('Failed to trigger Telegram notification:', err);
        // Notification failure doesn't affect leave creation
      }
    }

    return NextResponse.json({
      success: true,
      leaveNo: leave.leaveNo,
      leave: {
        id: leave.id,
        leaveNo: leave.leaveNo,
      },
    });
  } catch (error) {
    console.error('Failed to submit proxy leave:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการยื่นใบลา' },
      { status: 500 }
    );
  }
}
