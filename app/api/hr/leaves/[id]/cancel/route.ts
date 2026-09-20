import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { deleteFromR2 } from '@/lib/r2/upload';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { reason } = body;

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'กรุณาระบุเหตุผลในการยกเลิก (อย่างน้อย 10 ตัวอักษร)' },
        { status: 400 }
      );
    }

    // Fetch existing leave
    const existingLeave = await prisma.leave.findUnique({
      where: { id },
      include: {
        teacher: true,
        attachments: {
          select: { blobUrl: true }
        }
      },
    });

    if (!existingLeave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    // Only allow canceling approved leaves
    if (existingLeave.status !== 'approved') {
      return NextResponse.json(
        { error: 'ยกเลิกได้เฉพาะใบลาที่อนุมัติแล้วเท่านั้น' },
        { status: 400 }
      );
    }

    // Update to rejected with cancel reason
    await prisma.$transaction(async (tx) => {
      await tx.leave.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectionReason: `ยกเลิกโดย HR: ${reason}`,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.id,
          userType: session.role === 'super_admin' ? 'super_admin' : 'hr',
          action: 'LEAVE_CANCEL_APPROVED',
          resource: 'leave',
          resourceId: id,
          details: {
            before: { status: 'approved' },
            after: { status: 'rejected', reason },
            leaveNo: existingLeave.leaveNo,
            teacherId: existingLeave.teacherId,
            cancelReason: reason,
          },
        },
      });
    });

    // Delete signature from R2 (if exists)
    if (existingLeave.teacherSignatureUrl) {
      try {
        await deleteFromR2(existingLeave.teacherSignatureUrl);
      } catch (error) {
        console.error('Failed to delete signature from R2:', error);
      }
    }

    // Delete attachments from R2
    for (const att of existingLeave.attachments) {
      try {
        await deleteFromR2(att.blobUrl);
      } catch (error) {
        console.error('Failed to delete attachment from R2:', att.blobUrl, error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel approved leave error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการยกเลิกใบลา' },
      { status: 500 }
    );
  }
}
