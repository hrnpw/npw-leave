import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

// POST /api/blob/bulk-delete - Bulk delete attachments
export async function POST(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const body = await request.json();
    const { attachmentIds } = body;

    if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาระบุ attachment IDs' },
        { status: 400 }
      );
    }

    // Get attachments with blob URLs
    const attachments = await prisma.attachment.findMany({
      where: {
        id: {
          in: attachmentIds,
        },
      },
      select: {
        id: true,
        blobUrl: true,
        fileSize: true,
      },
    });

    if (attachments.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบไฟล์ที่ต้องการลบ' },
        { status: 404 }
      );
    }

    let deletedCount = 0;
    let totalSize = 0;
    const errors: string[] = [];

    // Delete from R2 and database
    for (const att of attachments) {
      try {
        // Delete from R2
        const deleteRes = await fetch(
          `${request.nextUrl.origin}/api/blob/delete/${encodeURIComponent(att.blobUrl)}`,
          { method: 'DELETE' }
        );

        if (deleteRes.ok) {
          deletedCount++;
          totalSize += att.fileSize;
        } else {
          errors.push(`Failed to delete ${att.id}`);
        }
      } catch (error) {
        errors.push(`Error deleting ${att.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      totalSize,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Bulk delete failed:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถลบไฟล์ได้' },
      { status: 500 }
    );
  }
}
