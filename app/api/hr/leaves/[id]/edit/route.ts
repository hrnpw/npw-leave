import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { calculateLeaveDays } from '@/lib/leaveCalculator';
import { parseISODateSafe } from '@/lib/dateUtils';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { type, customTypeName, startDate, endDate, isHalfDay, halfDayPeriod, reason, contactAddress, contactPhone } = body;

    // Fetch existing leave
    const existingLeave = await prisma.leave.findUnique({
      where: { id },
      include: { teacher: true },
    });

    if (!existingLeave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    // Only allow editing approved leaves
    if (existingLeave.status !== 'approved') {
      return NextResponse.json(
        { error: 'แก้ไขได้เฉพาะใบลาที่อนุมัติแล้วเท่านั้น' },
        { status: 400 }
      );
    }

    // Validate fields
    if (!type || !startDate || !endDate || !reason || !contactAddress) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'เหตุผลต้องมีความยาวอย่างน้อย 10 ตัวอักษร' },
        { status: 400 }
      );
    }

    if (type === 'other' && (!customTypeName || customTypeName.trim().length === 0)) {
      return NextResponse.json(
        { error: 'กรุณาระบุชื่อประเภทการลา' },
        { status: 400 }
      );
    }

    // Half-day validation
    if (isHalfDay) {
      const start = parseISODateSafe(startDate);
      const end = parseISODateSafe(endDate);

      if (!start || !end) {
        return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
      }

      if (start.getTime() !== end.getTime()) {
        return NextResponse.json(
          { error: 'ครึ่งวันใช้ได้เฉพาะการลาวันเดียวเท่านั้น' },
          { status: 400 }
        );
      }
      if (!halfDayPeriod || !['morning', 'afternoon'].includes(halfDayPeriod)) {
        return NextResponse.json(
          { error: 'กรุณาระบุช่วงครึ่งวัน (เช้า/บ่าย)' },
          { status: 400 }
        );
      }
    }

    // Recalculate days
    const start = parseISODateSafe(startDate);
    const end = parseISODateSafe(endDate);

    if (!start || !end) {
      return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
    }

    if (start > end) {
      return NextResponse.json(
        { error: 'วันที่เริ่มต้องไม่มากกว่าวันที่สิ้นสุด' },
        { status: 400 }
      );
    }

    // Fetch holidays
    const minYear = start.getFullYear();
    const maxYear = end.getFullYear();
    const years = [];
    for (let y = minYear; y <= maxYear; y++) {
      years.push(y);
    }

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      select: { date: true },
    });

    const { daysWorking, daysCalendar, leaveDays } = calculateLeaveDays(
      start,
      end,
      holidays.map(h => h.date),
      isHalfDay || false,
      (halfDayPeriod as 'morning' | 'afternoon' | undefined) || undefined
    );

    // Build before/after for audit log
    const before = {
      type: existingLeave.type,
      customTypeName: existingLeave.customTypeName,
      startDate: existingLeave.startDate.toISOString(),
      endDate: existingLeave.endDate.toISOString(),
      isHalfDay: existingLeave.isHalfDay,
      halfDayPeriod: existingLeave.halfDayPeriod,
      reason: existingLeave.reason,
      contactAddress: existingLeave.contactAddress,
      contactPhone: existingLeave.contactPhone,
      daysWorking: existingLeave.daysWorking,
      daysCalendar: existingLeave.daysCalendar,
    };

    const after = {
      type,
      customTypeName: type === 'other' ? customTypeName : null,
      startDate,
      endDate,
      isHalfDay: isHalfDay || false,
      halfDayPeriod: isHalfDay ? halfDayPeriod : null,
      reason,
      contactAddress,
      contactPhone: contactPhone || null,
      daysWorking,
      daysCalendar,
    };

    // Update in transaction
    await prisma.$transaction(async (tx) => {
      // Delete old leave days
      await tx.leaveDay.deleteMany({
        where: { leaveId: id },
      });

      // Update leave
      await tx.leave.update({
        where: { id },
        data: {
          type,
          customTypeName: type === 'other' ? customTypeName : null,
          startDate: start,
          endDate: end,
          isHalfDay: isHalfDay || false,
          halfDayPeriod: isHalfDay ? halfDayPeriod : null,
          reason,
          contactAddress,
          contactPhone: contactPhone || null,
          daysWorking,
          daysCalendar,
        },
      });

      // Create new leave days
      await tx.leaveDay.createMany({
        data: leaveDays.map((ld) => ({
          leaveId: id,
          date: ld.date,
          isHalfDay: ld.isHalfDay,
          halfDayPeriod: ld.halfDayPeriod,
          isWorkingDay: ld.isWorkingDay,
        })),
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.id,
          userType: session.role === 'super_admin' ? 'super_admin' : 'hr',
          action: 'LEAVE_EDIT_APPROVED',
          resource: 'leave',
          resourceId: id,
          details: {
            before,
            after,
            leaveNo: existingLeave.leaveNo,
            teacherId: existingLeave.teacherId,
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Edit approved leave error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขใบลา' },
      { status: 500 }
    );
  }
}
