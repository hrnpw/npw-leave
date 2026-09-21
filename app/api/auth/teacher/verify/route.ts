import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateCitizenId, normalizeCitizenId } from '@/lib/citizenId';
import { getTeacherSession } from '@/lib/getSession';

const verifySchema = z.object({
  citizenId: z.string().length(13),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const { citizenId, birthDate } = validation.data;
    const normalizedId = normalizeCitizenId(citizenId);

    // Validate citizen ID checksum
    if (!validateCitizenId(normalizedId)) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่' },
        { status: 400 }
      );
    }

    // Find teacher
    const teacher = await prisma.teacher.findUnique({
      where: { citizenId: normalizedId },
      select: {
        id: true,
        teacherCode: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        isActive: true,
      },
    });

    // Compare birth date
    const inputDate = new Date(birthDate);
    const dbDate = teacher?.birthDate ? new Date(teacher.birthDate) : null;

    if (
      !teacher ||
      !dbDate ||
      inputDate.getTime() !== dbDate.getTime()
    ) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่' },
        { status: 401 }
      );
    }

    // Check if teacher is active
    if (!teacher.isActive) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลหรือบัญชีถูกระงับ กรุณาติดต่อฝ่ายบุคคล' },
        { status: 403 }
      );
    }

    // Success - create session

    const session = await getTeacherSession();
    session.id = teacher.id;
    session.teacherCode = teacher.teacherCode;
    session.firstName = teacher.firstName;
    session.lastName = teacher.lastName;
    session.createdAt = Date.now();
    await session.save();

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        teacherCode: teacher.teacherCode,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
      },
    });
  } catch (error) {
    console.error('Teacher verify error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
