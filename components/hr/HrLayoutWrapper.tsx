'use client';

import { ReactNode, useState, useEffect } from 'react';
import HrSidebar from './HrSidebar';
import HrBottomNav from './HrBottomNav';
import { SessionWarning } from '@/components/SessionWarning';
import type { HrRole } from '@/lib/roles';
import { PENDING_COUNT_CHANGED_EVENT } from './leaveReview/api';

export interface LeaveQueueCounts {
  pending: number; // รอ HR ตรวจ
  reviewed: number; // รอ ผอ. อนุมัติ
}

interface HrLayoutWrapperProps {
  children: ReactNode;
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: HrRole;
    createdAt?: number;
  };
}

export default function HrLayoutWrapper({ children, hrUser }: HrLayoutWrapperProps) {
  const [counts, setCounts] = useState<LeaveQueueCounts>({ pending: 0, reviewed: 0 });

  // โหลดยอด badge ทุก 60 วินาที และทุกครั้งที่มีการเปลี่ยนสถานะใบลาในหน้านี้
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/hr/leaves/pendingCount');
        if (res.ok) {
          const data = await res.json();
          setCounts({ pending: data.pending || 0, reviewed: data.reviewed || 0 });
        }
      } catch (error) {
        console.error('Failed to fetch pending count:', error);
      }
    };

    const fetchWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchCounts();
    };

    fetchCounts();
    const interval = setInterval(fetchWhenVisible, 60000);
    window.addEventListener(PENDING_COUNT_CHANGED_EVENT, fetchCounts);
    document.addEventListener('visibilitychange', fetchWhenVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener(PENDING_COUNT_CHANGED_EVENT, fetchCounts);
      document.removeEventListener('visibilitychange', fetchWhenVisible);
    };
  }, []);

  return (
    <>
      {hrUser.createdAt && (
        <SessionWarning sessionType="hr" sessionCreatedAt={hrUser.createdAt} />
      )}

      {/* Sidebar for desktop */}
      <HrSidebar hrUser={hrUser} counts={counts} />

      {/* Main content - offset by sidebar on desktop */}
      <div className="lg:pl-64">{children}</div>

      {/* Bottom nav for mobile */}
      <HrBottomNav counts={counts} />
    </>
  );
}
