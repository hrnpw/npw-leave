import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { fromYear, toYear } = body;

    if (!fromYear || !toYear) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Get holidays from source year
    const sourceStart = new Date(`${fromYear}-01-01`);
    const sourceEnd = new Date(`${fromYear}-12-31`);

    const sourceHolidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: sourceStart,
          lte: sourceEnd,
        },
      },
      orderBy: { date: 'asc' },
    });

    if (sourceHolidays.length === 0) {
      return NextResponse.json(
        { error: `ไม่พบวันหยุดในปี ${fromYear}` },
        { status: 404 }
      );
    }

    // Check if target year already has holidays
    const targetStart = new Date(`${toYear}-01-01`);
    const targetEnd = new Date(`${toYear}-12-31`);

    const existingCount = await prisma.holiday.count({
      where: {
        date: {
          gte: targetStart,
          lte: targetEnd,
        },
      },
    });

    if (existingCount > 0) {
      return NextResponse.json(
        { error: `ปี ${toYear} มีวันหยุดอยู่แล้ว ${existingCount} วัน` },
        { status: 400 }
      );
    }

    // Copy holidays to target year
    // ใช้ UTC ทั้งหมด (คอลัมน์เป็น @db.Date เก็บเป็นเที่ยงคืน UTC)
    // ข้าม 29 ก.พ. ถ้าปีปลายทางไม่ใช่ปีอธิกสุรทิน (ไม่ให้เลื่อนไป 1 มี.ค.)
    const targetYear = Number(toYear);
    const newHolidays = sourceHolidays.flatMap((h) => {
      const m = h.date.getUTCMonth();
      const d = h.date.getUTCDate();
      const newDate = new Date(Date.UTC(targetYear, m, d));
      if (newDate.getUTCMonth() !== m) return [];
      return [{
        date: newDate,
        name: h.name,
        year: targetYear + 543, // พ.ศ.
      }];
    });

    await prisma.holiday.createMany({
      data: newHolidays,
      skipDuplicates: true,
    });

    // TODO: Audit log

    return NextResponse.json({
      success: true,
      copied: newHolidays.length,
      message: `คัดลอกวันหยุด ${newHolidays.length} วัน จากปี ${fromYear} ไปยังปี ${toYear} สำเร็จ`,
    });
  } catch (error) {
    console.error('Failed to copy holidays:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการคัดลอกวันหยุด' },
      { status: 500 }
    );
  }
}
