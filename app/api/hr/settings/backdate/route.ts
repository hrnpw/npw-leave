import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Uses cookies for auth

// Simple in-memory cache
let settingsCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes (settings rarely change)

export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try cache first
    if (settingsCache && Date.now() - settingsCache.timestamp < CACHE_TTL) {
      return NextResponse.json(settingsCache.data, {
        headers: {
          'Cache-Control': 'private, max-age=600', // Client cache 10 minutes
        },
      });
    }

    const settings = await prisma.settings.findFirst({
      select: {
        backdateLimitDays: true,
        hrBackdateLimitDays: true,
        systemStartDate: true,
      },
    });

    const response = settings
      ? {
          backdateLimitDays: settings.backdateLimitDays,
          hrBackdateLimitDays: settings.hrBackdateLimitDays,
          systemStartDate: settings.systemStartDate.toISOString(),
        }
      : {
          backdateLimitDays: 14,
          hrBackdateLimitDays: 30,
          systemStartDate: new Date('2026-09-07').toISOString(),
        };

    // Update cache
    settingsCache = {
      data: response,
      timestamp: Date.now(),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
