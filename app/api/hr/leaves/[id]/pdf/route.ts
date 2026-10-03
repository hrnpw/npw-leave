import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import {
  renderLeavePdf,
  leaveWithTeacherInclude,
  PdfSettingsMissingError,
} from '@/lib/pdf/generateForLeave';
import { uploadPDFToR2, getR2SignedUrl, extractR2Key } from '@/lib/r2/upload';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const leave = await prisma.leave.findUnique({
      where: { id },
      include: leaveWithTeacherInclude,
    });

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    if (leave.status !== 'approved') {
      return NextResponse.json(
        { error: 'ใบลายังไม่ได้รับการอนุมัติ' },
        { status: 400 }
      );
    }

    // Check if PDF already exists in R2
    if (leave.pdfUrl) {
      try {
        const key = extractR2Key(leave.pdfUrl);
        const signedUrl = await getR2SignedUrl(key);

        // Fetch PDF from R2
        const r2Response = await fetch(signedUrl);

        if (r2Response.ok) {
          const pdfBuffer = await r2Response.arrayBuffer();
          console.log('[PDF] Served from R2 cache');

          // Update printedAt timestamp
          await prisma.leave.update({
            where: { id },
            data: { printedAt: new Date() },
          });

          // Return PDF binary directly
          return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="${leave.leaveNo}.pdf"`,
            },
          });
        } else {
          console.log('[PDF] R2 returned status:', r2Response.status);
        }
      } catch (r2Error) {
        console.error('[PDF] R2 fetch failed, regenerating PDF:', r2Error);
        // Fall through to regenerate PDF
      }
    }

    // PDF not found or R2 error - generate fresh PDF
    const pdfBuffer = await renderLeavePdf(leave);

    // Upload to R2 (non-blocking failure)
    try {
      const pdfUrl = await uploadPDFToR2(leave.leaveNo, leave.fiscalYear, pdfBuffer);

      await prisma.leave.update({
        where: { id },
        data: { printedAt: new Date(), pdfUrl },
      });

      console.log('[PDF] Uploaded to R2:', pdfUrl);
    } catch (uploadError) {
      console.error('[PDF] R2 upload failed (non-blocking):', uploadError);

      // Update printedAt even if upload fails
      await prisma.leave.update({
        where: { id },
        data: { printedAt: new Date() },
      });
    }

    // Return PDF inline
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${leave.leaveNo}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    if (error instanceof PdfSettingsMissingError) {
      return NextResponse.json({ error: 'ไม่พบการตั้งค่าระบบ' }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'ไม่สามารถสร้าง PDF ได้' },
      { status: 500 }
    );
  }
}
