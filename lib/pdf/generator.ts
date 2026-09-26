import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { generateLeaveFormHTML } from './template';
import { prisma } from '@/lib/prisma';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const isDev = process.env.NODE_ENV !== 'production' || !process.env.VERCEL;

interface LeaveData {
  leaveNo: string;
  fiscalYear: number;
  teacher: {
    title: string;
    firstName: string;
    lastName: string;
    position: string | null;
  };
  type: string;
  customTypeName?: string;
  startDate: Date;
  endDate: Date;
  period?: 'morning' | 'afternoon' | null;
  daysWorking: number;
  reason: string;
  contactAddress: string;
  contactPhone?: string;
  teacherSignatureUrl?: string | null;
  approvedAt?: Date | null;
  isApproved?: boolean | null;
  approverNameSnapshot?: string | null;
  approverPositionSnapshot?: string | null;
  approverComment?: string | null;
  reviewerNameSnapshot?: string | null;
  reviewerPositionSnapshot?: string | null;
  reviewerComment?: string | null;
  directorNameSnapshot?: string | null;
  directorPositionSnapshot?: string | null;
  previousLeave?: {
    startDate: Date;
    endDate: Date;
  } | null;
  leaveDayStats: {
    round1: {
      sick: { times: number; days: number };
      personal: { times: number; days: number };
      maternity: { times: number; days: number };
      religious: { times: number; days: number };
    };
    round2: {
      sick: { times: number; days: number };
      personal: { times: number; days: number };
      maternity: { times: number; days: number };
      religious: { times: number; days: number };
    };
  };
}

interface Settings {
  schoolName: string;
  schoolAddress?: string;
}

function getMonthRange(
  fiscalYear: number,
  round: 'round1' | 'round2'
): { startMonth: number; endMonth: number; startYear: number; endYear: number } {
  // fiscalYear เป็น พ.ศ. ต้องแปลงเป็น ค.ศ.
  const gregorianYear = fiscalYear - 543;

  if (round === 'round1') {
    // รอบ 1 = 1 ต.ค. – 31 มี.ค.
    // ปีงบประมาณ 2570 (พ.ศ.) = ปีงบประมาณ 2027 (ค.ศ.)
    // รอบ 1 = 1 ต.ค. 2026 - 31 มี.ค. 2027
    return {
      startMonth: 10,
      startYear: gregorianYear - 1,
      endMonth: 3,
      endYear: gregorianYear,
    };
  } else {
    // รอบ 2 = 1 เม.ย. – 30 ก.ย.
    // รอบ 2 = 1 เม.ย. 2027 - 30 ก.ย. 2027
    return {
      startMonth: 4,
      startYear: gregorianYear,
      endMonth: 9,
      endYear: gregorianYear,
    };
  }
}

