'use client';

import { ReactNode } from 'react';
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
  pendingCount = 0,
}: HrLayoutWrapperProps) {
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
