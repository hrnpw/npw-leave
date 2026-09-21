import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

// GET /api/hr/teachers/export - ดึงข้อมูลครูทั้งหมดสำหรับ export Excel
export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const department = searchParams.get('department') || '';

    // Build where clause
    const where: any = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (department) {
      where.department = department;
    }

    const teachers = await prisma.teacher.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { teacherCode: 'asc' },
      ],
      include: {
        _count: {
          select: {
            leaves: true,
          },
        },
      },
    });

    // Format data for export
    const exportData = teachers.map((t) => ({
      teacherCode: t.teacherCode,
      title: t.title,
      firstName: t.firstName,
      lastName: t.lastName,
      citizenId: formatCitizenId(t.citizenId),
      birthDate: t.birthDate.toISOString().split('T')[0],
      position: t.position,
      department: t.department || '',
      phoneNumber: t.phone || '',
      isActive: t.isActive ? 'ใช้งาน' : 'ปิดใช้งาน',
      leavesCount: t._count.leaves,
    }));

    return NextResponse.json({ teachers: exportData });
  } catch (error) {
    console.error('Failed to export teachers:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถ export ข้อมูลได้' },
      { status: 500 }
    );
  }
}

function formatCitizenId(id: string): string {
  // Format as 1-2345-67890-12-3
  return `${id.slice(0, 1)}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id.slice(12)}`;
}
