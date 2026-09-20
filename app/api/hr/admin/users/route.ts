import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit/logger';

// GET /api/hr/admin/users - ดึงรายการบัญชี HR ทั้งหมด
export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await prisma.hrUser.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/hr/admin/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/hr/admin/users - สร้างบัญชี HR ใหม่
export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { username, password, firstName, lastName, role } = body;

    // Validate
    if (!username || !password || !firstName || !lastName || !role) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    if (username.length < 3 || username.length > 50) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้ต้องยาว 3-50 ตัวอักษร' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้ต้องเป็น a-z A-Z 0-9 _ เท่านั้น' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' },
        { status: 400 }
      );
    }

    if (!['hr', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'บทบาทไม่ถูกต้อง' }, { status: 400 });
    }

    // Check duplicate username
    const existing = await prisma.hrUser.findUnique({
      where: { username },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser = await prisma.hrUser.create({
      data: {
        username,
        passwordHash,
        firstName,
        lastName,
        role,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'CREATE_HR_USER',
      resource: 'hr_user',
      resourceId: newUser.id,
      details: {
        username: newUser.username,
        role: newUser.role,
        createdBy: session.id,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('POST /api/hr/admin/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
