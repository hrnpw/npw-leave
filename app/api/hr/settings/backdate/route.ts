import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.settings.findFirst({
      select: {
        backdateLimitDays: true,
        hrBackdateLimitDays: true,
        systemStartDate: true,
      },
    });

    if (!settings) {
      // Return defaults if no settings exist
      return NextResponse.json({
        backdateLimitDays: 14,
        hrBackdateLimitDays: 30,
        systemStartDate: new Date('2026-09-07').toISOString(),
      });
    }

    return NextResponse.json({
      backdateLimitDays: settings.backdateLimitDays,
      hrBackdateLimitDays: settings.hrBackdateLimitDays,
      systemStartDate: settings.systemStartDate.toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
