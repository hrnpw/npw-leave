import { format, differenceInCalendarDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { readFileSync } from 'fs';
import { join } from 'path';

// Cache fonts to avoid re-reading on every PDF generation
let cachedFontRegular: string | null = null;
let cachedFontBold: string | null = null;

function getBase64Font(fontName: 'regular' | 'bold'): string {
  if (fontName === 'regular') {
    if (!cachedFontRegular) {
      const fontPath = join(process.cwd(), 'public', 'fonts', 'THSarabunNew.ttf');
      const fontBuffer = readFileSync(fontPath);
      cachedFontRegular = fontBuffer.toString('base64');
    }
    return cachedFontRegular;
  } else {
    if (!cachedFontBold) {
      const fontPath = join(process.cwd(), 'public', 'fonts', 'THSarabunNew Bold.ttf');
      const fontBuffer = readFileSync(fontPath);
      cachedFontBold = fontBuffer.toString('base64');
    }
    return cachedFontBold;
  }
}

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
  schoolAddress: string;
}

type LeaveTypeKey = 'sick' | 'personal' | 'maternity' | 'religious';

const LEAVE_TYPE_NAMES: Record<string, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจส่วนตัว',
  maternity: 'ลาคลอดบุตร',
  religious: 'ลาอุปสมบท',
};

const LEAVE_TYPE_ORDER: LeaveTypeKey[] = ['sick', 'personal', 'maternity', 'religious'];

function formatThaiDate(date: Date): string {
  return format(date, 'd MMMM yyyy', { locale: th })
    .replace(/\d{4}/, (year: string) => String(parseInt(year, 10) + 543));
}

function getLeaveTypeName(type: string, customTypeName?: string): string {
  if (customTypeName) return customTypeName;
  return LEAVE_TYPE_NAMES[type] || type;
}

function getPeriodText(period?: 'morning' | 'afternoon' | null): string {
  if (!period) return '';
  return period === 'morning' ? ' (ครึ่งเช้า)' : ' (ครึ่งบ่าย)';
}

function isRound1(date: Date): boolean {
  const month = date.getMonth();
  return month >= 9 || month <= 2;
}

function isRound2(date: Date): boolean {
  return !isRound1(date);
}

function checkbox(checked: boolean): string {
  return `<span class="checkbox ${checked ? 'checked' : ''}"></span>`;
}

function dots(value: string, minWidth = 50): string {
  return `<span class="dots" style="min-width:${minWidth}px;">${value}</span>`;
}

