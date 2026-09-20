import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { deleteFromR2 } from '@/lib/r2/upload';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const leaveId = id;

    // Get leave and verify ownership
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      select: {
        teacherId: true,
        status: true,
        teacherSignatureUrl: true,
        attachments: {
          select: { blobUrl: true },
        },
      },
    });

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    if (leave.teacherId !== session.id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    // Can only cancel pending leaves
    if (leave.status !== 'pending') {
      return NextResponse.json(
        { error: 'สามารถยกเลิกได้เฉพาะใบลาที่รออนุมัติเท่านั้น' },
        { status: 400 }
      );
    }

    // Update to cancelled
    await prisma.leave.update({
      where: { id: leaveId },
      data: { status: 'cancelled' },
    });

    // Delete signature from R2 (if exists)
    if (leave.teacherSignatureUrl) {
      try {
        await deleteFromR2(leave.teacherSignatureUrl);
      } catch (error) {
        console.error('Failed to delete signature from R2:', error);
        // Don't fail the cancellation if R2 delete fails
      }
    }

    // Delete attachments from R2
    for (const att of leave.attachments) {
      try {
        await deleteFromR2(att.blobUrl);
      } catch (error) {
        console.error('Failed to delete attachment from R2:', att.blobUrl, error);
        // Don't fail the cancellation if R2 delete fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'ยกเลิกใบลาสำเร็จ',
    });
  } catch (error) {
    console.error('Cancel leave error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการยกเลิกใบลา' },
      { status: 500 }
    );
  }
}
