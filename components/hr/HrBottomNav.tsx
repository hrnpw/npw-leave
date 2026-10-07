'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardList, ClipboardCheck, FileText, Menu } from 'lucide-react';
import type { LeaveQueueCounts } from './HrLayoutWrapper';

interface HrBottomNavProps {
  counts: LeaveQueueCounts;
}

export default function HrBottomNav({ counts }: HrBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/hr/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      iconColor: 'text-blue-500',
      active: pathname === '/hr/dashboard',
    },
    {
      href: '/hr/reviews',
      label: 'รอตรวจสอบ',
      icon: ClipboardList,
      iconColor: 'text-orange-500',
      active: pathname === '/hr/reviews',
      badge: counts.pending > 0 ? counts.pending : undefined,
    },
    {
      href: '/hr/approvals',
      label: 'รออนุมัติ',
      icon: ClipboardCheck,
      iconColor: 'text-sky-500',
      active: pathname === '/hr/approvals',
      badge: counts.reviewed > 0 ? counts.reviewed : undefined,
    },
    {
      href: '/hr/leaves',
      label: 'ใบลา',
      icon: FileText,
      iconColor: 'text-green-500',
      active: pathname === '/hr/leaves',
    },
    {
      href: '/hr/menu',
      label: 'เพิ่มเติม',
      icon: Menu,
      iconColor: 'text-indigo-500',
      active: pathname.startsWith('/hr/menu') ||
             pathname.startsWith('/hr/teachers') ||
             pathname.startsWith('/hr/holidays') ||
             pathname.startsWith('/hr/signatories') ||
             pathname.startsWith('/hr/reports') ||
             pathname.startsWith('/hr/storage') ||
             pathname.startsWith('/hr/settings') ||
             pathname.startsWith('/hr/admin'),
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-30 pb-safe">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-1 relative transition-colors
                ${
                  item.active
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }
              `}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.iconColor}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-sky-600 dark:bg-sky-400 rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
