import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { deleteFromR2, extractR2Key } from '@/lib/r2/upload';
import { createAuditLog } from '@/lib/audit/logger';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    // Super admin only
    if (session.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'เฉพาะผู้ดูแลระบบเท่านั้น' },
        { status: 403 }
      );
    }

    const { id: leaveId } = await params;

    // Get leave with all relations
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            teacherCode: true,
          },
        },
        attachments: true,
        leaveDays: true,
      },
    });

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    // Delete all R2 files (signature + PDF + attachments)
    const r2Errors: string[] = [];

    // Delete PDF
    if (leave.pdfUrl) {
      try {
        const pdfKey = extractR2Key(leave.pdfUrl);
        await deleteFromR2(pdfKey);
      } catch (error) {
        console.error(`Failed to delete PDF from R2:`, error);
        r2Errors.push('pdf');
      }
    }

    // Delete signature
    if (leave.teacherSignatureUrl) {
      try {
        const signatureKey = extractR2Key(leave.teacherSignatureUrl);
        await deleteFromR2(signatureKey);
      } catch (error) {
        console.error(`Failed to delete signature from R2:`, error);
        r2Errors.push('signature');
      }
    }

    // Delete attachments
    for (const attachment of leave.attachments) {
      try {
        const attachmentKey = extractR2Key(attachment.blobUrl);
        await deleteFromR2(attachmentKey);
      } catch (error) {
        console.error(`Failed to delete attachment from R2 ${attachment.blobUrl}:`, error);
        r2Errors.push(attachment.fileName);
      }
    }

    // Delete from database (cascade will handle leaveDays and attachments)
    await prisma.leave.delete({
      where: { id: leaveId },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'super_admin',
      action: 'SUPER_ADMIN_DELETE_LEAVE',
      resource: 'leave',
      resourceId: leaveId,
      details: {
        leaveNo: leave.leaveNo,
        teacherId: leave.teacherId,
        teacherName: `${leave.teacher.firstName} ${leave.teacher.lastName}`,
        teacherCode: leave.teacher.teacherCode,
        type: leave.type,
        status: leave.status,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        daysWorking: leave.daysWorking,
        daysCalendar: leave.daysCalendar,
        attachmentsCount: leave.attachments.length,
        r2Errors: r2Errors.length > 0 ? r2Errors : undefined,
      },
      ipAddress:
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'ลบใบลาถาวรแล้ว',
      leaveNo: leave.leaveNo,
      attachmentsDeleted: leave.attachments.length,
      r2Errors: r2Errors.length > 0 ? r2Errors : undefined,
    });
  } catch (error) {
    console.error('Delete leave error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบใบลา' },
      { status: 500 }
    );
  }
}
