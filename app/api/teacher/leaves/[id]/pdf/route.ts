import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getR2SignedUrl, extractR2Key } from '@/lib/r2/upload';

export const maxDuration = 60;
export const runtime = 'nodejs';

function pdfResponse(buffer: Uint8Array, leaveNo: string) {
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${leaveNo}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

// ครูเปิดดู PDF ใบลาของตัวเอง (เฉพาะที่อนุมัติและ HR พิมพ์แล้ว)
// อ่านไฟล์จาก R2 อย่างเดียว ไม่สร้าง PDF ใหม่ และไม่แตะ printedAt
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const leave = await prisma.leave.findUnique({ where: { id } });

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    if (leave.teacherId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (leave.status !== 'approved') {
      return NextResponse.json(
        { error: 'ใบลายังไม่ได้รับการอนุมัติ' },
        { status: 400 }
      );
    }

    // ครูดูได้เฉพาะไฟล์ที่ HR สั่งพิมพ์แล้วและเก็บไว้ใน R2 เท่านั้น ไม่สร้างใหม่ให้
    if (!leave.printedAt || !leave.pdfUrl) {
      return NextResponse.json(
        { error: 'ใบลายังไม่ได้พิมพ์ กรุณารอเจ้าหน้าที่ HR ดำเนินการ' },
        { status: 404 }
      );
    }

    try {
      const signedUrl = await getR2SignedUrl(extractR2Key(leave.pdfUrl));
      const r2Response = await fetch(signedUrl);
      if (!r2Response.ok) throw new Error(`R2 returned status ${r2Response.status}`);
      return pdfResponse(new Uint8Array(await r2Response.arrayBuffer()), leave.leaveNo);
    } catch (r2Error) {
      console.error('[Teacher PDF] R2 fetch failed:', r2Error);
      return NextResponse.json(
        { error: 'ไม่สามารถเปิดไฟล์ใบลาได้ในขณะนี้ กรุณาลองใหม่ภายหลัง' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Failed to serve teacher PDF:', error);
    return NextResponse.json({ error: 'ไม่สามารถเปิดไฟล์ใบลาได้' }, { status: 500 });
  }
}
