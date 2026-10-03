import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { saveLeaveAttachment, AttachmentError } from '@/lib/r2/attachments';

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
    const leave = await prisma.leave.findUnique({
      where: { id },
      select: { teacherId: true, status: true, leaveNo: true },
    });

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }
    if (leave.teacherId !== session.id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }
    if (leave.status !== 'pending') {
      return NextResponse.json({ error: 'แนบไฟล์ได้เฉพาะใบลาที่รออนุมัติ' }, { status: 400 });
    }

    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 });
    }

    const attachment = await saveLeaveAttachment({ id, leaveNo: leave.leaveNo }, file);
    return NextResponse.json({ success: true, attachment });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Upload attachment error:', error);
    return NextResponse.json({ error: 'อัปโหลดไฟล์ไม่สำเร็จ' }, { status: 500 });
  }
}
