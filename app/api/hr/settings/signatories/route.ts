import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

// PATCH /api/hr/settings/signatories - อัปเดตผู้ลงนามปัจจุบัน
export async function PATCH(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const body = await request.json();
    const { currentDirectorId, currentHrHeadId } = body;

    // Validate that IDs exist and are active
    if (currentDirectorId) {
      const director = await prisma.signatory.findFirst({
        where: {
          id: currentDirectorId,
          role: 'director',
          isActive: true,
        },
      });

      if (!director) {
        return NextResponse.json(
          { error: 'ไม่พบผู้อำนวยการที่เลือก หรือถูกปิดใช้งาน' },
          { status: 400 }
        );
      }
    }

    if (currentHrHeadId) {
      const hrHead = await prisma.signatory.findFirst({
        where: {
          id: currentHrHeadId,
          role: 'hr_head',
          isActive: true,
        },
      });

      if (!hrHead) {
        return NextResponse.json(
          { error: 'ไม่พบหัวหน้าฝ่ายบุคคลที่เลือก หรือถูกปิดใช้งาน' },
          { status: 400 }
        );
      }
    }

    // Update settings (upsert in case settings doesn't exist)
    const updateData: any = {};
    if (currentDirectorId !== undefined) {
      updateData.currentDirectorId = currentDirectorId || null;
    }
    if (currentHrHeadId !== undefined) {
      updateData.currentHrHeadId = currentHrHeadId || null;
    }

    const settings = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: updateData,
      create: {
        id: 'singleton',
        systemStartDate: new Date('2026-09-07'),
        ...updateData,
      },
    });

    // TODO: Log audit log

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to update signatories settings:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถอัปเดตผู้ลงนามได้' },
      { status: 500 }
    );
  }
}
