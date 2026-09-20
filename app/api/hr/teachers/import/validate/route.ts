import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

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

interface ValidationResult {
  valid: ImportRow[];
  errors: Array<{ row: number; message: string; rows?: number[] }>;
  warnings: Array<{
    row: number;
    type: 'duplicate_in_system' | 'inactive_teacher';
    message: string;
    existingTeacher?: any;
  }>;
}

// POST /api/hr/teachers/import/validate - ตรวจสอบข้อมูลก่อน import
export async function POST(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const body = await request.json();
    const { rows } = body as { rows: ImportRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'ไม่มีข้อมูลที่จะ import' },
        { status: 400 }
      );
    }

    if (rows.length > 500) {
      return NextResponse.json(
        { error: 'จำกัดไม่เกิน 500 แถวต่อครั้ง' },
        { status: 400 }
      );
    }

    const result: ValidationResult = {
      valid: [],
      errors: [],
      warnings: [],
    };

    const citizenIdMap = new Map<string, number[]>(); // citizenId -> [row numbers]
    const teacherCodeMap = new Map<string, number[]>(); // teacherCode -> [row numbers]

    // Phase 1: Validate format and check duplicates within file
    for (const row of rows) {
      const cleanCitizenId = row.citizenId.replace(/[-\s]/g, '');

      // Required fields
      if (!row.title?.trim()) {
        result.errors.push({ row: row.row, message: 'ไม่มีคำนำหน้า' });
        continue;
      }
      if (!row.firstName?.trim()) {
        result.errors.push({ row: row.row, message: 'ไม่มีชื่อ' });
        continue;
      }
      if (!row.lastName?.trim()) {
        result.errors.push({ row: row.row, message: 'ไม่มีนามสกุล' });
        continue;
      }
      if (!row.position?.trim()) {
        result.errors.push({ row: row.row, message: 'ไม่มีตำแหน่ง' });
        continue;
      }

      // Validate citizen ID format
      if (!/^\d{13}$/.test(cleanCitizenId)) {
        result.errors.push({
          row: row.row,
          message: 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก',
        });
        continue;
      }

      // Validate citizen ID checksum
      if (!validateCitizenId(cleanCitizenId)) {
        result.errors.push({
          row: row.row,
          message: 'เลขบัตรประชาชนไม่ถูกต้อง (checksum ผิด)',
        });
        continue;
      }

      // Validate birthDate
      if (!row.birthDate || !isValidDate(row.birthDate)) {
        result.errors.push({
          row: row.row,
          message: 'วันเกิดไม่ถูกต้อง',
        });
        continue;
      }

      // Track citizen ID duplicates in file
      if (citizenIdMap.has(cleanCitizenId)) {
        citizenIdMap.get(cleanCitizenId)!.push(row.row);
      } else {
        citizenIdMap.set(cleanCitizenId, [row.row]);
      }

      // Track teacher code duplicates in file (if provided)
      if (row.teacherCode?.trim()) {
        const code = row.teacherCode.trim();
        if (teacherCodeMap.has(code)) {
          teacherCodeMap.get(code)!.push(row.row);
        } else {
          teacherCodeMap.set(code, [row.row]);
        }
      }
    }

    // Check for duplicates within file
    for (const [citizenId, rowNumbers] of citizenIdMap.entries()) {
      if (rowNumbers.length > 1) {
        // All rows with this citizen ID are errors
        for (const rowNum of rowNumbers) {
          const otherRows = rowNumbers.filter((r) => r !== rowNum);
          result.errors.push({
            row: rowNum,
            message: `เลขบัตรประชาชนซ้ำกับแถว ${otherRows.join(', ')}`,
            rows: otherRows,
          });
        }
      }
    }

    for (const [code, rowNumbers] of teacherCodeMap.entries()) {
      if (rowNumbers.length > 1) {
        for (const rowNum of rowNumbers) {
          const otherRows = rowNumbers.filter((r) => r !== rowNum);
          result.errors.push({
            row: rowNum,
            message: `รหัสครูซ้ำกับแถว ${otherRows.join(', ')}`,
            rows: otherRows,
          });
        }
      }
    }

    // Collect all clean citizen IDs and teacher codes for batch DB check
    const validCitizenIds = Array.from(citizenIdMap.keys()).filter(
      (id) => citizenIdMap.get(id)!.length === 1
    );
    const validTeacherCodes = Array.from(teacherCodeMap.keys()).filter(
      (code) => teacherCodeMap.get(code)!.length === 1
    );

    // Phase 2: Check against database
    const existingByCitizen = await prisma.teacher.findMany({
      where: {
        citizenId: { in: validCitizenIds },
      },
      select: {
        id: true,
        citizenId: true,
        teacherCode: true,
        title: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    const existingByCode = await prisma.teacher.findMany({
      where: {
        teacherCode: { in: validTeacherCodes },
      },
      select: {
        id: true,
        teacherCode: true,
        citizenId: true,
        title: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    const citizenIdToTeacher = new Map(
      existingByCitizen.map((t) => [t.citizenId, t])
    );
    const codeToTeacher = new Map(
      existingByCode.map((t) => [t.teacherCode, t])
    );

    // Build final validation result
    for (const row of rows) {
      const cleanCitizenId = row.citizenId.replace(/[-\s]/g, '');

      // Skip rows that already have errors
      if (result.errors.some((e) => e.row === row.row)) {
        continue;
      }

      let hasWarning = false;

      // Check citizen ID in system
      if (citizenIdToTeacher.has(cleanCitizenId)) {
        const existing = citizenIdToTeacher.get(cleanCitizenId)!;
        result.warnings.push({
          row: row.row,
          type: existing.isActive ? 'duplicate_in_system' : 'inactive_teacher',
          message: existing.isActive
            ? `เลขบัตรประชาชนมีในระบบแล้ว (${existing.teacherCode})`
            : `เลขบัตรประชาชนตรงกับครูที่ปิดใช้งาน (${existing.teacherCode})`,
          existingTeacher: existing,
        });
        hasWarning = true;
      }

      // Check teacher code in system (if provided)
      if (row.teacherCode?.trim() && codeToTeacher.has(row.teacherCode.trim())) {
        const existing = codeToTeacher.get(row.teacherCode.trim())!;
        if (existing.citizenId !== cleanCitizenId) {
          result.warnings.push({
            row: row.row,
            type: 'duplicate_in_system',
            message: `รหัสครูมีในระบบแล้ว (${existing.title}${existing.firstName} ${existing.lastName})`,
            existingTeacher: existing,
          });
          hasWarning = true;
        }
      }

      // If no errors or warnings, mark as valid
      if (!hasWarning) {
        result.valid.push(row);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to validate import:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถตรวจสอบข้อมูลได้' },
      { status: 500 }
    );
  }
}

function validateCitizenId(id: string): boolean {
  if (id.length !== 13) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id[i]) * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(id[12]);
}

function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}
