import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { errorResponse, ErrorCodes } from '@/lib/apiResponse';
import { createAuditLog, AuditActions, AuditResources } from '@/lib/auditLog';

interface ImportRow {
  row: number;
  teacherCode?: string;
  title: string;
  firstName: string;
  lastName: string;
  citizenId: string;
  birthDate: string;
  position: string;
  department?: string;
  phone?: string;
}

interface ImportOptions {
  skipErrors: boolean;
  onDuplicateAction: 'skip' | 'update' | 'reactivate';
}

// POST /api/hr/teachers/import/execute - ดำเนินการ import จริง
export async function POST(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'ไม่ได้รับอนุญาต', 401);
    }

    const body = await request.json();
    const { rows, options } = body as {
      rows: ImportRow[];
      options: ImportOptions;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'ไม่มีข้อมูลที่จะ import',
        400
      );
    }

    const results = {
      success: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ row: number; message: string }>,
    };

    // Get existing teachers by citizen ID
    const allCitizenIds = rows.map((r) => r.citizenId.replace(/[-\s]/g, ''));
    const existingTeachers = await prisma.teacher.findMany({
      where: {
        citizenId: { in: allCitizenIds },
      },
    });

    const existingByCitizenId = new Map(
      existingTeachers.map((t) => [t.citizenId, t])
    );

    // Process each row
    for (const row of rows) {
      try {
        const cleanCitizenId = row.citizenId.replace(/[-\s]/g, '');
        const existing = existingByCitizenId.get(cleanCitizenId);

        if (existing) {
          // Handle duplicate
          if (options.onDuplicateAction === 'skip') {
            results.skipped++;
            continue;
          } else if (options.onDuplicateAction === 'update') {
            // Update existing teacher
            await prisma.teacher.update({
              where: { id: existing.id },
              data: {
                teacherCode: row.teacherCode?.trim() || existing.teacherCode,
                title: row.title.trim(),
                firstName: row.firstName.trim(),
                lastName: row.lastName.trim(),
                position: row.position.trim(),
                department: row.department?.trim() || null,
                phone: row.phone?.trim() || null,
              },
            });
            results.updated++;
          } else if (options.onDuplicateAction === 'reactivate') {
            // Reactivate and update
            await prisma.teacher.update({
              where: { id: existing.id },
              data: {
                teacherCode: row.teacherCode?.trim() || existing.teacherCode,
                title: row.title.trim(),
                firstName: row.firstName.trim(),
                lastName: row.lastName.trim(),
                position: row.position.trim(),
                department: row.department?.trim() || null,
                phone: row.phone?.trim() || null,
                isActive: true,
              },
            });
            results.updated++;
          }
        } else {
          // Create new teacher
          let finalTeacherCode = row.teacherCode?.trim();

          if (!finalTeacherCode) {
            // Generate teacher code
            const lastTeacher = await prisma.teacher.findFirst({
              where: { teacherCode: { startsWith: 'T-' } },
              orderBy: { teacherCode: 'desc' },
            });

            if (lastTeacher) {
              const lastNum = parseInt(
                lastTeacher.teacherCode.split('-')[1] || '0'
              );
              finalTeacherCode = `T-${String(lastNum + 1).padStart(4, '0')}`;
            } else {
              finalTeacherCode = 'T-0001';
            }
          }

          // Parse birthDate (handle both Buddhist and Gregorian years)
          let birthDate = new Date(row.birthDate);
          if (birthDate.getFullYear() > 2400) {
            // Buddhist year - convert to Gregorian
            birthDate = new Date(
              birthDate.getFullYear() - 543,
              birthDate.getMonth(),
              birthDate.getDate()
            );
          }

          await prisma.teacher.create({
            data: {
              teacherCode: finalTeacherCode,
              title: row.title.trim(),
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              citizenId: cleanCitizenId,
              birthDate,
              position: row.position.trim(),
              department: row.department?.trim() || null,
              phone: row.phone?.trim() || null,
              isActive: true,
            },
          });
          results.success++;
        }
      } catch (error: any) {
        if (options.skipErrors) {
          results.failed++;
          results.errors.push({
            row: row.row,
            message: error.message || 'เกิดข้อผิดพลาด',
          });
        } else {
          throw error;
        }
      }
    }

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: AuditActions.IMPORT_TEACHERS,
      resource: AuditResources.TEACHERS,
      details: {
        totalRows: rows.length,
        success: results.success,
        updated: results.updated,
        skipped: results.skipped,
        failed: results.failed,
        onDuplicateAction: options.onDuplicateAction,
        skipErrors: options.skipErrors,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      message: 'Import สำเร็จ',
      results,
    });
  } catch (error: any) {
    console.error('Failed to execute import:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      error.message || 'ไม่สามารถ import ข้อมูลได้',
      500,
      error
    );
  }
}
