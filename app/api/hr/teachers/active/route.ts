import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Uses cookies for auth

// Simple in-memory cache (resets on server restart)
let teachersCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    // If no search query, try cache first
    if (!search && teachersCache && Date.now() - teachersCache.timestamp < CACHE_TTL) {
      return NextResponse.json(teachersCache.data, {
        headers: {
          'Cache-Control': 'private, max-age=300', // Client cache 5 minutes
        },
      });
    }

    // Get current HR user info to filter them out (only if needed for filtering)
    const currentHrUser = await prisma.hrUser.findUnique({
      where: { id: session.id },
      select: { firstName: true, lastName: true },
    });

    const where: any = {
      isActive: true,
    };

    // Filter out HR user if they have a teacher account with matching name
    if (currentHrUser) {
      where.NOT = {
        AND: [
          { firstName: currentHrUser.firstName },
          { lastName: currentHrUser.lastName },
        ],
      };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { teacherCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const teachers = await prisma.teacher.findMany({
      where,
      select: {
        id: true,
        teacherCode: true,
        title: true,
        firstName: true,
        lastName: true,
        position: true,
        department: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 50,
    });

    const response = { teachers };

    // Cache only when no search query
    if (!search) {
      teachersCache = {
        data: response,
        timestamp: Date.now(),
      };
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': search ? 'private, max-age=60' : 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('Failed to fetch teachers:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
