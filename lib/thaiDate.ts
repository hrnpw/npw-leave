import { format } from 'date-fns';
import { th } from 'date-fns/locale';

/**
 * Format date to Thai Buddhist year
 */
export function formatThaiDate(date: Date, formatStr: string = 'dd MMMM yyyy'): string {
  const buddhistYear = date.getFullYear() + 543;
  const formatted = format(date, formatStr, { locale: th });

  // Replace Gregorian year with Buddhist year
  return formatted.replace(date.getFullYear().toString(), buddhistYear.toString());
}

/**
 * Get Thai day of week name
 */
export function getThaiDayName(date: Date, short: boolean = false): string {
  const days = short
    ? ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
    : ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  return days[date.getDay()];
}

/**
 * Get Thai month name
 */
export function getThaiMonthName(date: Date, short: boolean = false): string {
  const months = short
    ? ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    : ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
       'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  return months[date.getMonth()];
}

/**
 * Format full Thai date: "วันจันทร์ที่ 7 กันยายน พ.ศ. 2569"
 */
export function formatFullThaiDate(date: Date): string {
  const dayName = getThaiDayName(date);
  const day = date.getDate();
  const monthName = getThaiMonthName(date);
  const buddhistYear = date.getFullYear() + 543;

  return `วัน${dayName}ที่ ${day} ${monthName} พ.ศ. ${buddhistYear}`;
}

/**
 * Get greeting based on time of day
 */
export function getThaiGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return 'สวัสดีตอนเช้า';
  if (hour < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

/**
 * Convert Gregorian year to Buddhist year
 */
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

/**
 * Convert Buddhist year to Gregorian year
 */
export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear - 543;
}

/**
 * Format short Thai date: "7 ก.ย. 2569"
 */
export function formatThaiDateShort(date: Date): string {
  const day = date.getDate();
  const monthName = getThaiMonthName(date, true);
  const buddhistYear = date.getFullYear() + 543;

  return `${day} ${monthName} ${buddhistYear}`;
}
