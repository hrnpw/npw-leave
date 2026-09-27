'use client';

import { ReactNode, useState, useEffect } from 'react';
import HrSidebar from './HrSidebar';
import HrBottomNav from './HrBottomNav';
import { SessionWarning } from '@/components/SessionWarning';

interface HrLayoutWrapperProps {
  children: ReactNode;
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
    createdAt?: number;
  };
  pendingCount?: number;
}

export default function HrLayoutWrapper({
  children,
  hrUser,
  pendingCount: initialCount,
}: HrLayoutWrapperProps) {
  const [pendingCount, setPendingCount] = useState(initialCount ?? 0);
  const shouldFetch = initialCount === undefined;

  // Sync with prop changes
  useEffect(() => {
    if (initialCount !== undefined) {
      setPendingCount(initialCount);
    }
  }, [initialCount]);

  // Fetch pending count only if not provided by parent
  useEffect(() => {
    if (!shouldFetch) return;

    const fetchPendingCount = async () => {
      try {
        const res = await fetch('/api/hr/leaves/pendingCount');
        if (res.ok) {
          const data = await res.json();
          setPendingCount(data.count || 0);
        }
      } catch (error) {
        console.error('Failed to fetch pending count:', error);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 60000);

    return () => clearInterval(interval);
  }, [shouldFetch]);

  return (
    <>
      {hrUser.createdAt && (
        <SessionWarning sessionType="hr" sessionCreatedAt={hrUser.createdAt} />
      )}

      {/* Sidebar for desktop */}
      <HrSidebar hrUser={hrUser} pendingCount={pendingCount} />

      {/* Main content - offset by sidebar on desktop */}
      <div className="lg:pl-64">{children}</div>

      {/* Bottom nav for mobile */}
      <HrBottomNav pendingCount={pendingCount} />
    </>
  );
}
