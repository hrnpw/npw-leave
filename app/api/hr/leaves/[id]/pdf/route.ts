import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { generateLeavePDF, calculateLeaveStats } from '@/lib/pdf/generator';
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

    // Fetch leave with full details
    const leave = await prisma.leave.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            teacherCode: true,
            position: true,
            department: true,
          },
        },
      },
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
    const settings = await prisma.settings.findFirst();
    if (!settings) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่าระบบ' },
        { status: 500 }
      );
    }

    // Calculate leave statistics
    const leaveDayStats = await calculateLeaveStats(
      leave.teacherId,
      leave.fiscalYear,
      leave.type,
      leave.id,
      leave.leaveNo
    );

    // Determine current round based on leave start date
    const leaveMonth = leave.startDate.getMonth();
    const isCurrentRound1 = leaveMonth >= 9 || leaveMonth <= 2; // Oct-Mar

    // Find previous leave (any type) in same fiscal year and round
    const previousLeave = await prisma.leave.findFirst({
      where: {
        teacherId: leave.teacherId,
        status: 'approved',
        fiscalYear: leave.fiscalYear,
        id: { not: leave.id },
        createdAt: { lt: leave.createdAt },
      },
      orderBy: { createdAt: 'desc' },
      select: { startDate: true, endDate: true },
    });

    // Filter by round after fetching (since round is not stored in DB)
    let filteredPreviousLeave = previousLeave;
    if (previousLeave) {
      const prevMonth = previousLeave.startDate.getMonth();
      const isPrevRound1 = prevMonth >= 9 || prevMonth <= 2;
      if (isPrevRound1 !== isCurrentRound1) {
        filteredPreviousLeave = null;
      }
    }

    console.log('[PDF] Previous leave data:', {
      found: !!previousLeave,
      filtered: !!filteredPreviousLeave,
      currentRound: isCurrentRound1 ? 'Round1' : 'Round2',
      fiscalYear: leave.fiscalYear,
      data: filteredPreviousLeave
    });

    // Read signature from R2 if exists
    let teacherSignatureDataUrl: string | undefined;
    if (leave.teacherSignatureUrl) {
      try {
        const key = extractR2Key(leave.teacherSignatureUrl);
        const signedUrl = await getR2SignedUrl(key);
        const response = await fetch(signedUrl);

        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          teacherSignatureDataUrl = `data:image/png;base64,${base64}`;
        }
      } catch (error) {
        console.error('[PDF] Error reading signature:', error);
      }
    }

    // Generate PDF
    const pdfBuffer = await generateLeavePDF(
      {
        leaveNo: leave.leaveNo,
        fiscalYear: leave.fiscalYear,
        teacher: {
          title: leave.teacher.title,
          firstName: leave.teacher.firstName,
          lastName: leave.teacher.lastName,
          position: leave.teacher.position,
        },
        type: leave.type,
        customTypeName: leave.customTypeName || undefined,
        startDate: leave.startDate,
        endDate: leave.endDate,
        period: leave.halfDayPeriod,
        daysWorking: leave.daysWorking,
        reason: leave.reason,
        contactAddress: leave.contactAddress,
        contactPhone: leave.contactPhone || undefined,
        teacherSignatureUrl: teacherSignatureDataUrl,
        approvedAt: leave.approvedAt,
        isApproved: true,
        approverNameSnapshot: leave.approverNameSnapshot,
        approverPositionSnapshot: leave.approverPositionSnapshot,
        directorNameSnapshot: leave.directorNameSnapshot,
        directorPositionSnapshot: leave.directorPositionSnapshot,
        previousLeave: filteredPreviousLeave || undefined,
        leaveDayStats,
      },
      { schoolName: settings.schoolName, schoolAddress: '' }
    );

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
    return NextResponse.json(
      { error: 'ไม่สามารถสร้าง PDF ได้' },
      { status: 500 }
    );
  }
}
