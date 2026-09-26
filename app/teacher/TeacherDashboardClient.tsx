'use client';

import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, History, LogOut, Clock, TrendingUp, Calendar, Home, PlusCircle, Sparkles, RefreshCw, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { SessionWarning } from '@/components/SessionWarning';
import { CountUp } from '@/components/CountUp';
import { getThaiGreeting, formatFullThaiDate, formatThaiDateShort } from '@/lib/thaiDate';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, LEAVE_TYPE_COLORS, LEAVE_STATUS_COLORS } from '@/types/leave';
import type { LeaveType, LeaveStatus } from '@/types/leave';
import { format, parseISO, isFuture, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { fetchCache } from '@/lib/fetchCache';

// Lazy load Timeline component
const TimelineSection = lazy(() => import('./components/TimelineSection'));

interface TeacherDashboardClientProps {
  teacher: {
    id: string;
    teacherCode: string;
    firstName: string;
    lastName: string;
    createdAt: number;
  };
}

interface RecentLeave {
  id: string;
  leaveNo: string;
  type: LeaveType;
  customTypeName?: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  daysWorking: number;
  rejectionReason?: string;
  createdAt: string;
}

interface UpcomingLeave {
  id: string;
  leaveNo: string;
  type: LeaveType;
  customTypeName?: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  daysWorking: number;
  isHalfDay: boolean;
  halfDayPeriod?: 'morning' | 'afternoon' | null;
}

interface LeaveStats {
  count: number;
  days: number;
}

interface TimelineLeave {
  id: string;
  leaveNo: string;
  type: LeaveType;
  customTypeName?: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  daysWorking: number;
  isHalfDay: boolean;
  halfDayPeriod?: 'morning' | 'afternoon' | null;
}

export default function TeacherDashboardClient({ teacher }: TeacherDashboardClientProps) {
  const router = useRouter();
  const [recentLeaves, setRecentLeaves] = useState<RecentLeave[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<UpcomingLeave[]>([]);
  const [stats, setStats] = useState<Record<LeaveType, LeaveStats> | null>(null);
  const [timeline, setTimeline] = useState<{
    monthlyData: Record<string, TimelineLeave[]>;
    periodLabel: string;
    fiscalYear: number;
    stats: { totalDays: number; totalCount: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedStatType, setSelectedStatType] = useState<LeaveType | null>(null);
  const [statModalLeaves, setStatModalLeaves] = useState<RecentLeave[]>([]);
  const [loadingStatModal, setLoadingStatModal] = useState(false);
  const initialLoadRef = useRef(false);

  // Check if first time user (no leaves ever)
  const isFirstTimeUser = !loading && recentLeaves.length === 0;
  const hasNoLeavesThisPeriod = stats && Object.values(stats).every(s => s.count === 0);

  useEffect(() => {
    // Prevent double fetch on mount
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    fetchDashboardData();

    // Check if returning from successful leave submission
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      toast.success('ยื่นใบลาสำเร็จ! 🎉');
      // Clean up URL
      window.history.replaceState({}, '', '/teacher');
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Use fetchCache for deduplication and caching
      const data = await fetchCache.fetch('/api/teacher/dashboard', {
        cacheDuration: 30000, // 30 seconds cache
      });

      setRecentLeaves(data.recent?.leaves || []);
      setStats(data.stats?.stats || {});
      setTimeline({
        monthlyData: data.timeline?.monthlyData || {},
        periodLabel: data.timeline?.periodLabel || '',
        fiscalYear: data.timeline?.fiscalYear || 0,
        stats: data.timeline?.stats || { totalDays: 0, totalCount: 0 },
      });
      setUpcomingLeaves(data.upcoming?.leaves || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      await fetch('/api/auth/teacher/logout', { method: 'POST' });
      toast.success('ออกจากระบบสำเร็จ');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
      setLoggingOut(false);
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

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || !pullStartY) return;

    if (window.scrollY > 0) {
      setIsPulling(false);
      setPullStartY(0);
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = currentY - pullStartY;

    if (distance > 0 && distance < 150) {
      setPullDistance(distance);
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 100) {
      setIsRefreshing(true);
      // Clear cache before refresh
      fetchCache.clear('/api/teacher/dashboard');
      await fetchDashboardData();
      setIsRefreshing(false);
    }

    setIsPulling(false);
    setPullStartY(0);
    setPullDistance(0);
  };

  const handleStatCardClick = async (type: LeaveType) => {
    if (!stats || stats[type].count === 0) return;

    setSelectedStatType(type);
    setLoadingStatModal(true);

    try {
      const response = await fetch(`/api/teacher/leaves/recent?type=${type}`);
      if (response.ok) {
        const data = await response.json();
        setStatModalLeaves(data.leaves || []);
      }
    } catch (error) {
      console.error('Failed to fetch leaves:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoadingStatModal(false);
    }
  };

  const closeStatModal = () => {
    setSelectedStatType(null);
    setStatModalLeaves([]);
  };

  // Count pending leaves for badge
  const pendingCount = recentLeaves.filter(l => l.status === 'pending').length;

  return (
    <>
      <SessionWarning sessionType="teacher" sessionCreatedAt={teacher.createdAt} />

      <div
        ref={containerRef}
        className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to refresh indicator */}
        <AnimatePresence>
          {isPulling && pullDistance > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4"
              style={{ transform: `translateY(${Math.min(pullDistance - 40, 40)}px)` }}
            >
              <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg">
                <RefreshCw
                  className={`w-5 h-5 transition-colors ${
                    pullDistance > 100
                      ? 'text-emerald-600 dark:text-emerald-400 animate-spin'
                      : 'text-sky-600 dark:text-sky-400'
                  }`}
                  style={{ transform: pullDistance > 100 ? 'none' : `rotate(${pullDistance * 2}deg)` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-start gap-3 mb-2">
              <img
                src="/icons/icon-192.png"
                alt="Logo"
                className="w-12 h-12 rounded-lg flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-label text-secondary mb-1 flex items-center gap-2">
                  {getThaiGreeting()}
                  {!loading && pendingCount > 0 && (
                    <span className="relative inline-flex items-center gap-1">
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-semibold"
                      >
                        {pendingCount}
                      </motion.span>
                      <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                        รออนุมัติ
                      </span>
                    </span>
                  )}
                </p>
                <h1 className="text-heading-lg">
                  {teacher.firstName} {teacher.lastName}
                </h1>
                <p className="text-label text-secondary mt-1">
                  รหัส: {teacher.teacherCode}
                </p>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                aria-label="ออกจากระบบ"
              >
                <LogOut className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
            <p className="text-caption text-tertiary">
              {formatFullThaiDate(new Date())}
            </p>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-3 space-y-section">
          {/* Upcoming Leaves */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 rounded-xl border border-sky-200 dark:border-sky-800 p-3"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-heading-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  ใบลาที่กำลังจะถึง
                </h2>
                <span className="text-label text-sky-700 dark:text-sky-400">
                  {upcomingLeaves.length} ใบ
                </span>
              </div>
              {upcomingLeaves.length > 0 ? (
                <div className="space-y-2">
                  {upcomingLeaves.map((leave, idx) => {
                    const typeColors = LEAVE_TYPE_COLORS[leave.type] || LEAVE_TYPE_COLORS['other'];
                    const statusColors = LEAVE_STATUS_COLORS[leave.status];
                    const displayType = leave.type === 'other' && leave.customTypeName
                      ? leave.customTypeName
                      : LEAVE_TYPE_LABELS[leave.type];
                    const daysUntil = differenceInDays(new Date(leave.startDate), new Date());
                    const halfDayLabel = leave.isHalfDay
                      ? (leave.halfDayPeriod === 'morning' ? 'ครึ่งเช้า' : 'ครึ่งบ่าย')
                      : null;

                    return (
                      <motion.div
                        key={leave.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + idx * 0.1, type: 'spring', damping: 25 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="group relative"
                      >
                        <div
                          onClick={() => router.push(`/teacher/leaves/${leave.id}`)}
                          className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-sky-200 dark:border-sky-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all cursor-pointer"
                        >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 text-caption rounded border ${typeColors.light} ${typeColors.dark}`}>
                              {displayType}
                            </span>
                            {halfDayLabel && (
                              <span className="px-1.5 py-0.5 text-caption rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                                {halfDayLabel}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 text-caption rounded border ${statusColors.light} ${statusColors.dark}`}>
                              {LEAVE_STATUS_LABELS[leave.status]}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-body-sm">
                          <span className="text-slate-700 dark:text-slate-300">
                            {formatThaiDateShort(new Date(leave.startDate))}
                            {' - '}
                            {formatThaiDateShort(new Date(leave.endDate))}
                          </span>
                          <span className="text-label text-sky-600 dark:text-sky-400">
                            อีก {daysUntil} วัน
                          </span>
                        </div>
                        </div>

                        {/* Hover Preview Tooltip */}
                        <div className="absolute left-full ml-2 top-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:block">
                          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-100 dark:to-white text-white dark:text-slate-900 text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                            <div className="font-bold mb-1">เลขที่: {leave.leaveNo}</div>
                            <div className="text-[10px] opacity-90">คลิกเพื่อดูรายละเอียด</div>
                            {/* Arrow */}
                            <div className="absolute right-full top-1/2 -translate-y-1/2">
                              <div className="border-4 border-transparent border-r-slate-800 dark:border-r-white" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center py-8 text-secondary text-body-sm"
                >
                  <motion.div
                    animate={{
                      rotate: [0, 10, -10, 10, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                    className="inline-block text-4xl mb-2"
                  >
                    📅
                  </motion.div>
                  <p>ไม่มีใบลาที่กำลังจะถึง</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Stats Overview */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : stats ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-heading-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  สถิติการลารอบนี้
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['sick', 'personal', 'maternity', 'religious'] as LeaveType[]).map((type, idx) => {
                  const stat = stats[type];
                  const typeColors = LEAVE_TYPE_COLORS[type];
                  const hasData = stat.count > 0;

                  return (
                    <motion.div
                      key={type}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + idx * 0.1, type: 'spring', damping: 25 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      onClick={() => handleStatCardClick(type)}
                      className={`p-3 rounded-xl border transition-all ${
                        hasData
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 cursor-pointer'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800/50 cursor-default'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-caption rounded border ${typeColors.light} ${typeColors.dark}`}>
                          {LEAVE_TYPE_LABELS[type]}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                            <CountUp end={stat.days} duration={1.5} />
                          </span>
                          <span className="text-label text-tertiary">วัน</span>
                        </div>
                        <div className="text-body-sm text-secondary tabular-nums">
                          <CountUp end={stat.count} duration={1.5} /> ครั้ง
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Leave Timeline - Lazy loaded */}
          {timeline && (
            <Suspense fallback={
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 h-48 animate-pulse" />
            }>
              {Object.keys(timeline.monthlyData).length > 0 ? (
                <TimelineSection
                  timeline={timeline.monthlyData}
                  periodLabel={timeline.periodLabel}
                  fiscalYear={timeline.fiscalYear}
                  stats={timeline.stats}
                  onLeaveClick={(id) => {
                    if (id) {
                      router.push(`/teacher/leaves/${id}`);
                    } else {
                      router.push('/teacher/history');
                    }
                  }}
                />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-center py-6 text-secondary text-body-sm">
                    ไม่มีข้อมูล
                  </div>
                </div>
              )}
            </Suspense>
          )}
        </main>

        {/* Bottom navigation - Enhanced with CTA */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe z-50">
          <div className="max-w-4xl mx-auto px-4 py-2.5">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => router.push('/teacher')}
                className="flex flex-col items-center gap-0.5 py-2 text-sky-600 dark:text-sky-400"
              >
                <Home className="w-5 h-5" />
                <span className="text-caption font-medium">หน้าหลัก</span>
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
                <span className="text-caption font-semibold">ยื่นใบลา</span>
                {/* Sparkle effect */}
                <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => router.push('/teacher/history')}
                className="flex flex-col items-center gap-0.5 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                <History className="w-5 h-5" />
                <span className="text-caption font-medium">ประวัติ</span>
              </button>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
