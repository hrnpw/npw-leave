import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { exportToExcel, createExcelResponse } from '@/lib/excel/export';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const formatType = searchParams.get('format');

    const leaves = await prisma.leave.findMany({
      where: {
        submittedByType: 'hr',
      },
      include: {
        teacher: {
          select: {
            teacherCode: true,
            title: true,
            firstName: true,
            lastName: true,
          },
        },
        submittedByHr: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const report = leaves.map((leave) => ({
      leaveNo: leave.leaveNo,
      teacherCode: leave.teacher.teacherCode,
      teacherName: `${leave.teacher.title}${leave.teacher.firstName} ${leave.teacher.lastName}`,
      hrName: leave.submittedByHr
        ? `${leave.submittedByHr.firstName} ${leave.submittedByHr.lastName}`
        : '-',
      proxyReason: leave.proxyReason || '-',
      proxyNote: leave.proxyNote || '-',
      createdAt: leave.createdAt.toISOString(),
      type: leave.type,
      startDate: leave.startDate.toISOString(),
      endDate: leave.endDate.toISOString(),
      daysWorking: leave.daysWorking,
      status: leave.status,
    }));

    if (formatType === 'excel') {
      const excelData = report.map((r) => ({
        เลขที่ใบลา: r.leaveNo,
        รหัสครู: r.teacherCode,
        ชื่อครู: r.teacherName,
        'HR ผู้ยื่น': r.hrName,
        เหตุผลที่ยื่นแทน: r.proxyReason,
        หมายเหตุ: r.proxyNote,
        วันที่ยื่น: format(new Date(r.createdAt), 'd MMM yyyy HH:mm', {
          locale: th,
        }),
        ประเภท: r.type,
        วันเริ่ม: format(new Date(r.startDate), 'd MMM yyyy', { locale: th }),
        วันสิ้นสุด: format(new Date(r.endDate), 'd MMM yyyy', { locale: th }),
        วันทำการ: r.daysWorking,
        สถานะ: r.status,
      }));

      const buffer = exportToExcel(
        excelData,
        'leaves-proxy.xlsx',
        'รายงานใบลาที่ยื่นแทน'
      );

      return createExcelResponse(buffer, 'leaves-proxy.xlsx');
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Failed to generate proxy report:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
