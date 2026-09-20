import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

// GET /api/hr/teachers/[id]/leaves - ดึงประวัติการลาของครู
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();

    if (!session) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const { id: teacherId } = await params;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        title: true,
        firstName: true,
        lastName: true,
        teacherCode: true,
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'ไม่พบครู' }, { status: 404 });
    }

    // Get leave history
    const leaves = await prisma.leave.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        leaveNo: true,
        type: true,
        startDate: true,
        endDate: true,
        daysWorking: true,
        reason: true,
        status: true,
        createdAt: true,
        approvedAt: true,
        pdfUrl: true,
      },
    });

    return NextResponse.json({
      teacher,
      leaves,
      total: leaves.length,
    });
  } catch (error) {
    console.error('Failed to fetch teacher leaves:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถดึงประวัติการลาได้' },
      { status: 500 }
    );
  }
}
