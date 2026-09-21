import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const format = searchParams.get('format');

    // Filters
    const year = searchParams.get('year');
    const period = searchParams.get('period');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('q');
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');

    // Build where clause
    const where: any = {};

    if (year) where.fiscalYear = parseInt(year);

    // Filter by period using date range
    if (period) {
      const fiscalYearNum = year ? parseInt(year) : new Date().getFullYear() + 543;
      const gregorianYear = fiscalYearNum - 543;

      if (period === '1') {
        // รอบที่ 1: ต.ค. - มี.ค.
        where.startDate = {
          gte: new Date(gregorianYear - 1, 9, 1), // Oct 1
          lte: new Date(gregorianYear, 2, 31), // Mar 31
        };
      } else if (period === '2') {
        // รอบที่ 2: เม.ย. - ก.ย.
        where.startDate = {
          gte: new Date(gregorianYear, 3, 1), // Apr 1
          lte: new Date(gregorianYear, 8, 30), // Sep 30
        };
      }
    }

    if (type) where.type = type;

    if (status === 'pending') where.status = 'pending';
    else if (status === 'approved') where.status = 'approved';
    else if (status === 'rejected') where.status = 'rejected';

    if (search) {
      where.OR = [
        { leaveNo: { contains: search } },
        { teacher: { firstName: { contains: search } } },
        { teacher: { lastName: { contains: search } } },
      ];
    }

    if (dateFrom || dateTo) {
      where.startDate = {};
      if (dateFrom) where.startDate.gte = new Date(dateFrom);
      if (dateTo) where.startDate.lte = new Date(dateTo);
    }

    // Fetch data
    const [leaves, total] = await Promise.all([
      prisma.leave.findMany({
        where,
        select: {
          id: true,
          leaveNo: true,
          fiscalYear: true,
          type: true,
          customTypeName: true,
          startDate: true,
          endDate: true,
          halfDayPeriod: true,
          daysWorking: true,
          status: true,
          approverNameSnapshot: true,
          createdAt: true,
          teacher: {
            select: {
              title: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: format ? 0 : (page - 1) * limit,
        take: format ? undefined : limit,
      }),
      prisma.leave.count({ where }),
    ]);

    // Export format
    if (format === 'excel' || format === 'csv') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('ใบลาทั้งหมด');

      worksheet.columns = [
        { header: 'เลขที่', key: 'leaveNo', width: 15 },
        { header: 'ชื่อ-สกุล', key: 'name', width: 25 },
        { header: 'ประเภท', key: 'type', width: 15 },
        { header: 'วันที่เริ่ม', key: 'startDate', width: 15 },
        { header: 'วันที่สิ้นสุด', key: 'endDate', width: 15 },
        { header: 'จำนวนวัน', key: 'days', width: 12 },
        { header: 'สถานะ', key: 'status', width: 12 },
        { header: 'ผู้อนุมัติ', key: 'approver', width: 25 },
      ];

      leaves.forEach(leave => {
        worksheet.addRow({
          leaveNo: leave.leaveNo,
          name: `${leave.teacher.title}${leave.teacher.firstName} ${leave.teacher.lastName}`,
          type: leave.type === 'sick' ? 'ลาป่วย' : leave.type === 'personal' ? 'ลากิจ' : leave.type === 'maternity' ? 'ลาคลอด' : 'ลาอุปสมบท',
          startDate: leave.startDate.toLocaleDateString('th-TH'),
          endDate: leave.endDate.toLocaleDateString('th-TH'),
          days: leave.daysWorking,
          status: leave.status === 'pending' ? 'รออนุมัติ' : leave.status === 'approved' ? 'อนุมัติแล้ว' : leave.status === 'rejected' ? 'ไม่อนุมัติ' : 'ยกเลิก',
          approver: leave.approverNameSnapshot || '-',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `all-leaves-${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`;

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON response
    return NextResponse.json({
      leaves: leaves.map(leave => ({
        id: leave.id,
        leaveNo: leave.leaveNo,
        fiscalYear: leave.fiscalYear,
        teacher: leave.teacher,
        type: leave.type,
        customTypeName: leave.customTypeName,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        period: leave.halfDayPeriod,
        daysWorking: leave.daysWorking,
        status: leave.status,
        approverNameSnapshot: leave.approverNameSnapshot,
        createdAt: leave.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Failed to fetch all leaves:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

