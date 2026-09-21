import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { errorResponse, ErrorCodes } from '@/lib/apiResponse';
import { createAuditLog, AuditActions, AuditResources } from '@/lib/auditLog';

// GET /api/hr/teachers - ดึงรายการครูทั้งหมด (พร้อม search + filter)
export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'ไม่ได้รับอนุญาต', 401);
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // all | active | inactive
    const department = searchParams.get('department') || '';
    const sortBy = searchParams.get('sortBy') || 'code'; // code | name | leaves | department
    const sortOrder = searchParams.get('sortOrder') || 'asc'; // asc | desc
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { teacherCode: { contains: search, mode: 'insensitive' } },
        { citizenId: { contains: search.replace(/[-\s]/g, '') } },
      ];
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (department) {
      where.department = department;
    }

    // Get total count
    const total = await prisma.teacher.count({ where });

    // Build orderBy
    let orderBy: any = [];

    switch (sortBy) {
      case 'name':
        orderBy.push({ firstName: sortOrder });
        orderBy.push({ lastName: sortOrder });
        break;
      case 'department':
        orderBy.push({ department: sortOrder });
        orderBy.push({ teacherCode: 'asc' });
        break;
      case 'leaves':
        // Leaves count sorting handled differently (post-query)
        orderBy.push({ isActive: 'desc' });
        orderBy.push({ teacherCode: 'asc' });
        break;
      case 'code':
      default:
        orderBy.push({ teacherCode: sortOrder });
        break;
    }

    // Get teachers
    let teachers = await prisma.teacher.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: {
            leaves: true,
          },
        },
      },
    });

    // Sort by leaves count if requested (client-side sorting since it's aggregated)
    if (sortBy === 'leaves') {
      teachers = teachers.sort((a, b) => {
        const diff = a._count.leaves - b._count.leaves;
        return sortOrder === 'asc' ? diff : -diff;
      });
    }

    return NextResponse.json({
      teachers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch teachers:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'ไม่สามารถดึงข้อมูลครูได้',
      500,
      error
    );
  }
}

// POST /api/hr/teachers - เพิ่มครูใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'ไม่ได้รับอนุญาต', 401);
    }

    const body = await request.json();
    const {
      teacherCode,
      title,
      firstName,
      lastName,
      citizenId,
      birthDate,
      position,
      department,
      phone,
    } = body;

    // Validate required fields
    if (!title?.trim() || !firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกคำนำหน้า ชื่อ และนามสกุล' },
        { status: 400 }
      );
    }

    if (!citizenId?.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกเลขบัตรประชาชน' },
        { status: 400 }
      );
    }

    // Validate citizen ID format (13 digits)
    const cleanCitizenId = citizenId.replace(/[-\s]/g, '');
    if (!/^\d{13}$/.test(cleanCitizenId)) {
      return NextResponse.json(
        { error: 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก' },
        { status: 400 }
      );
    }

    // Validate citizen ID checksum
    if (!validateCitizenId(cleanCitizenId)) {
      return NextResponse.json(
        { error: 'เลขบัตรประชาชนไม่ถูกต้อง (checksum ผิด)' },
        { status: 400 }
      );
    }

    if (!birthDate) {
      return NextResponse.json(
        { error: 'กรุณาระบุวันเกิด' },
        { status: 400 }
      );
    }

    if (!position?.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกตำแหน่ง' },
        { status: 400 }
      );
    }

    // Check duplicate citizen ID
    const existingByCitizen = await prisma.teacher.findUnique({
      where: { citizenId: cleanCitizenId },
    });

    if (existingByCitizen) {
      return NextResponse.json(
        { error: 'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว' },
        { status: 400 }
      );
    }

    // Generate teacher code if not provided
    let finalTeacherCode = teacherCode?.trim();
    if (!finalTeacherCode) {
      const lastTeacher = await prisma.teacher.findFirst({
        where: { teacherCode: { startsWith: 'T-' } },
        orderBy: { teacherCode: 'desc' },
      });

      if (lastTeacher) {
        const lastNum = parseInt(lastTeacher.teacherCode.split('-')[1] || '0');
        finalTeacherCode = `T-${String(lastNum + 1).padStart(4, '0')}`;
      } else {
        finalTeacherCode = 'T-0001';
      }
    }

    // Check duplicate teacher code
    const existingByCode = await prisma.teacher.findUnique({
      where: { teacherCode: finalTeacherCode },
    });

    if (existingByCode) {
      return NextResponse.json(
        { error: `รหัสครู ${finalTeacherCode} มีอยู่ในระบบแล้ว` },
        { status: 400 }
      );
    }

    const teacher = await prisma.teacher.create({
      data: {
        teacherCode: finalTeacherCode,
        title: title.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        citizenId: cleanCitizenId,
        birthDate: new Date(birthDate),
        position: position.trim(),
        department: department?.trim() || null,
        phone: phone?.trim() || null,
        isActive: true,
      },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: AuditActions.CREATE_TEACHER,
      resource: AuditResources.TEACHERS,
      resourceId: teacher.id,
      details: {
        teacherCode: teacher.teacherCode,
        name: `${teacher.firstName} ${teacher.lastName}`,
        citizenId: cleanCitizenId,
        position: teacher.position,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error) {
    console.error('Failed to create teacher:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'ไม่สามารถเพิ่มครูได้',
      500,
      error
    );
  }
}

// Validate Thai citizen ID checksum
function validateCitizenId(id: string): boolean {
  if (id.length !== 13) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id[i]) * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(id[12]);
}
