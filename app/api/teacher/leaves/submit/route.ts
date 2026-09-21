import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { calculateLeaveDays } from '@/lib/leaveCalculator';
import { getFiscalYear, getLeavePeriod } from '@/lib/fiscalYear';
import { DEFAULT_BACKDATE_LIMIT_DAYS } from '@/lib/constants';
import { parseISODateSafe } from '@/lib/dateUtils';
import { formatDateForAPI } from '@/lib/dateFormat';
import type { LeaveType, HalfDayPeriod } from '@/types/leave';
import { uploadToR2 } from '@/lib/r2/upload';

interface SubmitLeaveRequest {
  type: LeaveType;
  customTypeName?: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: HalfDayPeriod;
  reason: string;
  contactAddress: string;
  contactPhone: string;
  teacherSignature: boolean;
  signatureDataUrl?: string; // Base64 PNG data URL
}

export async function POST(request: NextRequest) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SubmitLeaveRequest = await request.json();

    // Validate required fields
    if (!body.type || !body.startDate || !body.endDate || !body.reason || !body.contactAddress || !body.contactPhone) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    // Validate contact phone
    if (body.contactPhone.trim().length < 9) {
      return NextResponse.json({ error: 'เบอร์โทรศัพท์ต้องมีอย่างน้อย 9 หลัก' }, { status: 400 });
    }

    // Validate custom type name for 'other'
    if (body.type === 'other' && !body.customTypeName?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุประเภทการลา' }, { status: 400 });
    }

    // Validate reason length
    if (body.reason.trim().length < 10) {
      return NextResponse.json({ error: 'เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร' }, { status: 400 });
    }

    // Validate half-day
    if (body.isHalfDay && !body.halfDayPeriod) {
      return NextResponse.json({ error: 'กรุณาเลือกช่วงเวลาครึ่งวัน' }, { status: 400 });
    }

    // Get settings first to check signature requirement
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    // Validate teacher signature if required
    if (settings?.requireTeacherSignature && !body.signatureDataUrl) {
      return NextResponse.json({ error: 'กรุณาลงลายเซ็นก่อนยื่นใบลา' }, { status: 400 });
    }

    // Parse dates for validation and calculation
    const startDate = parseISODateSafe(body.startDate);
    const endDate = parseISODateSafe(body.endDate);

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
    }

    // Keep original strings for database storage to prevent timezone shift
    const startDateStr = body.startDate;
    const endDateStr = body.endDate;

    const now = new Date();

    const backdateLimit = settings?.backdateLimitDays || DEFAULT_BACKDATE_LIMIT_DAYS;
    const systemStartDate = settings?.systemStartDate || new Date('2026-09-07');

    // Check backdate limit
    const earliestAllowed = new Date(now);
    earliestAllowed.setDate(earliestAllowed.getDate() - backdateLimit);
    earliestAllowed.setHours(0, 0, 0, 0);

    if (startDate < earliestAllowed) {
      return NextResponse.json(
        { error: `ไม่สามารถยื่นย้อนหลังเกิน ${backdateLimit} วัน` },
        { status: 400 }
      );
    }

    if (startDate < systemStartDate) {
      return NextResponse.json(
        { error: 'ไม่สามารถยื่นก่อนวันที่ระบบเริ่มใช้งาน' },
        { status: 400 }
      );
    }

    // Check date range
    if (endDate < startDate) {
      return NextResponse.json({ error: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น' }, { status: 400 });
    }

    // Check half-day only for single day
    const isSingleDay = startDate.getTime() === endDate.getTime();
    if (body.isHalfDay && !isSingleDay) {
      return NextResponse.json({ error: 'ครึ่งวันใช้ได้เฉพาะลาวันเดียวเท่านั้น' }, { status: 400 });
    }

    // Check max duration (120 days)
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1;
    if (durationDays > 120) {
      return NextResponse.json({ error: 'ช่วงลาต่อเนื่องสูงสุด 120 วัน' }, { status: 400 });
    }

    // Check max future date (90 days ahead)
    const maxFutureDays = 90;
    const maxFutureDate = new Date(now);
    maxFutureDate.setDate(maxFutureDate.getDate() + maxFutureDays);

    if (startDate > maxFutureDate) {
      return NextResponse.json(
        { error: `ไม่สามารถยื่นใบลาล่วงหน้าเกิน ${maxFutureDays} วัน` },
        { status: 400 }
      );
    }

    // Check overlapping leaves
    // Use UTC dates to prevent timezone shift issues
    const startDateUTC = new Date(startDateStr + 'T00:00:00.000Z');
    const endDateUTC = new Date(endDateStr + 'T00:00:00.000Z');

    console.log('[OVERLAP CHECK] New leave:', { startDateStr, endDateStr, startDateUTC, endDateUTC, teacherId: session.id });

    const overlappingLeaves = await prisma.leave.findMany({
      where: {
        teacherId: session.id,
        status: { in: ['pending', 'approved'] },
        OR: [
          // Case 1: Existing leave starts within new range
          {
            startDate: {
              gte: startDateUTC,
              lte: endDateUTC,
            },
          },
          // Case 2: Existing leave ends within new range
          {
            endDate: {
              gte: startDateUTC,
              lte: endDateUTC,
            },
          },
          // Case 3: Existing leave completely contains new range
          {
            AND: [
              { startDate: { lte: startDateUTC } },
              { endDate: { gte: endDateUTC } },
            ],
          },
        ],
      },
    });

    if (overlappingLeaves.length > 0) {
      console.log('[OVERLAP FOUND]', overlappingLeaves.map(l => ({
        leaveNo: l.leaveNo,
        startDate: l.startDate,
        endDate: l.endDate,
        startDateType: typeof l.startDate,
        endDateType: typeof l.endDate,
      })));
    }

    // Check for overlapping leaves
    if (overlappingLeaves.length > 0) {
      if (isSingleDay && body.isHalfDay) {
        // For half-day requests, check if there's a conflict on the exact same date
        const sameDateConflict = overlappingLeaves.find(l => {
          const existingStart = new Date(l.startDate).setHours(0, 0, 0, 0);
          const existingEnd = new Date(l.endDate).setHours(0, 0, 0, 0);
          const newDate = startDateUTC.getTime();

          // Check if new date falls within existing leave range
          if (newDate < existingStart || newDate > existingEnd) {
            return false;
          }

          // If on same date, check if same period
          if (newDate === existingStart && newDate === existingEnd) {
            // Both on same single day - conflict only if full day or same period
            return !l.isHalfDay || l.halfDayPeriod === body.halfDayPeriod;
          }

          // New date falls within multi-day leave range
          return true;
        });

        if (sameDateConflict) {
          return NextResponse.json(
            { error: 'มีใบลาที่ทับซ้อนกับช่วงเวลานี้แล้ว', overlappingLeaves },
            { status: 409 }
          );
        }
        // Allow: different half-day periods on same day
      } else {
        return NextResponse.json(
          { error: 'มีใบลาที่ทับซ้อนกับช่วงเวลานี้แล้ว', overlappingLeaves },
          { status: 409 }
        );
      }
    }

    // Get holidays
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const holidayDates = holidays.map(h => h.date);

    // Calculate leave days
    const calculation = calculateLeaveDays(
      startDate,
      endDate,
      holidayDates,
      body.isHalfDay,
      body.halfDayPeriod
    );

    // Generate leave number based on leave start date (not submission date)
    const { fiscalYear, round } = {
      fiscalYear: getFiscalYear(startDate),
      round: getLeavePeriod(startDate)
    };

    // Upload signature to Vercel Blob if provided (before transaction)
    let teacherSignatureUrl: string | null = null;
    if (body.signatureDataUrl) {
      try {
        // Extract base64 data from data URL
        const base64Data = body.signatureDataUrl.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid signature data URL format');
        }

        // Convert base64 to Buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Create blob filename with timestamp
        const timestamp = Date.now();
        const filename = `signatures/${timestamp}-teacher-${session.id}.png`;

        // Upload to Cloudflare R2 (S3-compatible)
        const signatureUrl = await uploadToR2(filename, buffer, 'image/png');
        teacherSignatureUrl = signatureUrl;
        console.log('[SIGNATURE] Uploaded successfully:', teacherSignatureUrl);
      } catch (uploadError) {
        console.error('[SIGNATURE] Upload failed:', uploadError);
        // Continue without signature - don't block leave submission (T24)
        // Return warning to user
        return NextResponse.json(
          {
            error: 'ไม่สามารถอัปโหลดลายเซ็นได้ กรุณาลองใหม่อีกครั้ง',
            details: uploadError instanceof Error ? uploadError.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }

    // Use transaction to ensure unique leave number
    const leave = await prisma.$transaction(async (tx) => {
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
          data: {
            fiscalYear,
            round,
            lastNumber: 1,
          },
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

      // Create leave - use original date strings to prevent timezone shift
      const newLeave = await tx.leave.create({
        data: {
          leaveNo,
          fiscalYear,
          round,
          runningNo: newNumber,
          teacherId: session.id!,
          type: body.type,
          customTypeName: body.type === 'other' ? body.customTypeName?.trim() : null,
          startDate: new Date(startDateStr + 'T00:00:00.000Z'),
          endDate: new Date(endDateStr + 'T00:00:00.000Z'),
          isHalfDay: body.isHalfDay,
          halfDayPeriod: body.isHalfDay ? body.halfDayPeriod : null,
          reason: body.reason.trim(),
          contactAddress: body.contactAddress.trim(),
          contactPhone: body.contactPhone.trim(),
          teacherSignatureUrl: teacherSignatureUrl,
          daysWorking: calculation.daysWorking,
          daysCalendar: calculation.daysCalendar,
          submittedByType: 'teacher',
          status: 'pending',
        },
        include: {
          teacher: {
            select: {
              teacherCode: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Create leave days breakdown - convert dates to UTC to prevent timezone shift
      await tx.leaveDay.createMany({
        data: calculation.leaveDays.map(day => {
          const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
          return {
            leaveId: newLeave.id,
            date: new Date(dateStr + 'T00:00:00.000Z'),
            isWorkingDay: day.isWorkingDay,
            isHalfDay: day.isHalfDay,
            halfDayPeriod: day.halfDayPeriod || null,
          };
        }),
      });

      return newLeave;
    });

    console.log('[DEBUG] After transaction, leave.id:', leave.id);
    console.log('[DEBUG] TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
    console.log('[DEBUG] TELEGRAM_CHAT_ID exists:', !!process.env.TELEGRAM_CHAT_ID);

    // Send Telegram notification (await to ensure it completes)
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      console.log('[DEBUG] Entering Telegram notification block');
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        console.log('[DEBUG] Calling Telegram notify API:', `${baseUrl}/api/telegram/notify`);

        const response = await fetch(`${baseUrl}/api/telegram/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leaveId: leave.id, type: 'new_leave' }),
        });

        console.log('[DEBUG] Telegram response status:', response.status);

        if (!response.ok) {
          const error = await response.json();
          console.error('Telegram notification failed:', error);
        } else {
          console.log('Telegram notification sent successfully');
        }
      } catch (err) {
        console.error('Failed to trigger Telegram notification:', err);
        // Notification failure doesn't affect leave creation
      }
    } else {
      console.log('[DEBUG] Skipping Telegram - env vars not set');
    }

    // Clear localStorage draft
    // (handled by client)

    return NextResponse.json({
      success: true,
      leaveNo: leave.leaveNo,
      leave: {
        id: leave.id,
        leaveNo: leave.leaveNo,
        type: leave.type,
        customTypeName: leave.customTypeName,
        startDate: formatDateForAPI(leave.startDate),
        endDate: formatDateForAPI(leave.endDate),
        daysWorking: leave.daysWorking,
        daysCalendar: leave.daysCalendar,
        status: leave.status,
      },
    });
  } catch (error) {
    console.error('Submit leave error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการยื่นใบลา กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
