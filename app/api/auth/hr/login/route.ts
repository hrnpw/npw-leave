import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import {
  getRateLimitKey,
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulAttempt
} from '@/lib/rateLimit';
import { getHrSession } from '@/lib/getSession';

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

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                request.headers.get('x-real-ip') ||
                'unknown';

    // Check rate limit
    const rateLimitKey = getRateLimitKey('hr', username, ip);
    const rateCheck = await checkRateLimit(rateLimitKey);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `ลองเข้าสู่ระบบผิดหลายครั้ง กรุณารอ ${rateCheck.remainingTime} วินาที`,
          lockedUntil: rateCheck.remainingTime,
        },
        { status: 429 }
      );
    }

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
      await recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // Check if active
    if (!hrUser.isActive) {
      await recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: 'บัญชีถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 403 }
      );
    }

    // Success - create session
    await recordSuccessfulAttempt(rateLimitKey);

    // Update last login
    await prisma.hrUser.update({
      where: { id: hrUser.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    const session = await getHrSession();
    session.id = hrUser.id;
    session.username = hrUser.username;
    session.firstName = hrUser.firstName;
    session.lastName = hrUser.lastName;
    session.role = hrUser.role;
    session.createdAt = Date.now();
    await session.save();

    return NextResponse.json({
      success: true,
      user: {
        id: hrUser.id,
        username: hrUser.username,
        firstName: hrUser.firstName,
        lastName: hrUser.lastName,
        role: hrUser.role,
      },
    });
  } catch (error) {
    console.error('HR login error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
