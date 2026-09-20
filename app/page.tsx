'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserMinus, Calendar, RefreshCw } from 'lucide-react';
import { CountUp } from '@/components/CountUp';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { HeatmapCalendar } from '@/components/HeatmapCalendar';
import { formatFullThaiDate } from '@/lib/thaiDate';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, HALF_DAY_PERIOD_LABELS } from '@/types/leave';
import type { LeaveType, HalfDayPeriod } from '@/types/leave';

interface PublicSummary {
  date: string;
  totalTeachers: number;
  attendingToday: number;
  leavesToday: number;
  leavesTomorrow: number;
  todayHoliday: string | null;
  tomorrowHoliday: string | null;
  leavesByType: {
    type: LeaveType;
    customTypeName?: string;
    count: number;
    teachers: {
      id: string;
      firstName: string;
      lastName: string;
      teacherCode: string;
      department: string | null;
      isHalfDay: boolean;
      halfDayPeriod?: HalfDayPeriod;
    }[];
  }[];
}

interface DayLeave {
  id: string;
  firstName: string;
  lastName: string;
  teacherCode: string;
  department: string | null;
  type: LeaveType;
  customTypeName?: string;
  isHalfDay: boolean;
  halfDayPeriod?: HalfDayPeriod;
}

export default function HomePage() {
  const [summary, setSummary] = useState<PublicSummary | null>(null);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>();
  const [holidays, setHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [currentHeatmapDate, setCurrentHeatmapDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayLeaves, setSelectedDayLeaves] = useState<DayLeave[]>([]);
  const [loadingDayLeaves, setLoadingDayLeaves] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const [pullStartX, setPullStartX] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Skip first render (already fetched in fetchData)
    if (currentHeatmapDate.getTime() !== new Date().getTime()) {
      fetchHeatmapData(currentHeatmapDate);
    }
  }, [currentHeatmapDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch summary
      const summaryResponse = await fetch('/api/public/summary');
      if (!summaryResponse.ok) {
        throw new Error(summaryResponse.status === 500
          ? 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง'
          : 'ไม่สามารถโหลดข้อมูลได้'
        );
      }
      const summaryData = await summaryResponse.json();
      setSummary(summaryData);
      setLastRefresh(new Date());

      // Fetch heatmap data for current month
      const today = new Date();
      setCurrentHeatmapDate(today);
      await fetchHeatmapData(today);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
      setError(message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const fetchHeatmapData = async (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Fetch heatmap data
      const heatmapResponse = await fetch(
        `/api/public/heatmap?year=${year}&month=${month}`
      );
      if (heatmapResponse.ok) {
        const data = await heatmapResponse.json();
        setHeatmapData(data);
      }

      // Fetch holidays
      const holidaysResponse = await fetch(
        `/api/public/holidays?year=${year}&month=${month}`
      );
      if (holidaysResponse.ok) {
        const data = await holidaysResponse.json();
        setHolidays(data.holidays || []);
      }
    } catch (err) {
      console.error('Failed to fetch heatmap:', err);
    }
  };

  const handleHeatmapMonthChange = (newDate: Date) => {
    setCurrentHeatmapDate(newDate);
  };

  const handleDayClick = async (date: string) => {
    setSelectedDate(date);
    setLoadingDayLeaves(true);

    try {
      const response = await fetch(`/api/public/leaves-by-date?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDayLeaves(data.leaves || []);
      } else {
        setSelectedDayLeaves([]);
      }
    } catch (err) {
      console.error('Failed to fetch day leaves:', err);
      setSelectedDayLeaves([]);
    } finally {
      setLoadingDayLeaves(false);
    }
  };

  const closeModal = () => {
    setSelectedDate(null);
    setSelectedDayLeaves([]);
  };

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull when at the very top of the page
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
      setPullStartX(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pullStartY) return;

    // Cancel pull if user has scrolled down
    if (window.scrollY > 0) {
      setPullStartY(0);
      setPullStartX(0);
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - pullStartY;
    const deltaX = Math.abs(currentX - pullStartX);

    // Detect if this is a vertical pull (not horizontal swipe)
    // Only activate pull-to-refresh if vertical movement > horizontal movement
    if (deltaY > 0 && deltaY > deltaX * 1.5) {
      if (!isPulling && deltaY > 10) {
        setIsPulling(true);
      }

      // Only allow downward pull up to 150px
      if (deltaY < 2000) {
        setPullDistance(deltaY);
        // Only prevent default when actively pulling
        if (isPulling) {
          e.preventDefault();
        }
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 140) {
      setIsRefreshing(true);
      await fetchData();
      setIsRefreshing(false);
    }

    setIsPulling(false);
    setPullStartY(0);
    setPullStartX(0);
    setPullDistance(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-8 w-64 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 rounded animate-shimmer bg-[length:200%_100%]" />
            <div className="h-10 w-10 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 rounded-lg animate-shimmer bg-[length:200%_100%]" />
          </div>

          {/* Cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 rounded-2xl p-6 h-32 animate-shimmer bg-[length:200%_100%]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const currentDate = new Date(summary.date);

  return (
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
                  pullDistance > 140
                    ? 'text-emerald-600 dark:text-emerald-400 animate-spin'
                    : 'text-sky-600 dark:text-sky-400'
                }`}
                style={{ transform: pullDistance > 140 ? 'none' : `rotate(${pullDistance * 2}deg)` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1 flex items-center gap-3">
              <Image
                src="/icons/icon-192.png"
                alt="โรงเรียนบ้านเนินพลับหวาน"
                width={64}
                height={64}
                className="flex-shrink-0"
                priority
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-heading-lg">
                  โรงเรียนบ้านเนินพลับหวาน
                </h1>
                <p className="text-label text-secondary mt-1">
                  {formatFullThaiDate(currentDate)}
                </p>
                {lastRefresh && (
                  <p className="text-caption text-tertiary mt-0.5">
                    อัปเดตล่าสุด: {lastRefresh.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                aria-label="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <DarkModeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-3 space-y-section">
        {/* Holiday banner */}
        {summary.todayHoliday && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-5 text-white text-center"
          >
            <Calendar className="w-7 h-7 mx-auto mb-1.5" />
            <h2 className="text-heading-md mb-0.5">วันนี้เป็นวันหยุด</h2>
            <p className="text-body-sm text-amber-50">{summary.todayHoliday}</p>
          </motion.div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
          {/* Attending - full width on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-800 xs:col-span-1 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-default"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-label text-secondary">
                มาปฏิบัติงาน
              </h3>
            </div>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-none tabular-nums">
              <CountUp end={summary.attendingToday} duration={1.5} /> <span className="text-body-sm text-tertiary font-normal ml-1">คน</span>
            </p>
          </motion.div>

          {/* Second row wrapper for mobile (2 cards side by side) */}
          <div className="grid grid-cols-2 xs:contents gap-2">
            {/* Leaves today */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-default"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                  <UserMinus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <h3 className="text-label text-secondary">
                  ลาวันนี้
                </h3>
              </div>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-none tabular-nums">
                <CountUp end={summary.leavesToday} duration={1.5} /> <span className="text-body-sm text-tertiary font-normal ml-1">คน</span>
              </p>
            </motion.div>

            {/* Leaves tomorrow */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all cursor-default"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-label text-secondary">
                  ลาพรุ่งนี้
                </h3>
              </div>
              {summary.tomorrowHoliday ? (
                <p className="text-label text-secondary leading-snug">
                  พรุ่งนี้เป็นวันหยุด
                </p>
              ) : (
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-none tabular-nums">
                  <CountUp end={summary.leavesTomorrow} duration={1.5} /> <span className="text-body-sm text-tertiary font-normal ml-1">คน</span>
                </p>
              )}
            </motion.div>
          </div>
        </div>

        {/* Leave list */}
        {summary.leavesByType.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <h2 className="text-heading-sm mb-3">
              รายชื่อครูที่ลาวันนี้
            </h2>
            <div className="space-y-2">
              {summary.leavesByType.map((group, idx) => (
                <div key={idx}>
                  {group.teachers.map((teacher, tIdx) => {
                    const leaveType = group.type as LeaveType;
                    const displayType = leaveType === 'other' ? 'อื่นๆ' : LEAVE_TYPE_LABELS[leaveType];
                    const typeColors = LEAVE_TYPE_COLORS[leaveType] || LEAVE_TYPE_COLORS['other'];

                    // Calculate global index for stagger delay
                    const globalIdx = summary.leavesByType
                      .slice(0, idx)
                      .reduce((acc, g) => acc + g.teachers.length, 0) + tIdx;

                    return (
                      <motion.div
                        key={teacher.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: globalIdx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-center gap-2 py-2 min-w-0 rounded-lg px-2 -mx-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-default"
                      >
                        <span className="text-muted flex-shrink-0">–</span>
                        <span className="font-medium text-body-sm truncate">
                          {teacher.firstName} {teacher.lastName}
                        </span>
                        {teacher.department && (
                          <span className="text-caption text-secondary flex-shrink-0">
                            ({teacher.department})
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 text-caption rounded border flex-shrink-0 ${typeColors.light} ${typeColors.dark}`}>
                          {displayType}
                        </span>
                        {teacher.isHalfDay && teacher.halfDayPeriod && (
                          <span className="px-1.5 py-0.5 text-caption bg-slate-100 dark:bg-slate-800 text-secondary rounded flex-shrink-0">
                            {HALF_DAY_PERIOD_LABELS[teacher.halfDayPeriod]}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 rounded-xl p-8 text-center border border-sky-100 dark:border-sky-900/50"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-sky-100 dark:bg-sky-900/50 rounded-full flex items-center justify-center">
              <Calendar className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="text-heading-md mb-2">
              ไม่มีครูลาวันนี้ 🎉
            </h3>
            <p className="text-body-sm text-secondary">
              ทุกคนมาปฏิบัติงานครบ — โรงเรียนเต็มไปด้วยความพร้อม
            </p>
          </motion.div>
        )}

        {/* Heatmap Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-800"
        >
          <h2 className="text-heading-sm mb-3">
            ปฏิทินการลารายเดือน
          </h2>
          <HeatmapCalendar
            data={heatmapData || {}}
            currentDate={currentHeatmapDate}
            clickable={true}
            onMonthChange={handleHeatmapMonthChange}
            onDayClick={handleDayClick}
            holidays={holidays}
          />
        </motion.div>

        {/* Modal for day details */}
        <AnimatePresence>
          {selectedDate && (
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
              onClick={closeModal}
            >
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[80vh] overflow-y-auto"
              >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-heading-md">
                  {formatFullThaiDate(new Date(selectedDate))}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="text-slate-500 text-xl">×</span>
                </button>
              </div>

              {loadingDayLeaves ? (
                <div className="text-center py-8 text-slate-500">
                  กำลังโหลด...
                </div>
              ) : selectedDayLeaves.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  ไม่มีครูลาวันนี้
                </div>
              ) : (
                <>
                  <p className="text-body-sm text-secondary mb-3">
                    มีครู {selectedDayLeaves.length} คนลาในวันนี้
                  </p>

                  <div className="space-y-2">
                    {selectedDayLeaves.map((leave) => {
                      const typeLabel = leave.type === 'other' && leave.customTypeName
                        ? leave.customTypeName
                        : LEAVE_TYPE_LABELS[leave.type];
                      const colorClass = LEAVE_TYPE_COLORS[leave.type];
                      const fullName = `${leave.firstName || ''} ${leave.lastName || ''}`.trim() || 'ไม่ระบุชื่อ';

                      return (
                        <div
                          key={leave.id}
                          className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-body-sm min-w-0 truncate" title={fullName}>
                              {fullName}
                            </p>
                            {leave.department && (
                              <span className="text-caption text-secondary truncate" title={leave.department}>
                                • {leave.department}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 text-caption rounded flex-shrink-0 ${colorClass.light} ${colorClass.dark}`}>
                              {typeLabel}
                            </span>
                            {leave.isHalfDay && leave.halfDayPeriod && (
                              <span className="px-1.5 py-0.5 text-caption rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex-shrink-0">
                                {HALF_DAY_PERIOD_LABELS[leave.halfDayPeriod]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* CTA buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-3 pb-safe bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Link
            href="/verify"
            className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white text-center font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            ยื่นใบลา
          </Link>
          <Link
            href="/hr/login"
            className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-center font-medium rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            เจ้าหน้าที่
          </Link>
        </div>
      </div>
    </div>
  );
}
