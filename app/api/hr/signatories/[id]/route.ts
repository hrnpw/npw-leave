import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

// PATCH /api/hr/signatories/[id] - อัปเดตผู้ลงนาม
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, position, signatureUrl, isActive } = body;

    // Check if signatory exists
    const existing = await prisma.signatory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผู้ลงนาม' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (firstName !== undefined) {
      if (!firstName.trim()) {
        return NextResponse.json(
          { error: 'กรุณากรอกชื่อ' },
          { status: 400 }
        );
      }
      updateData.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      if (!lastName.trim()) {
        return NextResponse.json(
          { error: 'กรุณากรอกนามสกุล' },
          { status: 400 }
        );
      }
      updateData.lastName = lastName.trim();
    }

    if (position !== undefined) {
      if (!position.trim()) {
        return NextResponse.json(
          { error: 'กรุณากรอกตำแหน่ง' },
          { status: 400 }
        );
      }
      updateData.position = position.trim();
    }

    if (signatureUrl !== undefined) {
      updateData.signatureUrl = signatureUrl?.trim() || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const signatory = await prisma.signatory.update({
      where: { id },
      data: updateData,
    });

    // TODO: Log audit log

    return NextResponse.json({ signatory });
  } catch (error) {
    console.error('Failed to update signatory:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถอัปเดตผู้ลงนามได้' },
      { status: 500 }
    );
  }
}

// DELETE /api/hr/signatories/[id] - ลบผู้ลงนาม (เฉพาะ super admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    // Only super admin can delete
    if (session.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบได้' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if signatory exists
    const existing = await prisma.signatory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผู้ลงนาม' },
        { status: 404 }
      );
    }

    // Check if signatory is currently active in settings
    const settings = await prisma.settings.findFirst();

    if (
      settings?.currentDirectorId === id ||
      settings?.currentHrHeadId === id
    ) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบผู้ลงนามที่กำลังใช้งานอยู่ได้ กรุณาเปลี่ยนผู้ลงนามปัจจุบันก่อน' },
        { status: 400 }
      );
    }

    await prisma.signatory.delete({
      where: { id },
    });

    // TODO: Log audit log

    return NextResponse.json({ message: 'ลบผู้ลงนามสำเร็จ' });
  } catch (error) {
    console.error('Failed to delete signatory:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถลบผู้ลงนามได้' },
      { status: 500 }
    );
  }
}
