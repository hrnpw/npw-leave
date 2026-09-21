import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { deleteFromR2 } from '@/lib/r2/upload';
import { createAuditLog } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getHrSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check super admin role
    const hrUser = await prisma.hrUser.findUnique({
      where: { id: session.id },
      select: { id: true, role: true, firstName: true, lastName: true },
    });

    if (!hrUser || hrUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 });
    }

    // 3. Verify confirmation text
    const body = await req.json();
    const { confirmation } = body;

    if (confirmation !== 'ยืนยันลบใบลาทั้งหมด') {
      return NextResponse.json(
        { error: 'Invalid confirmation text' },
        { status: 400 }
      );
    }

    // 4. Get all leaves with attachments, signatures, and PDFs
    const allLeaves = await prisma.leave.findMany({
      include: {
        attachments: true,
        leaveDays: true,
      },
    });

    const totalLeaves = allLeaves.length;
    const totalAttachments = allLeaves.reduce((sum, leave) => sum + leave.attachments.length, 0);
    const totalDays = allLeaves.reduce((sum, leave) => sum + leave.leaveDays.length, 0);

    // 5. Delete all R2 files (attachments + signatures)
    const r2FilesToDelete: string[] = [
      ...allLeaves.flatMap(leave => leave.attachments.map(att => att.blobUrl)),
      ...allLeaves.map(leave => leave.teacherSignatureUrl).filter(Boolean) as string[],
    ];

    let r2DeletedCount = 0;
    let r2Errors: string[] = [];

    for (const url of r2FilesToDelete) {
      try {
        await deleteFromR2(url);
        r2DeletedCount++;
      } catch (error) {
        r2Errors.push(`Failed to delete ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 6. Delete database records (cascade will handle leaveDays and attachments)
    await prisma.$transaction([
      prisma.leave.deleteMany({}),
      prisma.fiscalCounter.deleteMany({}),
      // Keep notification_queue as per spec
    ]);

    // 7. Create audit log
    await createAuditLog({
      userId: hrUser.id,
      userType: 'hr',
      action: 'DELETE_ALL_LEAVES',
      resource: 'leaves',
      resourceId: 'all',
      details: {
        deletedLeaves: totalLeaves,
        deletedAttachments: totalAttachments,
        deletedLeaveDays: totalDays,
        r2FilesDeleted: r2DeletedCount,
        r2FilesTotal: r2FilesToDelete.length,
        r2Errors: r2Errors.length > 0 ? r2Errors : undefined,
        performedBy: `${hrUser.firstName} ${hrUser.lastName}`,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'ลบใบลาทั้งหมดเรียบร้อยแล้ว',
      summary: {
        leavesDeleted: totalLeaves,
        attachmentsDeleted: totalAttachments,
        leaveDaysDeleted: totalDays,
        r2FilesDeleted: r2DeletedCount,
        r2FilesTotal: r2FilesToDelete.length,
        r2Errors: r2Errors.length,
      },
    });
  } catch (error) {
    console.error('[DELETE ALL LEAVES ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to delete all leaves', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
