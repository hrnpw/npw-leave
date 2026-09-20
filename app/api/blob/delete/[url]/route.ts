import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { deleteFromR2 } from '@/lib/r2/upload';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ url: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await params;
    const decodedUrl = decodeURIComponent(url);

    // Find attachment in database
    const attachment = await prisma.attachment.findFirst({
      where: { blobUrl: decodedUrl },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Delete from R2
    await deleteFromR2(decodedUrl);

    // Delete from database
    await prisma.attachment.delete({
      where: { id: attachment.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete failed:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถลบไฟล์ได้' },
      { status: 500 }
    );
  }
}
