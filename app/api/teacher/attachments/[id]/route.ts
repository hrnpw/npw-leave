import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { serveAttachment } from '@/lib/r2/serveAttachment';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getTeacherSession();
  if (!session.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      blobUrl: true,
      fileName: true,
      mimeType: true,
      leave: { select: { teacherId: true } },
    },
  });
  if (!attachment) {
    return NextResponse.json({ error: 'ไม่พบไฟล์แนบ' }, { status: 404 });
  }
  if (attachment.leave.teacherId !== session.id) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
  }

  return serveAttachment(attachment, request.nextUrl.searchParams.get('download') === '1');
}
