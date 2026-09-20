import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const hasAttachments = searchParams.get('hasAttachments') === 'true';
    const search = searchParams.get('search') || '';
    const fileType = searchParams.get('fileType') || '';
    const minSize = parseInt(searchParams.get('minSize') || '0');
    const maxSize = parseInt(searchParams.get('maxSize') || '0');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'size';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    if (!hasAttachments) {
      return NextResponse.json({ leaves: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }

    // Build where clause
    const where: any = {
      attachments: {
        some: fileType ? { mimeType: { contains: fileType } } : {},
      },
    };

    // Search by leave number or teacher name
    if (search) {
      where.OR = [
        { leaveNo: { contains: search, mode: 'insensitive' } },
        { teacher: { firstName: { contains: search, mode: 'insensitive' } } },
        { teacher: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Get total count
    const total = await prisma.leave.count({ where });

    // Get leaves
    const leaves = await prisma.leave.findMany({
      where,
      include: {
        teacher: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
          },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            blobUrl: true,
            mimeType: true,
            uploadedAt: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Calculate total size per leave and apply size filters
    let leavesWithSize = leaves.map((leave) => {
      const totalSize = leave.attachments.reduce(
        (sum, att) => sum + att.fileSize,
        0
      );
      return {
        ...leave,
        totalSize,
      };
    });

    // Filter by size range
    if (minSize > 0 || maxSize > 0) {
      leavesWithSize = leavesWithSize.filter((leave) => {
        if (minSize > 0 && leave.totalSize < minSize) return false;
        if (maxSize > 0 && leave.totalSize > maxSize) return false;
        return true;
      });
    }

    // Sort
    if (sortBy === 'size') {
      leavesWithSize.sort((a, b) =>
        sortOrder === 'asc' ? a.totalSize - b.totalSize : b.totalSize - a.totalSize
      );
    } else if (sortBy === 'date') {
      leavesWithSize.sort((a, b) => {
        const aDate = a.attachments[0]?.uploadedAt || new Date(0);
        const bDate = b.attachments[0]?.uploadedAt || new Date(0);
        return sortOrder === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      });
    } else if (sortBy === 'files') {
      leavesWithSize.sort((a, b) =>
        sortOrder === 'asc'
          ? a.attachments.length - b.attachments.length
          : b.attachments.length - a.attachments.length
      );
    }

    return NextResponse.json({
      leaves: leavesWithSize,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to get leaves with attachments:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
