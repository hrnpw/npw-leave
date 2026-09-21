import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

// GET /api/hr/storage/analytics - Get storage analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    // Get all attachments with leave info
    const attachments = await prisma.attachment.findMany({
      select: {
        id: true,
        fileSize: true,
        mimeType: true,
        uploadedAt: true,
        leave: {
          select: {
            teacherId: true,
            teacher: {
              select: {
                title: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Calculate statistics
    const totalFiles = attachments.length;
    const totalSize = attachments.reduce((sum, att) => sum + att.fileSize, 0);
    const avgFileSize = totalFiles > 0 ? totalSize / totalFiles : 0;

    // Group by file type
    const byFileType = attachments.reduce((acc, att) => {
      const type = att.mimeType || 'unknown';
      if (!acc[type]) {
        acc[type] = { count: 0, size: 0 };
      }
      acc[type].count++;
      acc[type].size += att.fileSize;
      return acc;
    }, {} as Record<string, { count: number; size: number }>);

    // Top teachers by storage usage
    const byTeacher = attachments.reduce((acc, att) => {
      const teacherId = att.leave.teacherId;
      if (!acc[teacherId]) {
        acc[teacherId] = {
          teacherId,
          name: `${att.leave.teacher.title}${att.leave.teacher.firstName} ${att.leave.teacher.lastName}`,
          count: 0,
          size: 0,
        };
      }
      acc[teacherId].count++;
      acc[teacherId].size += att.fileSize;
      return acc;
    }, {} as Record<string, { teacherId: string; name: string; count: number; size: number }>);

    const topTeachers = Object.values(byTeacher)
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    // Uploads by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const byMonth = attachments
      .filter((att) => att.uploadedAt >= sixMonthsAgo)
      .reduce((acc, att) => {
        const month = att.uploadedAt.toISOString().slice(0, 7); // YYYY-MM
        if (!acc[month]) {
          acc[month] = { count: 0, size: 0 };
        }
        acc[month].count++;
        acc[month].size += att.fileSize;
        return acc;
      }, {} as Record<string, { count: number; size: number }>);

    return NextResponse.json({
      totalFiles,
      totalSize,
      avgFileSize,
      byFileType,
      topTeachers,
      byMonth,
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลได้' },
      { status: 500 }
    );
  }
}
