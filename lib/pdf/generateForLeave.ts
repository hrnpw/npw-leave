import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateLeavePDF, calculateLeaveStats } from '@/lib/pdf/generator';
import { uploadPDFToR2, getR2SignedUrl, extractR2Key } from '@/lib/r2/upload';

export const leaveWithTeacherInclude = {
  teacher: {
    select: { title: true, firstName: true, lastName: true, position: true },
  },
} satisfies Prisma.LeaveInclude;

export type LeaveWithTeacher = Prisma.LeaveGetPayload<{
  include: typeof leaveWithTeacherInclude;
}>;

export class PdfSettingsMissingError extends Error {
  constructor() {
    super('Settings not found');
  }
}

export class LeaveNotFoundError extends Error {
  constructor(leaveId: string) {
    super(`Leave not found: ${leaveId}`);
  }
}

export class LeaveNotApprovedError extends Error {
  constructor(leaveId: string) {
    super(`Leave not approved: ${leaveId}`);
  }
}

export async function renderLeavePdf(leave: LeaveWithTeacher): Promise<Buffer> {
  const settings = await prisma.settings.findFirst();
  if (!settings) throw new PdfSettingsMissingError();

  const leaveDayStats = await calculateLeaveStats(
    leave.teacherId,
    leave.fiscalYear,
    leave.type,
    leave.id,
    leave.leaveNo
  );

  const isRound1 = (d: Date) => d.getMonth() >= 9 || d.getMonth() <= 2; // Oct-Mar

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
  const sameRoundPrevious =
    previousLeave && isRound1(previousLeave.startDate) === isRound1(leave.startDate)
      ? previousLeave
      : undefined;

  let teacherSignatureDataUrl: string | undefined;
  if (leave.teacherSignatureUrl) {
    try {
      const signedUrl = await getR2SignedUrl(extractR2Key(leave.teacherSignatureUrl));
      const response = await fetch(signedUrl);
      if (response.ok) {
        const base64 = Buffer.from(await response.arrayBuffer()).toString('base64');
        teacherSignatureDataUrl = `data:image/png;base64,${base64}`;
      }
    } catch (error) {
      console.error('[PDF] Error reading signature:', error);
    }
  }

  return generateLeavePDF(
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
      previousLeave: sameRoundPrevious,
      leaveDayStats,
    },
    { schoolName: settings.schoolName, schoolAddress: '' }
  );
}

// gen PDF ของใบลาที่อนุมัติแล้ว อัปโหลดขึ้น R2 และบันทึก pdfUrl (ไม่แตะ printedAt)
export async function generateAndStoreLeavePdf(leaveId: string): Promise<string> {
  const leave = await prisma.leave.findUnique({
    where: { id: leaveId },
    include: leaveWithTeacherInclude,
  });
  if (!leave) throw new LeaveNotFoundError(leaveId);
  if (leave.status !== 'approved') throw new LeaveNotApprovedError(leaveId);

  const pdfBuffer = await renderLeavePdf(leave);
  const pdfUrl = await uploadPDFToR2(leave.leaveNo, leave.fiscalYear, pdfBuffer);
  await prisma.leave.update({ where: { id: leaveId }, data: { pdfUrl } });
  return pdfUrl;
}
