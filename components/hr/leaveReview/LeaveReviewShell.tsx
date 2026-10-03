'use client';

import { ReactNode } from 'react';
import { Check, Eye } from 'lucide-react';

interface LeaveReviewShellProps {
  title: string;
  subtitle: string;
  pullDistance: number;
  isRefreshing: boolean;
  // แสดงแถบ "ดูอย่างเดียว" ใต้หัวข้อ
  readOnlyNote?: string;
  // แท็บหรือส่วนเสริมใต้หัวข้อ
  headerExtra?: ReactNode;
  loading: boolean;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  children: ReactNode;
}

export default function LeaveReviewShell({
  title,
  subtitle,
  pullDistance,
  isRefreshing,
  readOnlyNote,
  headerExtra,
  loading,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: LeaveReviewShellProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
          style={{ transform: `translateY(${Math.min(pullDistance - 20, 40)}px)` }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-full p-2 shadow-lg">
            <div
              className={`w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full ${isRefreshing ? 'animate-spin' : ''}`}
              style={{
                transform: `rotate(${pullDistance * 3.6}deg)`,
                transition: isRefreshing ? 'none' : 'transform 0.1s',
              }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>

          {readOnlyNote && (
            <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
              <Eye className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{readOnlyNote}</span>
            </div>
          )}

          {headerExtra}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 bg-white dark:bg-slate-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {emptyTitle}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{emptyDescription}</p>
          </div>
        ) : (
          <div className="space-y-3">{children}</div>
        )}
      </main>
    </div>
  );
}
