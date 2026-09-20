import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit/logger';

// POST /api/hr/admin/users/[id]/reset-password - รีเซ็ตรหัสผ่าน
export async function POST(
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
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' },
        { status: 400 }
      );
    }

    const user = await prisma.hrUser.findUnique({
      where: { id },
      select: { id: true, username: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'ไม่พบบัญชีนี้' }, { status: 404 });
    }

    // Hash password
    const passwordHash = await hashPassword(newPassword);

    // Update
    await prisma.hrUser.update({
      where: { id },
      data: { passwordHash },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'RESET_HR_PASSWORD',
      resource: 'hr_user',
      resourceId: id,
      details: {
        username: user.username,
        resetBy: session.id,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/hr/admin/users/[id]/reset-password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
