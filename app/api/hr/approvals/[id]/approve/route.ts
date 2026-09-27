import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Validate session and get leaveId in parallel
    const [session, { id: leaveId }] = await Promise.all([
      getHrSession(),
      params,
    ]);

    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Fetch leave and settings in parallel
    const [leave, settings] = await Promise.all([
      prisma.leave.findUnique({
        where: { id: leaveId },
        select: {
          id: true,
          leaveNo: true,
          status: true,
          teacherId: true,
          type: true,
          startDate: true,
          endDate: true,
          daysWorking: true,
          daysCalendar: true,
          teacher: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.settings.findUnique({
        where: { id: 'singleton' },
        select: {
          currentHrHeadId: true,
          currentDirectorId: true,
        },
      }),
    ]);

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    if (leave.status !== 'pending') {
      return NextResponse.json(
        { error: 'สามารถอนุมัติได้เฉพาะใบลาที่รออนุมัติเท่านั้น' },
        { status: 400 }
      );
    }

    // Step 3: Fetch both signatories in parallel (only if they exist)
    const [hrHead, director] = await Promise.all([
      settings?.currentHrHeadId
        ? prisma.signatory.findUnique({
            where: { id: settings.currentHrHeadId },
            select: {
              title: true,
              firstName: true,
              lastName: true,
              position: true,
            },
          })
        : Promise.resolve(null),
      settings?.currentDirectorId
        ? prisma.signatory.findUnique({
            where: { id: settings.currentDirectorId },
            select: {
              title: true,
              firstName: true,
              lastName: true,
              position: true,
            },
          })
        : Promise.resolve(null),
    ]);

    // Prepare snapshot data
    const approverSnapshot = hrHead
      ? {
          name: `${hrHead.title}${hrHead.firstName} ${hrHead.lastName}`,
          position: hrHead.position,
        }
      : null;

    const directorSnapshot = director
      ? {
          name: `${director.title}${director.firstName} ${director.lastName}`,
          position: director.position,
        }
      : null;

    // Step 4: Update leave status (no need to include data we already have)
    await prisma.leave.update({
      where: { id: leaveId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approverNameSnapshot: approverSnapshot?.name,
        approverPositionSnapshot: approverSnapshot?.position,
        directorNameSnapshot: directorSnapshot?.name,
        directorPositionSnapshot: directorSnapshot?.position,
      },
    });

    // Step 5: Audit log (fire-and-forget - don't block response)
    createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'APPROVE_LEAVE',
      resource: 'leaves',
      resourceId: leave.id,
      details: {
        leaveNo: leave.leaveNo,
        teacherId: leave.teacherId,
        teacherName: `${leave.teacher.firstName} ${leave.teacher.lastName}`,
        type: leave.type,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        daysWorking: leave.daysWorking,
        daysCalendar: leave.daysCalendar,
        pdfGenerationTriggered: true,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(err => console.error('[APPROVE] Audit log failed (non-blocking):', err));

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
