import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/public/heatmap?year=2026&month=9
// Returns: { 'YYYY-MM-DD': count }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

    // Validate
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid year or month' },
        { status: 400 }
      );
    }

    // Create UTC dates for the first and last day of the month
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Last day of month

    // Get all approved leaves that overlap with this month
    const leaves = await prisma.leave.findMany({
      where: {
        status: 'approved',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart }
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        isHalfDay: true
      }
    });

    // Count leaves per day
    const heatmapData: Record<string, number> = {};

    for (const leave of leaves) {
      const leaveStart = leave.startDate > monthStart ? leave.startDate : monthStart;
      const leaveEnd = leave.endDate < monthEnd ? leave.endDate : monthEnd;

      // Generate all dates in the leave range
      const currentDate = new Date(leaveStart);
      while (currentDate <= leaveEnd) {
        const dateKey = currentDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'
        heatmapData[dateKey] = (heatmapData[dateKey] || 0) + (leave.isHalfDay ? 0.5 : 1);

        // Move to next day
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }

    // Round half-day counts
    Object.keys(heatmapData).forEach(key => {
      heatmapData[key] = Math.ceil(heatmapData[key]);
    });

    return NextResponse.json(heatmapData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error('Heatmap API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
