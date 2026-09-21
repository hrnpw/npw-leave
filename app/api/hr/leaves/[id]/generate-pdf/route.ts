import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateLeavePDF, calculateLeaveStats } from '@/lib/pdf/generator';
import { uploadPDFToR2, getR2SignedUrl, extractR2Key } from '@/lib/r2/upload';
import { getHrSession } from '@/lib/getSession';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * Background PDF Generation Endpoint
 * Fire-and-forget from approve API
 * Requires HR authentication or internal API key
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication: Check HR session OR internal API key
    const apiKey = request.headers.get('x-internal-api-key');
    const hasValidApiKey = apiKey && apiKey === process.env.INTERNAL_API_KEY;

    if (!hasValidApiKey) {
      const session = await getHrSession();
      if (!session?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { id: leaveId } = await params;

    console.log('[GENERATE-PDF] Starting background PDF generation for leave:', leaveId);

    // Fetch leave with full details
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        teacher: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
      },
    });

    if (!leave) {
      console.error('[GENERATE-PDF] Leave not found:', leaveId);
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    if (leave.status !== 'approved') {
      console.error('[GENERATE-PDF] Leave not approved:', leaveId);
      return NextResponse.json({ error: 'ใบลายังไม่ได้รับการอนุมัติ' }, { status: 400 });
    }

    // Get settings
    const settings = await prisma.settings.findFirst();
    if (!settings) {
      console.error('[GENERATE-PDF] Settings not found');
      return NextResponse.json({ error: 'ไม่พบการตั้งค่าระบบ' }, { status: 500 });
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

    console.log('[GENERATE-PDF] Previous leave data:', {
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
        console.error('[GENERATE-PDF] Error reading signature:', error);
      }
    }

    // Generate PDF
    console.log('[GENERATE-PDF] Generating PDF...');
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

    // Upload to R2
    try {
      const pdfUrl = await uploadPDFToR2(leave.leaveNo, leave.fiscalYear, pdfBuffer);

      // Update leave with pdfUrl (don't update printedAt yet - only when user actually prints)
      await prisma.leave.update({
        where: { id: leaveId },
        data: { pdfUrl },
      });

      console.log('[GENERATE-PDF] Success! PDF uploaded to R2:', pdfUrl);

      return NextResponse.json({
        success: true,
        pdfUrl,
        leaveNo: leave.leaveNo,
      });
    } catch (uploadError) {
      console.error('[GENERATE-PDF] Failed to upload to R2:', uploadError);
      return NextResponse.json(
        { error: 'ไม่สามารถอัปโหลด PDF ได้' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[GENERATE-PDF] Error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้าง PDF' },
      { status: 500 }
    );
  }
}
