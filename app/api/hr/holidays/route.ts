import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');

    const where: any = {};
    if (year) {
      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear = new Date(`${year}-12-31`);
      where.date = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      holidays: holidays.map((h) => ({
        id: h.id,
        date: h.date.toISOString(),
        name: h.name,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch holidays:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { date: dateStr, name } = body;

    if (!dateStr || !name) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Parse date with UTC timezone to prevent timezone shift
    // Format: "2026-09-14" -> "2026-09-14T00:00:00.000Z"
    const date = new Date(dateStr + 'T00:00:00.000Z');

    // Check if holiday already exists on this date
    const existing = await prisma.holiday.findFirst({
      where: { date },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'มีวันหยุดในวันนี้อยู่แล้ว' },
        { status: 400 }
      );
    }

    const holiday = await prisma.holiday.create({
      data: {
        date,
        name: name.trim(),
        year: date.getFullYear() + 543, // พ.ศ.
      },
    });

    // TODO: Audit log

    return NextResponse.json({
      holiday: {
        id: holiday.id,
        date: holiday.date.toISOString(),
        name: holiday.name,
      },
    });
  } catch (error) {
    console.error('Failed to create holiday:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างวันหยุด' },
      { status: 500 }
    );
  }
}