export async function calculateLeaveStats(
  teacherId: string,
  fiscalYear: number,
  leaveType: string,
  excludeLeaveId?: string,
  currentLeaveNo?: string | null
): Promise<LeaveData['leaveDayStats']> {
  const stats: LeaveData['leaveDayStats'] = {
    round1: {
      sick: { times: 0, days: 0 },
      personal: { times: 0, days: 0 },
      maternity: { times: 0, days: 0 },
      religious: { times: 0, days: 0 },
    },
    round2: {
      sick: { times: 0, days: 0 },
      personal: { times: 0, days: 0 },
      maternity: { times: 0, days: 0 },
      religious: { times: 0, days: 0 },
    },
  };

  const whereConditions: any = {
    teacherId,
    fiscalYear,
    status: 'approved',
    type: { in: ['sick', 'personal', 'maternity', 'religious'] },
  };

  if (excludeLeaveId) {
    whereConditions.id = { not: excludeLeaveId };
  }

  if (currentLeaveNo) {
    whereConditions.leaveNo = { lt: currentLeaveNo };
  }

  const approvedLeaves = await prisma.leave.findMany({
    where: whereConditions,
    include: {
      leaveDays: true,
    },
    orderBy: {
      leaveNo: 'asc',
    },
  });

  console.log('=== calculateLeaveStats DEBUG ===');
  console.log('teacherId:', teacherId);
  console.log('fiscalYear:', fiscalYear);
  console.log('excludeLeaveId:', excludeLeaveId);
  console.log('approvedLeaves count:', approvedLeaves.length);
  console.log('approvedLeaves:', approvedLeaves.map(l => ({
    id: l.id,
    type: l.type,
    startDate: l.startDate,
    endDate: l.endDate,
    leaveDaysCount: l.leaveDays.length,
    workingDays: l.leaveDays.filter(d => d.isWorkingDay).length
  })));

  // Count by round and type
  for (const leave of approvedLeaves) {
    const type = leave.type as 'sick' | 'personal' | 'maternity' | 'religious';

    // Skip if not one of the main 4 types
    if (!['sick', 'personal', 'maternity', 'religious'].includes(type)) {
      continue;
    }

    for (const round of ['round1', 'round2'] as const) {
      const range = getMonthRange(fiscalYear, round);
      const roundStart = new Date(range.startYear, range.startMonth - 1, 1);
      const roundEnd = new Date(range.endYear, range.endMonth, 0, 23, 59, 59);

      console.log(`Checking ${round} for leave ${leave.id}:`, {
        roundStart: roundStart.toISOString(),
        roundEnd: roundEnd.toISOString(),
        leaveStart: new Date(leave.startDate).toISOString(),
        leaveEnd: new Date(leave.endDate).toISOString()
      });

      // Check if this leave has any days in this round
      const daysInRound = leave.leaveDays.filter((day) => {
        const dayDate = new Date(day.date);
        const inRange = dayDate >= roundStart && dayDate <= roundEnd;
        const isWorking = day.isWorkingDay;
        if (!isWorking || !inRange) {
          console.log(`  Day ${day.date.toISOString().split('T')[0]}: inRange=${inRange}, isWorking=${isWorking}`);
        }
        return inRange && isWorking;
      });

      console.log(`Days in ${round}:`, daysInRound.length);

      if (daysInRound.length > 0) {
        // Count times: each round counts separately
        // ใบลาที่คร่อม 2 รอบจะนับ 1 ครั้งในแต่ละรอบ
        stats[round][type].times += 1;

        // Count days in this specific round
        stats[round][type].days += daysInRound.length;
      }
    }
  }

  console.log('Final stats:', JSON.stringify(stats, null, 2));

  return stats;
}

export async function generateLeavePDF(
  leave: LeaveData,
  settings: Settings,
  qrCodeDataUrl?: string
): Promise<Buffer> {
  let browser = null;

  try {
    // Read school logo base64
    let schoolLogoBase64: string | undefined;
    try {
      const logoPath = join(process.cwd(), 'public', 'icons', 'logo-npw-PDF.png');
      if (existsSync(logoPath)) {
        const logoBuffer = readFileSync(logoPath);
        schoolLogoBase64 = logoBuffer.toString('base64');
      }
    } catch (err) {
      console.warn('School logo not found, skipping...');
    }

    // Generate HTML
    const html = generateLeaveFormHTML(leave, {
      schoolName: settings.schoolName,
      schoolAddress: settings.schoolAddress || '',
    }, qrCodeDataUrl, schoolLogoBase64);

    // Launch browser
    browser = await puppeteer.launch({
      args: isDev
        ? []
        : await chromium.args,
      defaultViewport: isDev ? { width: 1280, height: 720 } : { width: 1280, height: 720 },
      executablePath: isDev
        ? process.env.CHROME_PATH ||
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    // Set content and wait for fonts to load
    await page.setContent(html, {
      waitUntil: ['domcontentloaded', 'networkidle0'] as any,
    });

    // Wait for fonts to load completely
    await page.evaluateHandle('document.fonts.ready');

	// Add a small delay to ensure fonts are fully rendered
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1.5cm',
        right: '2cm',
        bottom: '1.5cm',
        left: '2cm',
      },
      preferCSSPageSize: false,
    });

    await browser.close();

    return Buffer.from(pdf);
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('Failed to generate PDF:', error);
    throw error;
  }
}