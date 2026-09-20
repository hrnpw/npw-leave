import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { DEFAULT_BACKDATE_LIMIT_DAYS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    const backdateLimitDays = settings?.backdateLimitDays || DEFAULT_BACKDATE_LIMIT_DAYS;
    const systemStartDate = settings?.systemStartDate || new Date('2026-09-07');

    const now = new Date();
    const earliestDate = new Date(now);
    earliestDate.setDate(earliestDate.getDate() - backdateLimitDays);
    earliestDate.setHours(0, 0, 0, 0);

    // Use the later of the two
    const effectiveEarliestDate = earliestDate > systemStartDate ? earliestDate : systemStartDate;

    return NextResponse.json({
      backdateLimitDays,
      systemStartDate: systemStartDate.toISOString(),
      earliestDate: effectiveEarliestDate.toISOString(),
    });
  } catch (error) {
    console.error('Get backdate limit error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
