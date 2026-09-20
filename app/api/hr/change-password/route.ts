import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit/logger';

// POST /api/hr/change-password - เปลี่ยนรหัสผ่านตัวเอง (HR และ super admin)
export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร' },
        { status: 400 }
      );
    }

    // ดึงข้อมูลผู้ใช้
    const user = await prisma.hrUser.findUnique({
      where: { id: session.id },
      select: { id: true, username: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 });
    }

    // ตรวจสอบรหัสผ่านเดิม
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'รหัสผ่านเดิมไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Hash รหัสผ่านใหม่
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // อัปเดต
    await prisma.hrUser.update({
      where: { id: session.id },
      data: { passwordHash: newPasswordHash },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'CHANGE_OWN_PASSWORD',
      resource: 'hr_user',
      resourceId: session.id,
      details: {
        username: user.username,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) {
    console.error('POST /api/hr/change-password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
