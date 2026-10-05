'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { clearClientCaches } from '@/lib/clearClientCaches';

export default function HrLogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);

      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      await fetch('/api/auth/hr/logout', { method: 'POST' });
      clearClientCaches();
      toast.success('ออกจากระบบสำเร็จ');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
      setLoggingOut(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loggingOut}
      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
      aria-label="ออกจากระบบ"
    >
      <LogOut className="w-4 h-4 text-slate-700 dark:text-slate-300" />
    </button>
  );
}
