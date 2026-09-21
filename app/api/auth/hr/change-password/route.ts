import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { getHrSession } from '@/lib/getSession';
import { createAuditLog } from '@/lib/audit/logger';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
  newPassword: z.string().min(8, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = changePasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // ดึงข้อมูล HR user
    const hrUser = await prisma.hrUser.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        passwordHash: true,
        username: true,
      },
    });

    if (!hrUser) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผู้ใช้' },
        { status: 404 }
      );
    }

    // ตรวจสอบรหัสผ่านปัจจุบัน
    const isValid = await verifyPassword(currentPassword, hrUser.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // Hash รหัสผ่านใหม่
    const newPasswordHash = await hashPassword(newPassword);

    // อัปเดตรหัสผ่าน
    await prisma.hrUser.update({
      where: { id: hrUser.id },
      data: { passwordHash: newPasswordHash },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'CHANGE_PASSWORD',
      resource: 'hr_user',
      resourceId: hrUser.id,
      details: {
        username: hrUser.username,
        changedAt: new Date().toISOString(),
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
