'use client';

import { ReactNode, useState } from 'react';
import { Check, Eye, RefreshCw } from 'lucide-react';
import type { MotionValue } from 'framer-motion';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import HrLogoutButton from '@/components/hr/HrLogoutButton';
import type { PullState } from '@/hooks/usePullToRefresh';

interface LeaveReviewShellProps {
  title: string;
  subtitle: string;
  pull: MotionValue<number>;
  pullState: PullState;
  pullThreshold: number;
  onRefresh: () => Promise<unknown>;
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
  pull,
  pullState,
  pullThreshold,
  onRefresh,
  readOnlyNote,
  headerExtra,
  loading,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: LeaveReviewShellProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
      <PullToRefreshIndicator pull={pull} state={pullState} threshold={pullThreshold} />

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                aria-label="รีเฟรชข้อมูล"
              >
                <RefreshCw
                  className={`w-4 h-4 text-slate-700 dark:text-slate-300 ${refreshing ? 'animate-spin' : ''}`}
                />
              </button>
              <HrLogoutButton />
            </div>
          </div>

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
