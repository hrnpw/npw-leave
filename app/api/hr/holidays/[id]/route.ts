import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const holiday = await prisma.holiday.findUnique({
      where: { id },
    });

    if (!holiday) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
    }

    await prisma.holiday.delete({
      where: { id },
    });

    // TODO: Audit log

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete holiday:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบวันหยุด' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        name: name.trim(),
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
    console.error('Failed to update holiday:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขวันหยุด' },
      { status: 500 }
    );
  }
}
