'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Filter,
  FileText,
  Clock,
  X,
  ChevronDown,
  Trash2,
  AlertTriangle,
  Home,
  PlusCircle,
  Sparkles,
  History,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseError, getSuccessMessage } from '@/lib/errorMessages';
import { parseDateFromAPI, isSameDay } from '@/lib/client-date-utils';
import { formatThaiDate, formatThaiDateShort } from '@/lib/thaiDate';
import type { LeaveType, LeaveStatus } from '@/types/leave';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_COLORS,
} from '@/types/leave';

interface LeaveHistoryClientProps {
  teacher: {
    id: string;
    teacherCode: string;
    firstName: string;
    lastName: string;
  };
}

interface Leave {
  id: string;
  leaveNo: string;
  type: LeaveType;
  customTypeName?: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: 'morning' | 'afternoon';
  daysWorking: number;
  reason: string;
  status: LeaveStatus;
  rejectionReason?: string;
  submittedByType: 'teacher' | 'hr';
  submittedByHr?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export default function LeaveHistoryClientOptimized({ teacher }: LeaveHistoryClientProps) {
  const router = useRouter();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
  });
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset and fetch when filters change
    setLeaves([]);
    setNextCursor(null);
    fetchLeaves(null);
  }, [filters]);

  const fetchLeaves = async (cursor: string | null) => {
    try {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        limit: '20',
      });

      if (cursor) params.append('cursor', cursor);
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);

      const res = await fetch(`/api/teacher/leaves/history-optimized?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();

      if (cursor) {
        // Append to existing leaves
        setLeaves(prev => [...prev, ...data.leaves]);
      } else {
        // Replace leaves (new fetch)
        setLeaves(data.leaves);
      }

      setNextCursor(data.pagination.nextCursor);
      setHasNextPage(data.pagination.hasNextPage);
    } catch (error: any) {
      console.error('Failed to fetch leaves:', error);
      const errorMsg = parseError(error, 'ไม่สามารถโหลดประวัติการลาได้');
      toast.error(errorMsg.title, { description: errorMsg.description });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !loadingMore) {
          fetchLeaves(nextCursor);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, loadingMore, nextCursor]);

  const handleCancelLeave = async (leaveId: string) => {
    const confirmed = confirm('คุณต้องการยกเลิกใบลานี้หรือไม่?');
    if (!confirmed) return;

    try {
      setCancellingId(leaveId);

      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const res = await fetch(`/api/teacher/leaves/${leaveId}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('ยกเลิกใบลาสำเร็จ');
      // Refresh by resetting
      setLeaves([]);
      setNextCursor(null);
      fetchLeaves(null);
    } catch (error: any) {
      console.error('Cancel error:', error);
      toast.error(error.message || 'ไม่สามารถยกเลิกใบลาได้');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusIcon = (status: LeaveStatus) => {
    switch (status) {
      case 'approved':
        return '✓';
      case 'rejected':
        return '✕';
      case 'cancelled':
        return '⊗';
      default:
        return '⏱';
    }
  };

  const clearFilters = () => {
    setFilters({ status: '', type: '' });
    setShowFilters(false);
  };

  const hasActiveFilters = filters.status || filters.type;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                ประวัติการลา
              </h1>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
            >
              <Filter className="w-5 h-5" />
              {hasActiveFilters && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-sky-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
          >
            <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  สถานะ
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="pending">รออนุมัติ</option>
                  <option value="approved">อนุมัติแล้ว</option>
                  <option value="rejected">ไม่อนุมัติ</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  ประเภท
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="sick">ลาป่วย</option>
                  <option value="personal">ลากิจส่วนตัว</option>
                  <option value="maternity">ลาคลอดบุตร</option>
                  <option value="religious">ลาทางศาสนา</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="w-full py-2 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </motion.div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-32 bg-white dark:bg-slate-900 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <FileText className="w-10 h-10 text-slate-400 dark:text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              {hasActiveFilters ? 'ไม่พบใบลาที่ตรงกับเงื่อนไข' : 'ยังไม่มีประวัติการลา'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              {hasActiveFilters ? 'ลองเปลี่ยนตัวกรองเพื่อค้นหา' : 'เริ่มยื่นใบลาของคุณได้เลย'}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-medium transition-colors"
              >
                ล้างตัวกรอง
              </button>
            ) : (
              <button
                onClick={() => router.push('/teacher/leave/new')}
                className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors"
              >
                ยื่นใบลา
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {leaves.map((leave, idx) => {
                const typeColors = LEAVE_TYPE_COLORS[leave.type];
                const statusColors = LEAVE_STATUS_COLORS[leave.status];
                const displayType =
                  leave.type === 'other' && leave.customTypeName
                    ? leave.customTypeName
                    : LEAVE_TYPE_LABELS[leave.type];

                const canCancel = leave.status === 'pending';

                return (
                  <motion.div
                    key={leave.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-lg border ${typeColors.light} ${typeColors.dark}`}
                        >
                          {displayType}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs rounded-lg border ${statusColors.light} ${statusColors.dark} flex items-center gap-1`}
                        >
                          <span>{getStatusIcon(leave.status)}</span>
                          {LEAVE_STATUS_LABELS[leave.status]}
                        </span>
                        {leave.submittedByType === 'hr' && (
                          <span className="px-2 py-1 text-xs rounded-lg border bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800">
                            ยื่นโดยฝ่ายบุคคล
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {leave.leaveNo}
                      </span>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>
                          {formatThaiDateShort(parseDateFromAPI(leave.startDate))}
                          {!isSameDay(leave.startDate, leave.endDate) && (
                            <>
                              {' - '}
                              {formatThaiDateShort(parseDateFromAPI(leave.endDate))}
                            </>
                          )}
                        </span>
                        {leave.isHalfDay && leave.halfDayPeriod && (
                          <span className="text-sky-600 dark:text-sky-400 text-xs">
                            ({leave.halfDayPeriod === 'morning' ? 'ครึ่งเช้า' : 'ครึ่งบ่าย'})
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {leave.daysWorking} วันทำการ
                      </p>

                      <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                        {leave.reason}
                      </p>
                    </div>

                    {leave.status === 'rejected' && leave.rejectionReason && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-red-900 dark:text-red-100 mb-1">
                              เหตุผลที่ไม่อนุมัติ:
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300">
                              {leave.rejectionReason}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {canCancel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelLeave(leave.id);
                        }}
                        disabled={cancellingId === leave.id}
                        className="w-full py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {cancellingId === leave.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-red-400 border-t-red-600 rounded-full animate-spin" />
                            <span>กำลังยกเลิก...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            <span>ยกเลิกใบลา</span>
                          </>
                        )}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Infinite scroll trigger & loading indicator */}
            {hasNextPage && (
              <div ref={observerTarget} className="py-8 flex justify-center">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">กำลังโหลดเพิ่มเติม...</span>
                  </div>
                )}
              </div>
            )}

            {!hasNextPage && leaves.length > 0 && (
              <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                แสดงครบทั้งหมดแล้ว
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-bottom z-50">
        <div className="max-w-4xl mx-auto px-4 py-2.5">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => router.push('/teacher')}
              className="flex flex-col items-center gap-0.5 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span className="text-xs font-medium">หน้าหลัก</span>
            </button>

            <button
              onClick={() => router.push('/teacher/leave/new')}
              className="relative flex flex-col items-center gap-0.5 py-2 px-4 -mt-4 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all group"
            >
              <motion.div
                animate={{
                  rotate: [0, -10, 10, -10, 0],
                  scale: [1, 1.5, 1.5, 1.5, 1],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  repeatDelay: 1.5,
                }}
              >
                <PlusCircle className="w-6 h-6" />
              </motion.div>
              <span className="text-xs font-bold">ยื่นใบลา</span>
              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => router.push('/teacher/history')}
              className="flex flex-col items-center gap-0.5 py-2 text-sky-600 dark:text-sky-400"
            >
              <History className="w-5 h-5" />
              <span className="text-xs font-medium">ประวัติ</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
