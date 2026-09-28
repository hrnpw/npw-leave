import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { deleteFromR2, extractR2Key } from '@/lib/r2/upload';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const { id } = await params;

    // Find attachment in database
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: 'ไม่พบไฟล์' },
        { status: 404 }
      );
    }

    // Extract R2 key from URL
    const r2Key = extractR2Key(attachment.blobUrl);

    // Delete from R2
    await deleteFromR2(r2Key);

    // Delete from database
    await prisma.attachment.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deletedSize: attachment.fileSize,
    });
  } catch (error) {
    console.error('Delete failed:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถลบไฟล์ได้' },
      { status: 500 }
    );
  }
}
