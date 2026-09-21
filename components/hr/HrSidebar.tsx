'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardCheck,
  FileText,
  FilePlus,
  Users,
  Calendar,
  FileSignature,
  BarChart3,
  HardDrive,
  Settings,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface HrSidebarProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
  pendingCount?: number;
}

export default function HrSidebar({ hrUser, pendingCount: initialCount = 0 }: HrSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(initialCount);

  // Fetch pending count on mount and every 60 seconds
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await fetch('/api/hr/leaves/pendingCount');
        if (res.ok) {
          const data = await res.json();
          setPendingCount(data.count || 0);
        }
      } catch (error) {
        // Silent fail - don't disturb UX
        console.error('Failed to fetch pending count:', error);
      }
    };

    // Fetch immediately
    fetchPendingCount();

    // Fetch every 60 seconds
    const interval = setInterval(fetchPendingCount, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/hr/logout', { method: 'POST' });
      toast.success('ออกจากระบบสำเร็จ');
      router.push('/hr/login');
    } catch (error) {
      toast.error('ไม่สามารถออกจากระบบได้');
    }
  };

  const navSections = [
    {
      label: 'หลัก',
      items: [
        {
          href: '/hr/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          iconColor: 'text-blue-500',
          active: pathname === '/hr/dashboard',
        },
        {
          href: '/hr/approvals',
          label: 'รออนุมัติ',
          icon: ClipboardCheck,
          iconColor: 'text-orange-500',
          active: pathname === '/hr/approvals',
          badge: pendingCount,
        },
        {
          href: '/hr/leaves',
          label: 'ใบลาทั้งหมด',
          icon: FileText,
          iconColor: 'text-green-500',
          active: pathname.startsWith('/hr/leaves'),
        },
        {
          href: '/hr/leave/new',
          label: 'ยื่นใบลาแทนครู',
          icon: FilePlus,
          iconColor: 'text-purple-500',
          active: pathname === '/hr/leave/new',
        },
      ],
    },
    {
      label: 'จัดการข้อมูล',
      items: [
        {
          href: '/hr/teachers',
          label: 'จัดการครู',
          icon: Users,
          iconColor: 'text-cyan-500',
          active: pathname.startsWith('/hr/teachers'),
        },
        {
          href: '/hr/holidays',
          label: 'วันหยุดราชการ',
          icon: Calendar,
          iconColor: 'text-pink-500',
          active: pathname === '/hr/holidays',
        },
        {
          href: '/hr/signatories',
          label: 'ผู้ลงนาม',
          icon: FileSignature,
          iconColor: 'text-indigo-500',
          active: pathname === '/hr/signatories',
        },
      ],
    },
    {
      label: 'ระบบ',
      items: [
        {
          href: '/hr/reports',
          label: 'รายงาน',
          icon: BarChart3,
          iconColor: 'text-emerald-500',
          active: pathname === '/hr/reports',
        },
        {
          href: '/hr/storage',
          label: 'พื้นที่จัดเก็บ',
          icon: HardDrive,
          iconColor: 'text-amber-500',
          active: pathname === '/hr/storage',
        },
        {
          href: '/hr/settings',
          label: 'ตั้งค่า',
          icon: Settings,
          iconColor: 'text-slate-500',
          active: pathname === '/hr/settings',
        },
      ],
    },
  ];

  if (hrUser.role === 'super_admin') {
    navSections.push({
      label: 'ผู้ดูแลระบบ',
      items: [
        {
          href: '/hr/admin',
          label: 'Admin Zone',
          icon: Shield,
          iconColor: 'text-purple-500',
          active: pathname.startsWith('/hr/admin'),
        },
      ],
    });
  }

  return (
    <aside
      className={`
        hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-white dark:bg-slate-900
        border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-40
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {hrUser.firstName} {hrUser.lastName}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {hrUser.role === 'super_admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่ HR'}
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title={collapsed ? 'ขยาย' : 'ย่อ'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-6">
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {section.label}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative
                      ${
                        item.active
                          ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className="relative">
                      <Icon className={`w-5 h-5 shrink-0 ${(item as any).iconColor || ''}`} />
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse-fast">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                    )}
                    {item.active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sky-600 dark:bg-sky-400 rounded-r-full" />
                    )}

                    {/* Tooltip for collapsed state */}
                    {collapsed && (
                      <span className="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
            text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
            transition-colors
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'ออกจากระบบ' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">ออกจากระบบ</span>}
        </button>
      </div>

      {/* Version */}
      {!collapsed && (
        <div className="px-4 py-2 text-center text-xs text-slate-400 dark:text-slate-600">
          v1.0.0-beta
        </div>
      )}
    </aside>
  );
}
