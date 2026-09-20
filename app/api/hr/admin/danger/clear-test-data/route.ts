import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit/logger';
import { deleteFromR2 } from '@/lib/r2/upload';

// POST /api/hr/admin/danger/clear-test-data - ล้างข้อมูลทดสอบ (super admin เท่านั้น)
export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { confirmation } = body;

    // ต้องพิมพ์ "ยืนยันล้างข้อมูล" ตรงตัว
    if (confirmation !== 'ยืนยันล้างข้อมูล') {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อความยืนยันให้ถูกต้อง' },
        { status: 400 }
      );
    }

    // นับจำนวนข้อมูลก่อนลบ
    const [leavesCount, attachmentsCount] = await Promise.all([
      prisma.leave.count(),
      prisma.attachment.count(),
    ]);

    // ดึง R2 URLs ก่อนลบ (attachments + signatures + PDFs)
    const [attachments, leaves] = await Promise.all([
      prisma.attachment.findMany({ select: { blobUrl: true } }),
      prisma.leave.findMany({ select: { teacherSignatureUrl: true, pdfUrl: true } }),
    ]);

    const r2FilesToDelete: string[] = [
      ...attachments.map((a) => a.blobUrl),
      ...leaves.map((l) => l.teacherSignatureUrl).filter(Boolean) as string[],
      ...leaves.map((l) => l.pdfUrl).filter(Boolean) as string[],
    ];

    // ลบข้อมูล (ใช้ transaction)
    await prisma.$transaction(async (tx) => {
      // ลบใบลา (cascade attachments, leave_days)
      await tx.leave.deleteMany({});
      // รีเซ็ต fiscal counter
      await tx.fiscalCounter.deleteMany({});
      // ล้าง notification queue
      await tx.notificationQueue.deleteMany();
    });

    // ลบไฟล์จาก R2 (ไม่บล็อก transaction)
    let deletedFilesCount = 0;
    const r2Errors: string[] = [];
    for (const url of r2FilesToDelete) {
      try {
        await deleteFromR2(url);
        deletedFilesCount++;
      } catch (error) {
        console.error('Failed to delete R2 file:', url, error);
        r2Errors.push(url);
      }
    }

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'CLEAR_TEST_DATA',
      resource: 'system',
      resourceId: undefined,
      details: {
        leavesDeleted: leavesCount,
        attachmentsDeleted: attachmentsCount,
        r2FilesDeleted: deletedFilesCount,
        r2FilesTotal: r2FilesToDelete.length,
        r2Errors: r2Errors.length > 0 ? r2Errors : undefined,
        executor: session.id,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      deleted: {
        leaves: leavesCount,
        attachments: attachmentsCount,
        r2Files: deletedFilesCount,
        r2FilesTotal: r2FilesToDelete.length,
        r2Errors: r2Errors.length > 0 ? r2Errors : undefined,
      },
    });
  } catch (error) {
    console.error('POST /api/hr/admin/danger/clear-test-data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
