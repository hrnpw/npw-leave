import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { errorResponse, ErrorCodes } from '@/lib/apiResponse';
import { createAuditLog, AuditActions, AuditResources } from '@/lib/auditLog';

// PATCH /api/hr/teachers/[id] - อัปเดตข้อมูลครู
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'ไม่ได้รับอนุญาต', 401);
    }

    const { id } = await params;
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
      isActive,
    } = body;

    // Check if teacher exists
    const existing = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลครู' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    // Only super admin can change citizenId and birthDate
    if (citizenId !== undefined || birthDate !== undefined) {
      if (session.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขเลขบัตรและวันเกิดได้' },
          { status: 403 }
        );
      }

      if (citizenId !== undefined) {
        const cleanCitizenId = citizenId.replace(/[-\s]/g, '');
        if (!/^\d{13}$/.test(cleanCitizenId)) {
          return NextResponse.json(
            { error: 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก' },
            { status: 400 }
          );
        }

        if (!validateCitizenId(cleanCitizenId)) {
          return NextResponse.json(
            { error: 'เลขบัตรประชาชนไม่ถูกต้อง (checksum ผิด)' },
            { status: 400 }
          );
        }

        // Check duplicate
        if (cleanCitizenId !== existing.citizenId) {
          const duplicate = await prisma.teacher.findUnique({
            where: { citizenId: cleanCitizenId },
          });

          if (duplicate) {
            return NextResponse.json(
              { error: 'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว' },
              { status: 400 }
            );
          }
        }

        updateData.citizenId = cleanCitizenId;
      }

      if (birthDate !== undefined) {
        updateData.birthDate = new Date(birthDate);
      }
    }

    // HR can update these fields
    if (teacherCode !== undefined) {
      if (!teacherCode.trim()) {
        return NextResponse.json(
          { error: 'กรุณากรอกรหัสครู' },
          { status: 400 }
        );
      }

      if (teacherCode !== existing.teacherCode) {
        const duplicate = await prisma.teacher.findUnique({
          where: { teacherCode: teacherCode.trim() },
        });

        if (duplicate) {
          return NextResponse.json(
            { error: 'รหัสครูนี้มีอยู่ในระบบแล้ว' },
            { status: 400 }
          );
        }
      }

      updateData.teacherCode = teacherCode.trim();
    }

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: 'กรุณากรอกคำนำหน้า' }, { status: 400 });
      }
      updateData.title = title.trim();
    }

    if (firstName !== undefined) {
      if (!firstName.trim()) {
        return NextResponse.json({ error: 'กรุณากรอกชื่อ' }, { status: 400 });
      }
      updateData.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      if (!lastName.trim()) {
        return NextResponse.json({ error: 'กรุณากรอกนามสกุล' }, { status: 400 });
      }
      updateData.lastName = lastName.trim();
    }

    if (position !== undefined) {
      if (!position.trim()) {
        return NextResponse.json({ error: 'กรุณากรอกตำแหน่ง' }, { status: 400 });
      }
      updateData.position = position.trim();
    }

    if (department !== undefined) {
      updateData.department = department?.trim() || null;
    }

    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const teacher = await prisma.teacher.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: AuditActions.UPDATE_TEACHER,
      resource: AuditResources.TEACHERS,
      resourceId: teacher.id,
      details: {
        teacherCode: teacher.teacherCode,
        name: `${teacher.firstName} ${teacher.lastName}`,
        updatedFields: Object.keys(updateData),
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ teacher });
  } catch (error) {
    console.error('Failed to update teacher:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'ไม่สามารถอัปเดตข้อมูลครูได้',
      500,
      error
    );
  }
}

// DELETE /api/hr/teachers/[id] - ลบครู (เฉพาะ super admin + ต้องไม่มีใบลา)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'ไม่ได้รับอนุญาต', 401);
    }

    // Only super admin can delete
    if (session.role !== 'super_admin') {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบได้',
        403
      );
    }

    const { id } = await params;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            leaves: true,
          },
        },
      },
    });

    if (!teacher) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'ไม่พบข้อมูลครู', 404);
    }

    // Cannot delete if teacher has leaves
    if (teacher._count.leaves > 0) {
      return errorResponse(
        ErrorCodes.BAD_REQUEST,
        `ไม่สามารถลบครูที่มีประวัติการลา (${teacher._count.leaves} ใบ) กรุณาใช้ "ปิดใช้งาน" แทน`,
        400
      );
    }

    await prisma.teacher.delete({
      where: { id },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: AuditActions.DELETE_TEACHER,
      resource: AuditResources.TEACHERS,
      resourceId: id,
      details: {
        teacherCode: teacher.teacherCode,
        name: `${teacher.firstName} ${teacher.lastName}`,
        citizenId: teacher.citizenId,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ message: 'ลบครูสำเร็จ' });
  } catch (error) {
    console.error('Failed to delete teacher:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'ไม่สามารถลบครูได้',
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
