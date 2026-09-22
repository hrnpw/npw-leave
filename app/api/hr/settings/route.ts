import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit/logger';
import { shortCacheHeaders } from '@/lib/cacheHeaders';

// GET /api/hr/settings - ดึงการตั้งค่าทั้งหมด
export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    // Mask Telegram token สำหรับ HR ธรรมดา
    const response = {
      ...settings,
      telegramBotToken:
        session.role === 'super_admin' && settings.telegramBotToken
          ? settings.telegramBotToken
          : settings.telegramBotToken
          ? '••••••••••' + settings.telegramBotToken.slice(-4)
          : null,
    };

    return NextResponse.json(response, {
      headers: shortCacheHeaders,
    });
  } catch (error) {
    console.error('GET /api/hr/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/hr/settings - อัปเดตการตั้งค่า
export async function PATCH(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      schoolName,
      systemStartDate,
      backdateLimitDays,
      hrBackdateLimitDays,
      quotaSickPersonal,
      quotaMaternity,
      quotaReligious,
      requireTeacherSignature,
      currentDirectorId,
      currentHrHeadId,
      telegramBotToken,
      telegramChatId,
    } = body;

    // ตรวจสอบสิทธิ์ตามตาราง 2.3
    const superAdminOnlyFields = [
      'quotaSickPersonal',
      'quotaMaternity',
      'quotaReligious',
      'requireTeacherSignature',
      'systemStartDate',
      'telegramBotToken',
      'telegramChatId',
    ];

    const requestedFields = Object.keys(body);
    const hasSuperAdminField = requestedFields.some((field) =>
      superAdminOnlyFields.includes(field)
    );

    if (hasSuperAdminField && session.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Super admin only' },
        { status: 403 }
      );
    }

    // ดึงค่าเก่าสำหรับ audit log
    const oldSettings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    // Validate
    if (quotaSickPersonal !== undefined && (quotaSickPersonal < 1 || quotaSickPersonal > 365)) {
      return NextResponse.json(
        { error: 'โควตาลาป่วย/กิจต้องอยู่ระหว่าง 1-365 วัน' },
        { status: 400 }
      );
    }

    if (quotaMaternity !== undefined && (quotaMaternity < 1 || quotaMaternity > 365)) {
      return NextResponse.json(
        { error: 'โควตาลาคลอดต้องอยู่ระหว่าง 1-365 วัน' },
        { status: 400 }
      );
    }

    if (quotaReligious !== undefined && (quotaReligious < 1 || quotaReligious > 365)) {
      return NextResponse.json(
        { error: 'โควตาลาทางศาสนาต้องอยู่ระหว่าง 1-365 วัน' },
        { status: 400 }
      );
    }

    if (backdateLimitDays !== undefined && (backdateLimitDays < 0 || backdateLimitDays > 90)) {
      return NextResponse.json(
        { error: 'ระยะย้อนหลัง (ครู) ต้องอยู่ระหว่าง 0-90 วัน' },
        { status: 400 }
      );
    }

    if (
      hrBackdateLimitDays !== undefined &&
      (hrBackdateLimitDays < 0 || hrBackdateLimitDays > 90)
    ) {
      return NextResponse.json(
        { error: 'ระยะย้อนหลัง (HR) ต้องอยู่ระหว่าง 0-90 วัน' },
        { status: 400 }
      );
    }

    // Validate signatories exist
    if (currentDirectorId) {
      const director = await prisma.signatory.findFirst({
        where: { id: currentDirectorId, role: 'director', isActive: true },
      });
      if (!director) {
        return NextResponse.json(
          { error: 'ไม่พบผู้อนุมัติที่เลือก' },
          { status: 400 }
        );
      }
    }

    if (currentHrHeadId) {
      const hrHead = await prisma.signatory.findFirst({
        where: { id: currentHrHeadId, role: 'hr_head', isActive: true },
      });
      if (!hrHead) {
        return NextResponse.json(
          { error: 'ไม่พบหัวหน้าฝ่ายบุคคลที่เลือก' },
          { status: 400 }
        );
      }
    }

    // Validate systemStartDate ห้ามอนาคต
    if (systemStartDate) {
      const startDate = new Date(systemStartDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDate > today) {
        return NextResponse.json(
          { error: 'วันที่เริ่มระบบต้องไม่เกินวันนี้' },
          { status: 400 }
        );
      }
    }

    // Update
    const updateData: any = {};
    if (schoolName !== undefined) updateData.schoolName = schoolName;
    if (systemStartDate !== undefined) updateData.systemStartDate = new Date(systemStartDate);
    if (backdateLimitDays !== undefined) updateData.backdateLimitDays = backdateLimitDays;
    if (hrBackdateLimitDays !== undefined)
      updateData.hrBackdateLimitDays = hrBackdateLimitDays;
    if (quotaSickPersonal !== undefined) updateData.quotaSickPersonal = quotaSickPersonal;
    if (quotaMaternity !== undefined) updateData.quotaMaternity = quotaMaternity;
    if (quotaReligious !== undefined) updateData.quotaReligious = quotaReligious;
    if (requireTeacherSignature !== undefined)
      updateData.requireTeacherSignature = requireTeacherSignature;
    if (currentDirectorId !== undefined) updateData.currentDirectorId = currentDirectorId;
    if (currentHrHeadId !== undefined) updateData.currentHrHeadId = currentHrHeadId;
    if (telegramBotToken !== undefined) updateData.telegramBotToken = telegramBotToken;
    if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId;

    const updated = await prisma.settings.update({
      where: { id: 'singleton' },
      data: updateData,
    });

    // Audit log - บันทึกแบบละเอียด before/after
    const changedFields = Object.keys(updateData).map((field) => ({
      field,
      before: oldSettings?.[field as keyof typeof oldSettings],
      after: updateData[field],
    }));

    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'UPDATE_SETTINGS',
      resource: 'settings',
      resourceId: 'singleton',
      details: {
        changes: changedFields,
        role: session.role,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/hr/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
