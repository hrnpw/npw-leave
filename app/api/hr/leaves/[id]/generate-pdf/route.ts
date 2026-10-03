import { NextRequest, NextResponse } from 'next/server';
import {
  generateAndStoreLeavePdf,
  LeaveNotFoundError,
  LeaveNotApprovedError,
  PdfSettingsMissingError,
} from '@/lib/pdf/generateForLeave';
import { getHrSession } from '@/lib/getSession';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * Manual/background PDF generation endpoint for an approved leave.
 * Requires HR authentication or internal API key.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = request.headers.get('x-internal-api-key');
    const hasValidApiKey = apiKey && apiKey === process.env.INTERNAL_API_KEY;

    if (!hasValidApiKey) {
      const session = await getHrSession();
      if (!session?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { id: leaveId } = await params;
    const pdfUrl = await generateAndStoreLeavePdf(leaveId);

    return NextResponse.json({ success: true, pdfUrl });
  } catch (error) {
    console.error('[GENERATE-PDF] Error:', error);
    if (error instanceof LeaveNotFoundError) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }
    if (error instanceof LeaveNotApprovedError) {
      return NextResponse.json({ error: 'ใบลายังไม่ได้รับการอนุมัติ' }, { status: 400 });
    }
    if (error instanceof PdfSettingsMissingError) {
      return NextResponse.json({ error: 'ไม่พบการตั้งค่าระบบ' }, { status: 500 });
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้าง PDF' }, { status: 500 });
  }
}
