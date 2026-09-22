import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { longCacheHeaders } from '@/lib/cacheHeaders';

/**
 * GET /api/public/holidays
 * ดึงรายการวันหยุดราชการตามปีและเดือนที่ระบุ
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json(
        { error: 'Missing year or month parameter' },
        { status: 400 }
      );
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: 'Invalid year or month' },
        { status: 400 }
      );
    }

    // สร้างช่วงวันที่ของเดือนนั้น
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

    // ดึงวันหยุดในเดือนนั้น
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
      select: {
        id: true,
        name: true,
        date: true,
      },
    });

    return NextResponse.json({
      holidays: holidays.map(h => ({
        id: h.id,
        name: h.name,
        date: h.date.toISOString(),
      })),
    }, {
      headers: longCacheHeaders,
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
