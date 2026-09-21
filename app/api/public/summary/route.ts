import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cache for 60 seconds
export const revalidate = 60;

interface LeaveTypeCount {
  type: string;
  customTypeName?: string;
  count: number;
  teachers: {
    id: string;
    firstName: string;
    lastName: string;
    teacherCode: string;
    department: string | null;
    isHalfDay: boolean;
    halfDayPeriod?: 'morning' | 'afternoon';
  }[];
}

export async function GET() {
  try {
    // Get current date in Thailand timezone (UTC+7)
    const nowUTC = new Date();
    const nowThailand = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

    // Create UTC dates for today and tomorrow (midnight UTC, representing the calendar day)
    const todayYear = nowThailand.getFullYear();
    const todayMonth = nowThailand.getMonth();
    const todayDate = nowThailand.getDate();

    const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
    const tomorrowStart = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1, 0, 0, 0, 0));
    const tomorrowEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1, 23, 59, 59, 999));

    // Get total active teachers
    const totalTeachers = await prisma.teacher.count({
      where: { isActive: true },
    });

    // Check if today is a holiday
    const todayHoliday = await prisma.holiday.findUnique({
      where: { date: todayStart },
      select: { name: true },
    });

    // Check if tomorrow is a holiday
    const tomorrowHoliday = await prisma.holiday.findUnique({
      where: { date: tomorrowStart },
      select: { name: true },
    });

    // Get leaves for today (approved only, full day or any half day)
    const leavesToday = await prisma.leave.findMany({
      where: {
        status: 'approved',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      select: {
        id: true,
        type: true,
        customTypeName: true,
        isHalfDay: true,
        halfDayPeriod: true,
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            teacherCode: true,
            department: true,
          },
        },
      },
    });

    // Get leaves for tomorrow (approved only)
    const leavesTomorrow = await prisma.leave.findMany({
      where: {
        status: 'approved',
        startDate: { lte: tomorrowEnd },
        endDate: { gte: tomorrowStart },
      },
      select: {
        id: true,
        teacher: {
          select: {
            id: true,
          },
        },
      },
    });

    // Count full-day leaves for today (to calculate attendance)
    const fullDayLeavesToday = leavesToday.filter(leave => !leave.isHalfDay);
    const attendingToday = totalTeachers - fullDayLeavesToday.length;

    // Group leaves by type for today
    const leavesByType: Record<string, LeaveTypeCount> = {};

    leavesToday.forEach(leave => {
      const key = leave.type === 'other' && leave.customTypeName
        ? `other_${leave.customTypeName}`
        : leave.type;

      if (!leavesByType[key]) {
        leavesByType[key] = {
          type: leave.type,
          customTypeName: leave.customTypeName || undefined,
          count: 0,
          teachers: [],
        };
      }

      leavesByType[key].count++;
      leavesByType[key].teachers.push({
        id: leave.teacher.id,
        firstName: leave.teacher.firstName,
        lastName: leave.teacher.lastName,
        teacherCode: leave.teacher.teacherCode,
        department: leave.teacher.department,
        isHalfDay: leave.isHalfDay,
        halfDayPeriod: leave.halfDayPeriod || undefined,
      });
    });

    // Convert to array and sort by count (descending)
    const leavesGrouped = Object.values(leavesByType).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      date: nowUTC.toISOString(),
      totalTeachers,
      attendingToday,
      leavesToday: leavesToday.length,
      leavesTomorrow: leavesTomorrow.length,
      todayHoliday: todayHoliday?.name || null,
      tomorrowHoliday: tomorrowHoliday?.name || null,
      leavesByType: leavesGrouped,
    });
  } catch (error) {
    console.error('Public summary error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