export function generateLeaveFormHTML(
  leave: LeaveData,
  settings: Settings,
  qrCodeDataUrl?: string,
  schoolLogoBase64?: string
): string {
  const leaveType = getLeaveTypeName(leave.type, leave.customTypeName);
  const periodText = getPeriodText(leave.period);
  const submittedDate = formatThaiDate(new Date());
  const startDateText = formatThaiDate(leave.startDate);
  const endDateText = formatThaiDate(leave.endDate);

  const previousLeaveStartText = leave.previousLeave ? formatThaiDate(leave.previousLeave.startDate) : '';
  const previousLeaveEndText = leave.previousLeave ? formatThaiDate(leave.previousLeave.endDate) : '';
  const previousLeaveDays = leave.previousLeave
    ? differenceInCalendarDays(leave.previousLeave.endDate, leave.previousLeave.startDate) + 1
    : null;

  const currentRound = isRound1(leave.startDate) ? 'round1' : 'round2';

  const statsRows = LEAVE_TYPE_ORDER.map((key) => {
    const roundStats = leave.leaveDayStats[currentRound][key] || { times: 0, days: 0 };
    const before = {
      times: roundStats.times,
      days: roundStats.days
    };
    const isThisType = leave.type === key;
    const thisTimeTimes = isThisType ? 1 : 0;
    const thisTimeDays = isThisType ? leave.daysWorking : 0;
    const totalTimes = before.times + thisTimeTimes;
    const totalDays = before.days + thisTimeDays;
    return `
      <tr>
        <td class="stats-label">${LEAVE_TYPE_NAMES[key]}</td>
        <td>${thisTimeTimes || ''}</td>
        <td>${thisTimeDays || ''}</td>
        <td>${before.times || ''}</td>
        <td>${before.days || ''}</td>
        <td>${totalTimes || ''}</td>
        <td>${totalDays || ''}</td>
      </tr>`;
  }).join('');

  const approverComment = leave.approverComment || '';
  const approverName = leave.approverNameSnapshot || '';
  const approverPosition = leave.approverPositionSnapshot || '';
  const directorName = leave.directorNameSnapshot || '';
  const directorPosition = leave.directorPositionSnapshot || '';

  // Get base64 fonts
  const fontRegular = getBase64Font('regular');
  const fontBold = getBase64Font('bold');

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบลา ${leave.leaveNo}</title>
  <style>
    @font-face {
      font-family: 'TH Sarabun New';
      src: url('data:font/truetype;charset=utf-8;base64,${fontRegular}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'TH Sarabun New';
      src: url('data:font/truetype;charset=utf-8;base64,${fontBold}') format('truetype');
      font-weight: bold;
      font-style: normal;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'TH Sarabun New', sans-serif;
      font-size: 16pt;
      line-height: 1.15;
      padding: 0;
      color: #000;
      background: #fff;
      position: relative;
    }

    .content-wrapper {
      padding-top: 90px;
    }

    .leave-no {
      position: absolute;
      top: 0;
      right: 0;
      font-size: 12pt;
      color: #444;
    }

    .school-logo {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      max-width: 80px;
      max-height: 80px;
    }

    .title {
      text-align: center;
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .right-line {
      text-align: right;
      margin-bottom: 4px;
    }

    .field {
      margin-bottom: 4px;
    }

    .indent {
      margin-left: 50px;
    }

    .dots {
      border-bottom: 1px dotted #000;
      display: inline-block;
      min-width: 50px;
      padding: 0 4px 0px 4px;
      text-align: center;
      vertical-align: baseline;
      line-height: 0.85;
    }

    .checkbox {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 1px solid #000;
      margin-right: 4px;
      vertical-align: middle;
      position: relative;
    }

    .checkbox.checked::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 1px;
      width: 4px;
      height: 8px;
      border: solid #000;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    .leave-type-list .option {
      display: block;
      margin: 3px 0 3px 45px;
    }

    .two-col {
      display: flex;
      gap: 24px;
      margin-top: 10px;
      align-items: flex-start;
    }

    .col-left {
      flex: 0 0 50%;
    }

    .col-right {
      flex: 1;
    }

    .fiscal-box {
      margin-bottom: 6px;
    }

    .fiscal-box .option {
      display: block;
      margin: 3px 0;
    }

    .stats-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14pt;
      margin-bottom: 8px;
    }

    .stats-table th,
    .stats-table td {
      border: 1px solid #000;
      padding: 4px 4px;
      text-align: center;
    }

    .stats-table th {
      font-weight: normal;
    }

    .stats-label {
      text-align: left !important;
      padding-left: 8px !important;
    }

    .signature-block {
      text-align: center;
	  margin-top: 20px;
      margin-bottom: 10px;
    }

    .signature-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 4px auto 3px auto;
    }

    .signature-label {
      font-size: 16pt;
    }

    .signature-image {
      max-width: 200px;
      max-height: 80px;
    }

    .opinion-box {
      margin-bottom: 8px;
    }

    .opinion-box .heading {
      font-weight: bold;
	  margin-top: 30px;
      margin-bottom: 4px;
    }
	
	.opinion-box-approver .heading {
      font-weight: bold;
      margin-bottom: 4px;
    }
	
	.two-col .col-left .fiscal-box .heading {
      font-weight: bold;
      margin-bottom: 4px;
    }

    .opinion-line {
      border-bottom: 1px dotted #000;
      height: 16px;
      margin-bottom: 10px;
    }

    .approve-row {
      margin-top: 6px;
      margin-bottom: 6px;
      text-align: center;
    }

    .approve-row .option {
      margin-right: 30px;
    }

    .sign-line {
      margin-top: 12px;
      text-align: left;
    }

    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="leave-no">เลขที่ ${leave.leaveNo}</div>
  <div class="content-wrapper">
	${schoolLogoBase64 ? `<img src="data:image/png;base64,${schoolLogoBase64}" alt="โลโก้โรงเรียน" class="school-logo" />` : ''}
    <div class="title">แบบใบลา ลาป่วย ลากิจส่วนตัว ลาคลอด ลาอุปสมบท</div>

    <div class="right-line">เขียนที่ ${dots(settings.schoolName,180)}</div>
    <div class="right-line">วันที่ ${dots(submittedDate, 180)}</div>

  <div class="field">เรื่อง  ${leaveType}</div>
  <div class="field">เรียน ผู้อำนวยการ${settings.schoolName}</div>

  <div class="field indent">
    ข้าพเจ้า ${dots(`${leave.teacher.title}${leave.teacher.firstName} ${leave.teacher.lastName}`, 240)}
    ตำแหน่ง ${dots(leave.teacher.position || '', 200)}
  </div>
  <div class="field">
    สังกัด ${dots(settings.schoolName, 300)}  ขออนุญาตลา
  </div>

  <div class="leave-type-list">
    <div class="option">
      ${checkbox(leave.type === 'sick')} ลาป่วย เนื่องจาก ${dots(leave.type === 'sick' ? leave.reason : '', 360)}
    </div>
    <div class="option">
      ${checkbox(leave.type === 'personal')} ลากิจส่วนตัว เนื่องจาก ${dots(leave.type === 'personal' ? leave.reason : '', 330)}
    </div>
    <div class="option">
      ${checkbox(leave.type === 'maternity')} ลาคลอดบุตร
    </div>
    <div class="option">
      ${checkbox(leave.type === 'religious')} ลาอุปสมบท
    </div>
  </div>

  <div class="field">
    ตั้งแต่วันที่ ${dots(startDateText, 185)}
    ถึงวันที่ ${dots(endDateText, 145)}
    มีกำหนด ${dots(String(leave.daysWorking), 50)} วัน${periodText}
  </div>

  <div class="field">
    ข้าพเจ้าได้
    ${checkbox(leave.type === 'sick')} ลาป่วย
    ${checkbox(leave.type === 'personal')} ลากิจส่วนตัว
    ${checkbox(leave.type === 'maternity')} คลอดบุตร
    ${checkbox(leave.type === 'religious')} ลาอุปสมบท
  </div>

  <div class="field">
    ครั้งสุดท้ายเมื่อวันที่ ${dots(previousLeaveStartText, 135)}
    ถึงวันที่ ${dots(previousLeaveEndText, 145)}
    มีกำหนด ${dots(previousLeaveDays !== null ? String(previousLeaveDays) : '', 50)} วัน
  </div>

  <div class="field">
    ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ ${dots(leave.contactAddress, 410)}
  </div>

  <div class="field">
    เบอร์โทรศัพท์สามารถติดต่อได้ระหว่างลา ${dots(leave.contactPhone || '', 245)}
  </div>

  <div class="two-col">
    <div class="col-left">
      <div class="fiscal-box">
        <div class="heading">ปีงบประมาณ ${leave.fiscalYear}</div>
        <div class="option">${checkbox(isRound1(leave.startDate))} 1 ต.ค. – 31 มี.ค.</div>
        <div class="option">${checkbox(isRound2(leave.startDate))} 1 เม.ย. – 30 ก.ย.</div>
      </div>

      <table class="stats-table">
        <tr>
          <th rowspan="2">ประเภท</th>
          <th colspan="2">ลาครั้งนี้</th>
          <th colspan="2">ลาครั้งที่แล้ว</th>
          <th colspan="2">รวม</th>
        </tr>
        <tr>
          <th>ครั้ง</th><th>วัน</th>
          <th>ครั้ง</th><th>วัน</th>
          <th>ครั้ง</th><th>วัน</th>
        </tr>
        ${statsRows}
      </table>

      <!-- ความเห็นฝ่ายบุคคล ย้ายมาต่อใต้ตารางสถิติเพื่อดันขึ้นทันที -->
      <div class="opinion-box-approver" style="margin-top: 8px;">
		<div class="heading">ความเห็นของหัวหน้าฝ่ายบุคคล</div>
		<div class="opinion-line">${leave.approverComment || ''}</div>
		<div class="opinion-line"></div>
      </div>

      <!-- ลายเซ็นหัวหน้าฝ่ายบุคคล -->
      <div class="signature-block" style="margin-top: 10px;">
        <div style="text-align: left; margin-top: 25px; margin-left: 20px;">ลงชื่อ</div>
        <div style="text-align: center;">( ${dots(approverName, 200)} )</div>
        <div style="text-align: center;">ตำแหน่ง ${approverPosition || 'ครู'}</div>
      </div>
    </div>

    <div class="col-right">
      <div class="signature-block">
        <div>ขอแสดงความนับถือ</div>
        ${leave.teacherSignatureUrl
          ? `<div class="signature-wrapper" style="margin-right: 45px;">
              <span class="signature-label">ลงชื่อ</span>
              <img src="${leave.teacherSignatureUrl}" alt="ลายเซ็นครู" class="signature-image" />
            </div>`
          : '<div class="sign-line">ลงชื่อ</div>'
        }
        <div>( ${dots(`${leave.teacher.title}${leave.teacher.firstName} ${leave.teacher.lastName}`, 200)} )</div>
      </div>

      <div class="opinion-box">
        <div class="heading">ความเห็นผู้บังคับบัญชา</div>
        <div class="opinion-line">${approverComment}</div>
        <div class="opinion-line"></div>
		<div class="opinion-line"></div>
        <div class="approve-row">
          <span class="option">${checkbox(false)} อนุญาต</span>
          <span class="option">${checkbox(false)} ไม่อนุญาต</span>
        </div>
      </div>

      <!-- ลายเซ็นผู้อำนวยการ -->
      <div class="signature-block" style="margin-top: 10px;">
        <div style="text-align: left; margin-top: 60px; margin-left: 10px;">ลงชื่อ</div>
        <div style="text-align: center;">( ${dots(directorName, 200)} )</div>
        <div style="text-align: center;">ตำแหน่ง ${directorPosition || `ผู้อำนวยการ${settings.schoolName}`}</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>
  `.trim();
}