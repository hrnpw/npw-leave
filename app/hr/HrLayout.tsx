'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateSession = async () => {
      try {
        const response = await fetch('/api/auth/hr/validate', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          // Session invalid, redirect to login
          router.replace('/hr/login');
          return;
        }

        setIsValidating(false);
      } catch (error) {
        console.error('Session validation error:', error);
        router.replace('/hr/login');
      }
    };

    validateSession();
  }, [router]);

  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">กำลังตรวจสอบ...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
