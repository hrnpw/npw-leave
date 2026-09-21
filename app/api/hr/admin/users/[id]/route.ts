import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createAuditLog } from '@/lib/audit/logger';

// PATCH /api/hr/admin/users/[id] - แก้ไขบัญชี HR
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { firstName, lastName, role, isActive } = body;

    // ห้ามแก้ไขตัวเอง
    if (id === session.id) {
      return NextResponse.json(
        { error: 'ไม่สามารถแก้ไขบัญชีของตัวเองได้' },
        { status: 400 }
      );
    }

    // ดึงข้อมูลเก่า
    const oldUser = await prisma.hrUser.findUnique({
      where: { id },
    });

    if (!oldUser) {
      return NextResponse.json({ error: 'ไม่พบบัญชีนี้' }, { status: 404 });
    }

    // Validate role
    if (role !== undefined && !['hr', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'บทบาทไม่ถูกต้อง' }, { status: 400 });
    }

    // ตรวจสอบไม่ให้ super admin คนสุดท้ายถูกเปลี่ยน role หรือปิดใช้งาน
    if (oldUser.role === 'super_admin') {
      if (role === 'hr' || isActive === false) {
        const superAdminCount = await prisma.hrUser.count({
          where: { role: 'super_admin', isActive: true },
        });

        if (superAdminCount <= 1) {
          return NextResponse.json(
            { error: 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 บัญชี' },
            { status: 400 }
          );
        }
      }
    }

    // Update
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.hrUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Audit log
    const changes = Object.keys(updateData).map((field) => ({
      field,
      before: oldUser[field as keyof typeof oldUser],
      after: updateData[field],
    }));

    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'UPDATE_HR_USER',
      resource: 'hr_user',
      resourceId: id,
      details: {
        username: oldUser.username,
        changes,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/hr/admin/users/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/hr/admin/users/[id] - ลบบัญชี HR
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // ห้ามลบตัวเอง
    if (id === session.id) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบบัญชีของตัวเองได้' },
        { status: 400 }
      );
    }

    const user = await prisma.hrUser.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: 'ไม่พบบัญชีนี้' }, { status: 404 });
    }

    // ห้ามลบ super admin คนสุดท้าย
    if (user.role === 'super_admin') {
      const superAdminCount = await prisma.hrUser.count({
        where: { role: 'super_admin', isActive: true },
      });

      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 บัญชี' },
          { status: 400 }
        );
      }
    }

    // ลบ (cascade ไป audit logs อัตโนมัติ)
    await prisma.hrUser.delete({
      where: { id },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'DELETE_HR_USER',
      resource: 'hr_user',
      resourceId: id,
      details: {
        username: user.username,
        role: user.role,
        deletedBy: session.id,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/hr/admin/users/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
