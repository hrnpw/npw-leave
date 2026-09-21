import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { createExcelResponse } from '@/lib/excel/export';
import { createAuditLog } from '@/lib/audit/logger';

// GET /api/hr/admin/danger/export-full-database - Export ฐานข้อมูลทั้งหมด (super admin เท่านั้น)
export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ดึงข้อมูลทั้งหมด
    const [teachers, hrUsers, leaves, attachments, holidays, signatories, settings] =
      await Promise.all([
        prisma.teacher.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.hrUser.findMany({
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.leave.findMany({
          include: {
            teacher: true,
            submittedByHr: {
              select: { username: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.attachment.findMany({ orderBy: { uploadedAt: 'desc' } }),
        prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
        prisma.signatory.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.settings.findUnique({ where: { id: 'singleton' } }),
      ]);

    // สร้าง workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Teachers
    const teachersData = teachers.map((t) => ({
      รหัสครู: t.teacherCode,
      คำนำหน้า: t.title,
      ชื่อ: t.firstName,
      นามสกุล: t.lastName,
      เลขบัตรประชาชน: t.citizenId,
      วันเกิด: t.birthDate.toISOString().split('T')[0],
      ตำแหน่ง: t.position,
      กลุ่มสาระ: t.department || '',
      เบอร์โทร: t.phone || '',
      สถานะ: t.isActive ? 'ใช้งาน' : 'ปิดใช้งาน',
      วันที่สร้าง: t.createdAt.toISOString(),
    }));
    const ws1 = XLSX.utils.json_to_sheet(teachersData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Teachers');

    // Sheet 2: HR Users (ไม่แสดง password hash)
    const hrUsersData = hrUsers.map((u) => ({
      Username: u.username,
      ชื่อ: u.firstName,
      นามสกุล: u.lastName,
      บทบาท: u.role,
      สถานะ: u.isActive ? 'ใช้งาน' : 'ปิดใช้งาน',
      เข้าสู่ระบบล่าสุด: u.lastLoginAt?.toISOString() || '',
      วันที่สร้าง: u.createdAt.toISOString(),
    }));
    const ws2 = XLSX.utils.json_to_sheet(hrUsersData);
    XLSX.utils.book_append_sheet(wb, ws2, 'HR Users');

    // Sheet 3: Leaves
    const leavesData = leaves.map((l) => ({
      เลขที่: l.leaveNo,
      ปีงบประมาณ: l.fiscalYear,
      เลขรันนิ่ง: l.runningNo,
      ครู: `${l.teacher.firstName} ${l.teacher.lastName}`,
      รหัสครู: l.teacher.teacherCode,
      ประเภท: l.type,
      ชื่อประเภทอื่นๆ: l.customTypeName || '',
      วันที่เริ่ม: l.startDate.toISOString().split('T')[0],
      วันที่สิ้นสุด: l.endDate.toISOString().split('T')[0],
      ครึ่งวัน: l.isHalfDay ? 'ใช่' : 'ไม่',
      ช่วง: l.halfDayPeriod || '',
      จำนวนวันทำการ: l.daysWorking,
      จำนวนวันปฏิทิน: l.daysCalendar,
      เหตุผล: l.reason,
      ที่อยู่ติดต่อ: l.contactAddress,
      สถานะ: l.status,
      เหตุผลปฏิเสธ: l.rejectionReason || '',
      ยื่นโดย: l.submittedByType,
      'HR ผู้ยื่นแทน': l.submittedByHr
        ? `${l.submittedByHr.firstName} ${l.submittedByHr.lastName}`
        : '',
      เหตุผลยื่นแทน: l.proxyReason || '',
      หมายเหตุยื่นแทน: l.proxyNote || '',
      วันที่อนุมัติ: l.approvedAt?.toISOString() || '',
      วันที่พิมพ์: l.printedAt?.toISOString() || '',
      วันที่ยื่น: l.createdAt.toISOString(),
    }));
    const ws3 = XLSX.utils.json_to_sheet(leavesData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Leaves');

    // Sheet 4: Attachments
    const attachmentsData = attachments.map((a) => ({
      LeaveID: a.leaveId,
      ชื่อไฟล์: a.fileName,
      ขนาด: a.fileSize,
      ประเภท: a.mimeType,
      BlobURL: a.blobUrl,
      วันที่อัปโหลด: a.uploadedAt.toISOString(),
    }));
    const ws4 = XLSX.utils.json_to_sheet(attachmentsData);
    XLSX.utils.book_append_sheet(wb, ws4, 'Attachments');

    // Sheet 5: Holidays
    const holidaysData = holidays.map((h) => ({
      วันที่: h.date.toISOString().split('T')[0],
      ชื่อวันหยุด: h.name,
      ปี: h.year,
      วันที่สร้าง: h.createdAt.toISOString(),
    }));
    const ws5 = XLSX.utils.json_to_sheet(holidaysData);
    XLSX.utils.book_append_sheet(wb, ws5, 'Holidays');

    // Sheet 6: Signatories
    const signatoriesData = signatories.map((s) => ({
      บทบาท: s.role,
      คำนำหน้า: s.title,
      ชื่อ: s.firstName,
      นามสกุล: s.lastName,
      ตำแหน่ง: s.position,
      มีลายเซ็น: s.signatureUrl ? 'ใช่' : 'ไม่',
      สถานะ: s.isActive ? 'ใช้งาน' : 'ปิดใช้งาน',
      วันที่สร้าง: s.createdAt.toISOString(),
    }));
    const ws6 = XLSX.utils.json_to_sheet(signatoriesData);
    XLSX.utils.book_append_sheet(wb, ws6, 'Signatories');

    // Sheet 7: Settings
    const settingsData = [
      {
        ชื่อโรงเรียน: settings?.schoolName || '',
        วันที่เริ่มระบบ: settings?.systemStartDate.toISOString().split('T')[0] || '',
        'ย้อนหลัง(ครู)': settings?.backdateLimitDays || 0,
        'ย้อนหลัง(HR)': settings?.hrBackdateLimitDays || 0,
        'โควตาป่วย/กิจ': settings?.quotaSickPersonal || 0,
        โควตาคลอด: settings?.quotaMaternity || 0,
        โควตาศาสนา: settings?.quotaReligious || 0,
        'Telegram Token': settings?.telegramBotToken ? '(ซ่อน)' : '',
        'Telegram Chat ID': settings?.telegramChatId || '',
        อัปเดตล่าสุด: settings?.updatedAt.toISOString() || '',
      },
    ];
    const ws7 = XLSX.utils.json_to_sheet(settingsData);
    XLSX.utils.book_append_sheet(wb, ws7, 'Settings');

    // Generate Excel
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'EXPORT_FULL_DATABASE',
      resource: 'system',
      resourceId: undefined,
      details: {
        tables: ['teachers', 'hr_users', 'leaves', 'attachments', 'holidays', 'signatories', 'settings'],
        recordCounts: {
          teachers: teachers.length,
          hrUsers: hrUsers.length,
          leaves: leaves.length,
          attachments: attachments.length,
          holidays: holidays.length,
          signatories: signatories.length,
        },
        executor: session.id,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    const timestamp = new Date().toISOString().split('T')[0];
    return createExcelResponse(
      excelBuffer,
      `ระบบลา_สำรองข้อมูล_${timestamp}.xlsx`
    );
  } catch (error) {
    console.error('GET /api/hr/admin/danger/export-full-database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
