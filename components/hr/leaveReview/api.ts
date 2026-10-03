import { toast } from 'sonner';
import type { ReviewLeave } from './types';

const NETWORK_ERROR = {
  title: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์',
  description: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง',
};

/** โหลดรายการใบลา คืน null ถ้าโหลดไม่สำเร็จ (แสดง toast ให้แล้ว) */
export async function fetchLeaveList(
  url: string,
  errorTitle: string
): Promise<{ leaves: ReviewLeave[]; total: number } | null> {
  try {
    // ขอทีเดียวทั้งหมด (API default คือ 20 ใบ ซึ่งจะตัดรายการที่เหลือทิ้งเงียบ ๆ)
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}limit=200`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'ไม่สามารถโหลดข้อมูลได้');
    }
    const data = await res.json();
    const leaves = data.leaves as ReviewLeave[];
    return { leaves, total: data.pagination?.total ?? leaves.length };
  } catch (error: any) {
    console.error('Failed to fetch leaves:', error);
    if (error.message === 'Failed to fetch') {
      toast.error(NETWORK_ERROR.title, { description: NETWORK_ERROR.description });
    } else {
      toast.error(errorTitle, { description: 'กรุณาลองอีกครั้ง หรือรีเฟรชหน้าเว็บ' });
    }
    return null;
  }
}

/**
 * POST เปลี่ยนสถานะใบลา คืน true ถ้าสำเร็จ
 * ถ้าไม่สำเร็จจะแสดง toast ด้วยข้อความจาก API (เช่น 409 ใบลาถูกเปลี่ยนสถานะไปแล้ว)
 */
export async function postLeaveAction(
  url: string,
  errorTitle: string,
  body?: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      ...(body
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}),
    });

    if (res.ok) {
      notifyPendingCountChanged();
      return true;
    }

    const error = await res.json().catch(() => ({}));
    toast.error(errorTitle, { description: error.error || 'กรุณาลองอีกครั้ง' });
    return false;
  } catch (error: any) {
    console.error('Leave action error:', error);
    if (error.message === 'Failed to fetch') {
      toast.error(NETWORK_ERROR.title, { description: NETWORK_ERROR.description });
    } else {
      toast.error(errorTitle, { description: error.message || 'กรุณาลองอีกครั้ง' });
    }
    return false;
  }
}

// HrLayoutWrapper ฟัง event นี้เพื่อโหลด badge ใหม่หลังเปลี่ยนสถานะใบลา
export const PENDING_COUNT_CHANGED_EVENT = 'hr:pending-count-changed';

export function notifyPendingCountChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PENDING_COUNT_CHANGED_EVENT));
  }
}

export function vibrate() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10);
  }
}
