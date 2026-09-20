import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit/logger';

// POST /api/hr/admin/danger/reset-fiscal-counter - รีเซ็ตเลขรันนิ่ง (super admin เท่านั้น)
export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { fiscalYear, confirmation } = body;

    if (!fiscalYear) {
      return NextResponse.json(
        { error: 'กรุณาระบุปีงบประมาณ' },
        { status: 400 }
      );
    }

    // ต้องพิมพ์ "ยืนยันรีเซ็ต" ตรงตัว
    if (confirmation !== 'ยืนยันรีเซ็ต') {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อความยืนยันให้ถูกต้อง' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ามีใบลาของปีนี้แล้วหรือไม่
    const existingLeaves = await prisma.leave.count({
      where: { fiscalYear: parseInt(fiscalYear) },
    });

    if (existingLeaves > 0) {
      return NextResponse.json(
        { error: `มีใบลาของปีงบประมาณ ${fiscalYear} อยู่แล้ว ${existingLeaves} ใบ — ไม่สามารถรีเซ็ตได้` },
        { status: 400 }
      );
    }

    // ดึงค่าเก่า
    const oldCounter = await prisma.fiscalCounter.findUnique({
      where: {
        fiscalYear_round: {
          fiscalYear: parseInt(fiscalYear),
          round: 1,
        },
      },
    });

    // รีเซ็ต
    await prisma.fiscalCounter.upsert({
      where: {
        fiscalYear_round: {
          fiscalYear: parseInt(fiscalYear),
          round: 1,
        },
      },
      create: {
        fiscalYear: parseInt(fiscalYear),
        round: 1,
        lastNumber: 0,
      },
      update: {
        lastNumber: 0,
      },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'RESET_FISCAL_COUNTER',
      resource: 'fiscal_counter',
      resourceId: fiscalYear.toString(),
      details: {
        fiscalYear: parseInt(fiscalYear),
        oldValue: oldCounter?.lastNumber || 0,
        newValue: 0,
        executor: session.id,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/hr/admin/danger/reset-fiscal-counter error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
