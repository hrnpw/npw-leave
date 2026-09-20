import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

// GET /api/hr/signatories - ดึงรายการผู้ลงนามทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const signatories = await prisma.signatory.findMany({
      orderBy: [
        { isActive: 'desc' },
        { role: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ signatories });
  } catch (error) {
    console.error('Failed to fetch signatories:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลผู้ลงนามได้' },
      { status: 500 }
    );
  }
}

// POST /api/hr/signatories - สร้างผู้ลงนามใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const body = await request.json();
    const { role, title, firstName, lastName, position, signatureUrl } = body;

    // Validate required fields
    if (!role || !['director', 'hr_head'].includes(role)) {
      return NextResponse.json(
        { error: 'กรุณาระบุบทบาท (director หรือ hr_head)' },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกคำนำหน้า' },
        { status: 400 }
      );
    }

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อและนามสกุล' },
        { status: 400 }
      );
    }

    if (!position?.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกตำแหน่ง' },
        { status: 400 }
      );
    }

    const signatory = await prisma.signatory.create({
      data: {
        role,
        title: title.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        position: position.trim(),
        signatureUrl: signatureUrl?.trim() || null,
        isActive: true,
      },
    });

    // TODO: Log audit log

    return NextResponse.json({ signatory }, { status: 201 });
  } catch (error) {
    console.error('Failed to create signatory:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถสร้างผู้ลงนามได้' },
      { status: 500 }
    );
  }
}
