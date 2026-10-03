import { prisma } from '@/lib/prisma';

interface FindOverlapParams {
  teacherId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  excludeLeaveId?: string;
}

// Any shared day counts as an overlap, including two half-day leaves on the
// same date (morning + afternoon is not allowed).
export async function findOverlappingLeaves({
  teacherId,
  startDate,
  endDate,
  excludeLeaveId,
}: FindOverlapParams) {
  // UTC midnight avoids timezone shifting the stored date
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T00:00:00.000Z');

  return prisma.leave.findMany({
    where: {
      teacherId,
      status: { in: ['pending', 'reviewed', 'approved'] },
      ...(excludeLeaveId && { id: { not: excludeLeaveId } }),
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: {
      id: true,
      leaveNo: true,
      type: true,
      startDate: true,
      endDate: true,
      status: true,
      isHalfDay: true,
      halfDayPeriod: true,
    },
  });
}
