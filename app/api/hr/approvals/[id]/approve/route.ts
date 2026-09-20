import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: leaveId } = await params;

    // Get leave
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    if (leave.status !== 'pending') {
      return NextResponse.json(
        { error: 'สามารถอนุมัติได้เฉพาะใบลาที่รออนุมัติเท่านั้น' },
        { status: 400 }
      );
    }

    // Get current signatories
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    let approverSnapshot = null;
    let directorSnapshot = null;

    if (settings?.currentHrHeadId) {
      const hrHead = await prisma.signatory.findUnique({
        where: { id: settings.currentHrHeadId },
      });
      if (hrHead) {
        approverSnapshot = {
          name: `${hrHead.title}${hrHead.firstName} ${hrHead.lastName}`,
          position: hrHead.position,
        };
      }
    }

    if (settings?.currentDirectorId) {
      const director = await prisma.signatory.findUnique({
        where: { id: settings.currentDirectorId },
      });
      if (director) {
        directorSnapshot = {
          name: `${director.title}${director.firstName} ${director.lastName}`,
          position: director.position,
        };
      }
    }

    // Update leave (step 1: approve)
    const updatedLeave = await prisma.leave.update({
      where: { id: leaveId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approverNameSnapshot: approverSnapshot?.name,
        approverPositionSnapshot: approverSnapshot?.position,
        directorNameSnapshot: directorSnapshot?.name,
        directorPositionSnapshot: directorSnapshot?.position,
      },
      include: {
        teacher: true,
        leaveDays: true,
      },
    });

    // Step 2: Fire-and-forget PDF generation (background)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const pdfGenUrl = `${baseUrl}/api/hr/leaves/${updatedLeave.id}/generate-pdf`;

      console.log('[APPROVE] Triggering background PDF generation:', pdfGenUrl);

      fetch(pdfGenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': process.env.INTERNAL_API_KEY || '',
        },
      }).catch((err) => console.error('[APPROVE] PDF generation failed (non-blocking):', err));
    } catch (pdfError) {
      console.error('[APPROVE] PDF trigger error (non-blocking):', pdfError);
    }

    // Step 3: Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'APPROVE_LEAVE',
      resource: 'leaves',
      resourceId: updatedLeave.id,
      details: {
        leaveNo: updatedLeave.leaveNo,
        teacherId: updatedLeave.teacherId,
        teacherName: `${updatedLeave.teacher.firstName} ${updatedLeave.teacher.lastName}`,
        type: updatedLeave.type,
        startDate: updatedLeave.startDate.toISOString(),
        endDate: updatedLeave.endDate.toISOString(),
        daysWorking: updatedLeave.daysWorking,
        daysCalendar: updatedLeave.daysCalendar,
        pdfGenerationTriggered: true,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'อนุมัติใบลาสำเร็จ',
    });
  } catch (error) {
    console.error('Approve leave error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอนุมัติใบลา' },
      { status: 500 }
    );
  }
}
