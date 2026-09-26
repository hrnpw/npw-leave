import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getIronSession } from 'iron-session';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { hrSessionOptions, HrSession } from '@/lib/session';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    const { username, password } = validation.data;

    // Get client IP for logging
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                request.headers.get('x-real-ip') ||
                'unknown';

    // Find HR user
    const hrUser = await prisma.hrUser.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    // Verify password
    if (!hrUser || !(await verifyPassword(password, hrUser.passwordHash))) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // Check if active
    if (!hrUser.isActive) {
      return NextResponse.json(
        { error: 'บัญชีถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 403 }
      );
    }

    // Create session with proper cookie handling
    const response = NextResponse.json({
      success: true,
      user: {
        id: hrUser.id,
        username: hrUser.username,
        firstName: hrUser.firstName,
        lastName: hrUser.lastName,
        role: hrUser.role,
      },
    });

    // IMPORTANT: Must pass request and response to iron-session for cookie headers
    const session = await getIronSession<HrSession>(request, response, hrSessionOptions);
    session.id = hrUser.id;
    session.username = hrUser.username;
    session.firstName = hrUser.firstName;
    session.lastName = hrUser.lastName;
    session.role = hrUser.role;
    session.createdAt = Date.now();
    await session.save();

    console.log('[HR Login API] Session created and saved:', {
      id: session.id,
      username: session.username,
      role: session.role,
      createdAt: session.createdAt,
      timestamp: new Date().toISOString(),
      cookieHeaders: response.headers.get('set-cookie')
    });

    // Update last login (non-critical - don't block response if it fails)
    prisma.hrUser.update({
      where: { id: hrUser.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    }).catch(err => {
      console.error('Failed to update lastLoginAt:', err);
      // Don't throw - session is already created
    });

    return response;
  } catch (error) {
    console.error('HR login error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
