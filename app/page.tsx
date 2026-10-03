'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence, MotionConfig, type Variants } from 'framer-motion';
import { Users, UserMinus, Calendar, RefreshCw, Rocket } from 'lucide-react';
import { CountUp } from '@/components/CountUp';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { HeatmapCalendar } from '@/components/HeatmapCalendar';
import { formatFullThaiDate } from '@/lib/thaiDate';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, HALF_DAY_PERIOD_LABELS } from '@/types/leave';
import type { LeaveType, HalfDayPeriod, LeaveStatus } from '@/types/leave';
import { fetchCache } from '@/lib/fetchCache';
import { LeaveStatusIcon, LeaveStatusIconLegend } from '@/components/LeaveStatusIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

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
      status: LeaveStatus;
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
  status: LeaveStatus;
}

interface HeatmapDay {
  date: string;
  count: number;
  leaves: DayLeave[];
}

const EASE = [0.16, 1, 0.3, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export default function HomePage() {
  const [summary, setSummary] = useState<PublicSummary | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [holidays, setHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [currentHeatmapDate, setCurrentHeatmapDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayLeaves, setSelectedDayLeaves] = useState<DayLeave[]>([]);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchData();
    }
  }, []);

  useEffect(() => {
    // Duplicate with the initial fetchData request is deduped by fetchCache
    if (initialLoadRef.current) {
      fetchHeatmapData(currentHeatmapDate);
    }
  }, [currentHeatmapDate]);

  const fetchData = async (fresh = false) => {
    try {
      setError(null);

      const year = currentHeatmapDate.getFullYear();
      const month = currentHeatmapDate.getMonth() + 1;
      const options = { cacheDuration: 60000, cacheBust: fresh };

      // Fire both requests together; each section renders as soon as its data arrives
      await Promise.all([
        fetchCache.fetch('/api/public/summary', options).then((data) => {
          setSummary(data);
          setLastRefresh(new Date());
        }),
        fetchCache.fetch(`/api/public/dashboard?year=${year}&month=${month}`, options).then((data) => {
          setHeatmapData(data.heatmap);
          setHolidays(data.holidays);
        }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
      setError(message);
      console.error('Fetch error:', err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Clear both caches before refresh
    fetchCache.clear('/api/public/summary');
    fetchCache.clear('/api/public/dashboard');
    await fetchData(true);
    setIsRefreshing(false);
  };

  const fetchHeatmapData = async (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Use fetchCache for deduplication
      const data = await fetchCache.fetch(
        `/api/public/dashboard?year=${year}&month=${month}`,
        { cacheDuration: 60000 }
      );

      setHeatmapData(data.heatmap);
      setHolidays(data.holidays);
    } catch (err) {
      console.error('Failed to fetch heatmap:', err);
    }
  };

  const handleHeatmapMonthChange = (newDate: Date) => {
    setCurrentHeatmapDate(newDate);
  };

  const handleDayClick = (date: string) => {
    // Find leaves from heatmap data (no need to fetch)
    const dayData = heatmapData.find(d => d.date === date);
    setSelectedDate(date);
    setSelectedDayLeaves(dayData?.leaves || []);
  };

  const closeModal = () => {
    setSelectedDate(null);
    setSelectedDayLeaves([]);
  };

  const { pull, state: pullState, threshold: pullThreshold } = usePullToRefresh(handleRefresh, {
    enabled: !selectedDate,
  });

  const heatmapCounts = useMemo(
    () => Object.fromEntries(heatmapData.map((day) => [day.date, day.count])),
    [heatmapData]
  );

  const todayTeachers = useMemo(
    () =>
      summary?.leavesByType.flatMap((group) =>
        group.teachers.map((teacher) => ({
          ...teacher,
          type: group.type,
          customTypeName: group.customTypeName,
        }))
      ) ?? [],
    [summary]
  );

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const currentDate = summary ? new Date(summary.date) : new Date();

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <PullToRefreshIndicator pull={pull} state={pullState} threshold={pullThreshold} />
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1 flex items-center gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Image
                  src="/icons/icon-192.png"
                  alt="โรงเรียนบ้านเนินพลับหวาน"
                  width={80}
                  height={80}
                  className="flex-shrink-0"
                  priority
                />
              </motion.div>
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
            <div className="flex flex-col xs:flex-row items-end xs:items-center gap-2">
              <DarkModeToggle />
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                aria-label="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto px-4 py-3 space-y-section"
      >
        {/* Holiday banner */}
        {summary?.todayHoliday && (
          <motion.div
            variants={item}
            className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-5 text-white text-center shadow-lg shadow-amber-500/20"
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
            variants={item}
            className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-md shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800 xs:col-span-1"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-label text-secondary">
                มาปฏิบัติงาน
              </h3>
            </div>
            {!summary ? (<div className="h-6 w-16 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" aria-hidden />) : (
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-none tabular-nums">
                <CountUp end={summary.attendingToday} duration={600} /><span className="text-body-sm text-tertiary font-normal ml-1">/ {summary.totalTeachers} คน</span>
              </p>
            )}
          </motion.div>

          {/* Second row wrapper for mobile (2 cards side by side) */}
          <div className="grid grid-cols-2 xs:contents gap-2">
            {/* Leaves today */}
            <motion.div
              variants={item}
              className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-md shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                  <UserMinus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <h3 className="text-label text-secondary">
                  ลาวันนี้
                </h3>
              </div>
              {!summary ? (<div className="h-6 w-16 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" aria-hidden />) : (
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-none tabular-nums">
                  <CountUp end={summary.leavesToday} duration={600} /> <span className="text-body-sm text-tertiary font-normal ml-1">คน</span>
                </p>
              )}
            </motion.div>

            {/* Leaves tomorrow */}
            <motion.div
              variants={item}
              className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-md shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-label text-secondary">
                  ลาพรุ่งนี้
                </h3>
              </div>
              {!summary ? (<div className="h-6 w-16 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" aria-hidden />) : summary.tomorrowHoliday ? (
                <p className="text-label text-secondary leading-snug">
                  พรุ่งนี้เป็นวันหยุด
                </p>
              ) : (
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-none tabular-nums">
                  <CountUp end={summary.leavesTomorrow} duration={600} /> <span className="text-body-sm text-tertiary font-normal ml-1">คน</span>
                </p>
              )}
            </motion.div>
          </div>
        </div>

        {/* Leave list */}
        {!summary ? (
          <motion.div
            variants={item}
            aria-hidden
            className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-md shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800"
          >
            <div className="h-5 w-40 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse mb-3" />
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          </motion.div>
        ) : summary.leavesByType.length > 0 ? (
          <motion.div
            variants={item}
            className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-md shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800"
          >
            <h2 className="text-heading-sm mb-3">
              รายชื่อครูที่ลาวันนี้
            </h2>
            <motion.div variants={listContainer} className="space-y-1">
              <AnimatePresence>
                {todayTeachers.map((teacher) => {
                  const leaveType = teacher.type as LeaveType;
                  const typeColors = LEAVE_TYPE_COLORS[leaveType] ?? LEAVE_TYPE_COLORS.other;
                  const typeLabel =
                    leaveType === 'other' && teacher.customTypeName
                      ? teacher.customTypeName
                      : LEAVE_TYPE_LABELS[leaveType] ?? LEAVE_TYPE_LABELS.other;

                  return (
                    <motion.div
                      key={teacher.id}
                      layout="position"
                      variants={row}
                      exit="exit"
                      className="flex items-center gap-2 min-w-0 rounded-lg px-2 -mx-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-default"
                    >
                      <span className="text-muted flex-shrink-0" aria-hidden>–</span>
                      <span className="min-w-0 truncate font-medium text-body-sm">
                        {teacher.firstName} {teacher.lastName}
                      </span>
                      {teacher.department && (
                        <span className="text-caption text-secondary flex-shrink-0">
                          ({teacher.department})
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 text-caption rounded border flex-shrink-0 ${typeColors.light} ${typeColors.dark}`}>
                        {typeLabel}
                      </span>
                      {teacher.isHalfDay && teacher.halfDayPeriod && (
                        <span className="px-1.5 py-0.5 text-caption bg-slate-100 dark:bg-slate-800 text-secondary rounded flex-shrink-0">
                          {HALF_DAY_PERIOD_LABELS[teacher.halfDayPeriod]}
                        </span>
                      )}
                      <LeaveStatusIcon status={teacher.status} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            variants={item}
            className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 rounded-xl p-8 text-center border border-sky-100 dark:border-sky-900/50 shadow-lg shadow-sky-100/50 dark:shadow-sky-950/50"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-sky-100 dark:bg-sky-900/50 rounded-full flex items-center justify-center">
              <Calendar className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="text-heading-md mb-2">
              ไม่มีครูลาวันนี้
            </h3>
            <p className="text-body-sm text-secondary">
              ทุกคนมาปฏิบัติงานครบ
            </p>
          </motion.div>
        )}

        {/* Heatmap Calendar */}
        <motion.div
          variants={item}
          className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-md shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800"
        >
          <h2 className="text-heading-sm mb-3">
            ปฏิทินการลารายเดือน
          </h2>
          <HeatmapCalendar
            data={heatmapCounts}
            currentDate={currentHeatmapDate}
            clickable={true}
            onMonthChange={handleHeatmapMonthChange}
            onDayClick={handleDayClick}
            holidays={holidays}
          />
          <LeaveStatusIconLegend className="pt-3" />
        </motion.div>

        {/* Modal for day details */}
        <AnimatePresence>
          {selectedDate && (
            <BottomSheet
              key={selectedDate}
              title={formatFullThaiDate(new Date(selectedDate))}
              onClose={closeModal}
            >
              {selectedDayLeaves.length === 0 ? (
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
                            <LeaveStatusIcon status={leave.status} />
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
            </BottomSheet>
          )}
        </AnimatePresence>
      </motion.main>

      {/* CTA buttons */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.3 }}
        className="fixed bottom-0 left-0 right-0 p-3 pb-safe bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)]"
      >
        <div className="max-w-4xl mx-auto flex gap-2">
          <motion.div
            className="flex-1"
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            variants={{
              rest: { y: 0, scale: 1 },
              hover: { y: -2, scale: 1.02 },
              tap: { y: 0, scale: 0.96 },
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Link
              href="/verify"
              prefetch={false}
              className="relative flex items-center justify-center gap-2 overflow-hidden py-3.5 bg-orange-500 hover:bg-orange-600 text-white text-center font-semibold rounded-lg shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-[background-color,box-shadow]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] motion-safe:animate-sheen"
              />
              <span className="relative">ยื่นใบลา</span>
              <motion.span
                aria-hidden="true"
                className="relative inline-flex"
                variants={{
                  rest: { x: 0, y: 0 },
                  hover: { x: 3, y: -3 },
                  tap: { x: 14, y: -14, opacity: 0.6 },
                }}
              >
                <Rocket className="w-5 h-5" />
              </motion.span>
            </Link>
          </motion.div>
          <Link
            href="/hr/login"
            prefetch={false}
            className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-center font-medium rounded-lg shadow-md shadow-slate-200/50 dark:shadow-slate-950/50 hover:shadow-lg transition-all active:scale-[0.98]"
          >
            เจ้าหน้าที่
          </Link>
        </div>
      </motion.div>
    </div>
    </MotionConfig>
  );
}
