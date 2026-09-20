'use client';

import { useRouter } from 'next/navigation';
import {
  Users,
  Calendar,
  FileText,
  PenSquare,
  BarChart3,
  HardDrive,
  Settings,
  Shield,
  UserPlus,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';

interface HrMenuClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
}

interface MenuItem {
  icon: any;
  label: string;
  description: string;
  href: string;
  color: string;
  adminOnly?: boolean;
}

export default function HrMenuClient({ hrUser }: HrMenuClientProps) {
  const router = useRouter();

  const menuItems: MenuItem[] = [
    {
      icon: UserPlus,
      label: 'ยื่นใบลาแทนครู',
      description: 'ยื่นใบลาให้ครูที่ไม่สะดวกใช้ระบบ',
      href: '/hr/leave/new',
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    },
    {
      icon: Users,
      label: 'จัดการครู',
      description: 'เพิ่ม แก้ไข นำเข้าข้อมูลครู',
      href: '/hr/teachers',
      color: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
    },
    {
      icon: Calendar,
      label: 'วันหยุดราชการ',
      description: 'จัดการวันหยุดราชการประจำปี',
      href: '/hr/holidays',
      color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    },
    {
      icon: PenSquare,
      label: 'ผู้ลงนาม',
      description: 'ตั้งค่าผู้อนุมัติและผู้อนุญาต',
      href: '/hr/signatories',
      color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    },
    {
      icon: BarChart3,
      label: 'รายงาน',
      description: 'รายงานสรุปและสถิติการลา',
      href: '/hr/reports',
      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: HardDrive,
      label: 'จัดการพื้นที่',
      description: 'ดูและจัดการไฟล์แนบ',
      href: '/hr/storage',
      color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    },
    {
      icon: Settings,
      label: 'ตั้งค่าระบบ',
      description: 'ตั้งค่าทั่วไป โควตา ย้อนหลัง',
      href: '/hr/settings',
      color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    },
    {
      icon: Shield,
      label: 'ผู้ดูแลระบบ',
      description: 'จัดการบัญชี Audit log โซนอันตราย',
      href: '/hr/admin',
      color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      adminOnly: true,
    },
  ];

  const handleLogout = async () => {
    const confirmed = confirm('คุณต้องการออกจากระบบหรือไม่?');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/hr/logout', { method: 'POST' });
      if (res.ok) {
        toast.success('ออกจากระบบสำเร็จ');
        router.push('/hr/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
  };

  const visibleMenuItems = menuItems.filter(
    (item) => !item.adminOnly || hrUser.role === 'super_admin'
  );

  return (
    <HrLayoutWrapper hrUser={hrUser}>
      <div className="bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            เมนู
          </h1>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
                {hrUser.firstName.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {hrUser.firstName} {hrUser.lastName}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {hrUser.role === 'super_admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่ HR'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Menu items */}
        <div className="space-y-3 mb-6">
          {visibleMenuItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition-all active:scale-[0.98]"
              >
                <div className={`p-3 ${item.color} rounded-xl flex-shrink-0`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                    {item.label}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors active:scale-[0.98]"
        >
          <LogOut className="w-5 h-5" />
          <span>ออกจากระบบ</span>
        </button>

        {/* Version info */}
        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>ระบบลาออนไลน์ โรงเรียนบ้านเนินพลับหวาน</p>
          <p className="mt-1">เวอร์ชัน 1.0.0</p>
        </div>
      </main>
      </div>
    </HrLayoutWrapper>
  );
}
