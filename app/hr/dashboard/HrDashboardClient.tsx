'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserMinus,
  Calendar,
  Clock,
  FileText,
  LogOut,
  Eye,
  X,
  KeyRound,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { LeaveStatusIcon, LeaveStatusIconLegend } from '@/components/LeaveStatusIcon';
import { toast } from 'sonner';
import { CountUp } from '@/components/CountUp';
import { formatFullThaiDate } from '@/lib/thaiDate';
import { Modal } from '@/components/Modal';
import { clearClientCaches } from '@/lib/clearClientCaches';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import { HeatmapCalendar } from '@/components/HeatmapCalendar';
import { type HrRole } from '@/lib/roles';
import {
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_COLORS,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  HALF_DAY_PERIOD_LABELS,
  type LeaveStatus,
  type LeaveType,
  type HalfDayPeriod,
} from '@/types/leave';

interface HrDashboardClientProps {
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    role: HrRole;
    createdAt: number;
  };
}

interface DashboardSummary {
  totalTeachers: number;
  attendingToday: number;
  leavesToday: number;
  leavesTomorrow: number;
  pendingCount: number;
  reviewedCount: number;
}

interface LeaveToday {
  id: string;
  leaveNo: string;
  teacher: {
    id: string;
    code: string;
    name: string;
    department: string | null;
  };
  type: 'sick' | 'personal' | 'maternity' | 'religious' | 'other';
  customTypeName: string | null;
  startDate: string;
  endDate: string;
  daysWorking: number;
  daysCalendar: number;
  isHalfDay: boolean;
  halfDayPeriod: 'morning' | 'afternoon' | null;
  reason: string;
  contactAddress: string;
  submittedByType: 'teacher' | 'hr';
  status: LeaveStatus;
}

interface HeatmapDay {
  date: string;
  count: number;
  leaves: Array<{
    id: string;
    leaveNo: string;
    teacher: {
      id: string;
      code: string;
      name: string;
      department: string | null;
    };
    type: LeaveType;
    customTypeName: string | null;
    isHalfDay: boolean;
    halfDayPeriod: HalfDayPeriod | null;
    status: LeaveStatus;
  }>;
}

export default function HrDashboardClient({ user }: HrDashboardClientProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [leavesToday, setLeavesToday] = useState<LeaveToday[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [holidays, setHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);
  const [modalType, setModalType] = useState<'pending' | 'approval' | 'today' | 'tomorrow' | null>(null);
  const [modalData, setModalData] = useState<any[]>([]);
  const [modalTotal, setModalTotal] = useState<number | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(false);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fix hydration mismatch - set current date only on client
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Summary + leaves today do not depend on the selected month, so load them once
  useEffect(() => {
    fetchSummaryData();
  }, []);

  // Prefetch approvals routes after dashboard loads
  useEffect(() => {
    if (!loading && summary) {
      router.prefetch('/hr/reviews');
      router.prefetch('/hr/approvals');
      router.prefetch('/hr/leaves');
    }
  }, [loading, summary, router]);
  
  // Intersection Observer for lazy loading heatmap
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isHeatmapVisible) {
            setIsHeatmapVisible(true);
          }
        });
      },
      { rootMargin: '100px' } // Start loading 100px before heatmap is visible
    );

    const currentRef = heatmapRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [isHeatmapVisible]);

  // Fetch heatmap when it scrolls into view and whenever the month changes
  useEffect(() => {
    if (isHeatmapVisible) {
      fetchHeatmapData();
    }
  }, [isHeatmapVisible, selectedMonth]);

  const heatmapCounts = useMemo(
    () => Object.fromEntries(heatmapData.map((day) => [day.date, day.count])),
    [heatmapData]
  );

  const refreshData = () =>
    Promise.all([fetchSummaryData(false), isHeatmapVisible ? fetchHeatmapData(false) : null]);

  const { pull, state: pullState, threshold: pullThreshold } = usePullToRefresh(refreshData);

  const handleRefreshClick = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const fetchSummaryData = async (showSkeleton = true) => {
    try {
      if (showSkeleton) {
        setLoading(true);
        setLoadingLeaves(true);
      }

      const response = await fetch('/api/hr/dashboard/all');
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setSummary(data.summary);
      setLeavesToday(data.leavesToday || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
      setLoadingLeaves(false);
    }
  };

  const fetchHeatmapData = async (showSkeleton = true) => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth() + 1;

    try {
      if (showSkeleton) setLoadingHeatmap(true);

      const [heatmapRes, holidaysRes] = await Promise.all([
        fetch(`/api/hr/dashboard/heatmap?year=${year}&month=${month}`).then((res) => res.json()),
        fetch(`/api/public/holidays?year=${year}&month=${month}`).then((res) => res.json()),
      ]);

      setHeatmapData(heatmapRes.heatmap || []);
      setHolidays(holidaysRes.holidays || []);
    } catch (err) {
      console.error('Failed to fetch heatmap:', err);
    } finally {
      setLoadingHeatmap(false);
    }
  };


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

  const handleChangePassword = async () => {
    if (changingPassword) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    try {
      setChangingPassword(true);

      const response = await fetch('/api/auth/hr/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Change password error:', error);
      toast.error('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <HrLayoutWrapper
      hrUser={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
      }}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 lg:pb-4">
        <PullToRefreshIndicator pull={pull} state={pullState} threshold={pullThreshold} />
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-start gap-3 mb-2">
              <img
                src="/icons/icon-192.png"
                alt="Logo"
                className="w-[60px] h-[60px] rounded-lg flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Dashboard
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {user.firstName} {user.lastName} ({user.role === 'super_admin' ? 'Super Admin' : 'HR'})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefreshClick}
                  disabled={refreshing || loading}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                  aria-label="รีเฟรชข้อมูล"
                >
                  <RefreshCw
                    className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${refreshing ? 'animate-spin' : ''}`}
                  />
                </button>
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 flex-shrink-0"
                  aria-label="เปลี่ยนรหัสผ่าน"
                >
                  <KeyRound className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                  aria-label="ออกจากระบบ"
                >
                  <LogOut className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentDate ? formatFullThaiDate(currentDate) : ''}
            </p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Attending */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-2 lg:col-span-1 bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all"
              onClick={() => !loading && router.push('/hr/teachers')}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  มาปฏิบัติงาน
                </h3>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none flex items-center gap-2">
                {loading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                ) : summary ? (
                  <>
                    <CountUp end={summary.attendingToday} />
                    <span className="text-xl text-slate-400 font-normal">/{summary.totalTeachers}</span>
                    <span className="text-base text-slate-500 font-normal ml-1">คน</span>
                  </>
                ) : (
                  <span className="text-xl text-slate-400">-</span>
                )}
              </div>
            </motion.div>

            {/* Leaves today */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all"
              onClick={() => {
                if (loading) return;
                setModalData(leavesToday);
                setModalTotal(null);
                setModalType('today');
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                  <UserMinus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  ลาวันนี้
                </h3>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none flex items-center gap-2">
                {loading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                ) : summary ? (
                  <>
                    <CountUp end={summary.leavesToday} /> <span className="text-base text-slate-500 font-normal ml-1">คน</span>
                  </>
                ) : (
                  <span className="text-xl text-slate-400">-</span>
                )}
              </div>
            </motion.div>

            {/* Leaves tomorrow */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all"
              onClick={async () => {
                if (loading) return;
                try {
                  const res = await fetch('/api/hr/dashboard/leaves-tomorrow');
                  const data = await res.json();
                  setModalData(data.leaves || []);
                  setModalTotal(null);
                  setModalType('tomorrow');
                } catch (error) {
                  toast.error('ไม่สามารถโหลดข้อมูลได้');
                }
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  ลาพรุ่งนี้
                </h3>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none flex items-center gap-2">
                {loading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                ) : summary ? (
                  <>
                    <CountUp end={summary.leavesTomorrow} /> <span className="text-base text-slate-500 font-normal ml-1">คน</span>
                  </>
                ) : (
                  <span className="text-xl text-slate-400">-</span>
                )}
              </div>
            </motion.div>
            {/* Pending */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={async () => {
                if (loading) return;
                try {
                  const res = await fetch('/api/hr/leaves?status=pending&limit=100');
                  const data = await res.json();
                  setModalData(data.leaves || []);
                  setModalTotal(data.pagination?.total ?? null);
                  setModalType('pending');
                } catch (error) {
                  toast.error('ไม่สามารถโหลดข้อมูลได้');
                }
              }}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  รอตรวจสอบ
                </h3>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none flex items-center gap-2">
                {loading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                ) : summary ? (
                  <>
                    <CountUp end={summary.pendingCount} /> <span className="text-base text-slate-500 font-normal ml-1">ใบ</span>
                  </>
                ) : (
                  <span className="text-xl text-slate-400">-</span>
                )}
              </div>
            </motion.div>

            {/* Awaiting approval */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onClick={async () => {
                if (loading) return;
                try {
                  const res = await fetch('/api/hr/leaves?status=reviewed&limit=100');
                  const data = await res.json();
                  setModalData(data.leaves || []);
                  setModalTotal(data.pagination?.total ?? null);
                  setModalType('approval');
                } catch (error) {
                  toast.error('ไม่สามารถโหลดข้อมูลได้');
                }
              }}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                  <Clock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  รออนุมัติ
                </h3>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none flex items-center gap-2">
                {loading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                ) : summary ? (
                  <>
                    <CountUp end={summary.reviewedCount} /> <span className="text-base text-slate-500 font-normal ml-1">ใบ</span>
                  </>
                ) : (
                  <span className="text-xl text-slate-400">-</span>
                )}
              </div>
            </motion.div>

          </div>

          {/* Two-column layout: Leaves Today + Heatmap Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" id="leaves-today-section">
            {/* Leaves Today List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
            >
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
                ครูที่ลาวันนี้ ({leavesToday.length} คน)
              </h2>

              {leavesToday.length > 0 ? (
                <div className="space-y-2">
                  {leavesToday.map((leave) => {
                    const typeLabels: Record<string, string> = {
                      sick: 'ลาป่วย',
                      personal: 'ลากิจ',
                      maternity: 'ลาคลอด',
                      religious: 'ลาทางศาสนา',
                      other: 'อื่นๆ'
                    };

                    const typeColors: Record<string, string> = {
                      sick: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      personal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      maternity: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
                      religious: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                      other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    };

                    return (
                      <div
                        key={leave.id}
                        onClick={() => router.push(`/hr/leaves/${leave.id}`)}
                        className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-nowrap">
                              <span className="shrink-0">
                                <LeaveStatusIcon status={leave.status} />
                              </span>
                              <p className="font-medium text-sm text-slate-900 dark:text-slate-100 shrink-0 whitespace-nowrap">
                                {leave.teacher.name}
                              </p>
                              <span className="text-xs text-slate-500 dark:text-slate-400 min-w-0 truncate">
                                • {leave.teacher.department || 'ไม่ระบุกลุ่มสาระ'}
                              </span>
                              <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 whitespace-nowrap ${typeColors[leave.type]}`}>
                                {leave.type === 'other' && leave.customTypeName ? leave.customTypeName : typeLabels[leave.type]}
                              </span>
                              {leave.isHalfDay && (
                                <span className="px-1.5 py-0.5 text-xs rounded shrink-0 whitespace-nowrap bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  {leave.halfDayPeriod === 'morning' ? 'ครึ่งเช้า' : 'ครึ่งบ่าย'}
                                </span>
                              )}
                            </div>
                          </div>
                          <Eye className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                          <span className="font-medium">รายละเอียด:</span> {leave.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-base font-medium text-slate-900 dark:text-slate-100 mb-1">
                    ไม่มีครูลาวันนี้
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                    ครูทุกคนมาปฏิบัติงานครบ
                  </p>
                </div>
              )}
            </motion.div>

            {/* Heatmap Calendar */}
            <motion.div
              ref={heatmapRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
            >
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
                ปฏิทินการลา
              </h2>
              <HeatmapCalendar
                data={heatmapCounts}
                currentDate={selectedMonth}
                onMonthChange={setSelectedMonth}
                onDayClick={(date) => {
                  const day = heatmapData.find((d) => d.date === date);
                  if (day) setSelectedDay(day);
                }}
                holidays={holidays}
                loading={loadingHeatmap}
              />
              <LeaveStatusIconLegend className="pt-3" />
            </motion.div>
          </div>

          {/* Stats Cards Modal */}
          <AnimatePresence>
          {modalType && (
            <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setModalType(null);
                setModalData([]);
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {modalType === 'pending' && 'ใบลารอตรวจสอบ'}
                    {modalType === 'approval' && 'ใบลารออนุมัติ'}
                    {modalType === 'today' && 'ครูที่ลาวันนี้'}
                    {modalType === 'tomorrow' && 'ครูที่ลาพรุ่งนี้'}
                  </h3>
                  <button
                    onClick={() => {
                      setModalType(null);
                      setModalData([]);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  {modalData.length === 0
                    ? 'ไม่มีข้อมูล'
                    : modalTotal !== null && modalTotal > modalData.length
                      ? `แสดง ${modalData.length} จากทั้งหมด ${modalTotal} รายการ (เปิดหน้าตรวจสอบ/อนุมัติเพื่อดูทั้งหมด)`
                      : `ทั้งหมด ${modalData.length} รายการ`}
                </p>

                {modalData.length > 0 ? (
                  <div className="space-y-2">
                    {modalData.map((item: any) => {
                      const typeLabels: Record<string, string> = {
                        sick: 'ลาป่วย',
                        personal: 'ลากิจ',
                        maternity: 'ลาคลอด',
                        religious: 'ลาทางศาสนา',
                        other: 'อื่นๆ'
                      };

                      const typeColors: Record<string, string> = {
                        sick: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        personal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        maternity: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
                        religious: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                        other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      };

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setModalType(null);
                            setModalData([]);
                            router.push(`/hr/leaves/${item.id}`);
                          }}
                          className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                  {item.teacher?.name || item.teacher?.firstName + ' ' + item.teacher?.lastName}
                                </p>
                                {item.teacher?.department && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    • {item.teacher.department}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Eye className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 text-xs rounded ${typeColors[item.type]}`}>
                              {item.type === 'other' && item.customTypeName ? item.customTypeName : typeLabels[item.type]}
                            </span>
                            {modalType !== 'pending' && modalType !== 'approval' && <LeaveStatusIcon status={item.status} />}
                            {(modalType === 'pending' || modalType === 'approval') && (
                              <span className={`px-1.5 py-0.5 text-xs rounded border ${LEAVE_STATUS_COLORS[item.status as LeaveStatus].light} ${LEAVE_STATUS_COLORS[item.status as LeaveStatus].dark}`}>
                                {LEAVE_STATUS_LABELS[item.status as LeaveStatus]}
                              </span>
                            )}
                            {item.isHalfDay && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                {item.halfDayPeriod === 'morning' ? 'ครึ่งเช้า' : 'ครึ่งบ่าย'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">ไม่มีข้อมูล</p>
                  </div>
                )}
              </motion.div>
            </div>
            </>
          )}
          </AnimatePresence>

          {/* Selected Day Detail Modal */}
          <AnimatePresence>
          {selectedDay && (
            <Modal
              key={selectedDay.date}
              title={formatFullThaiDate(new Date(selectedDay.date))}
              onClose={() => setSelectedDay(null)}
            >
              <p className="text-body-sm text-secondary mb-3">
                มีครู {selectedDay.count} คนลาในวันนี้
              </p>

              <div className="space-y-2">
                {selectedDay.leaves.map((leave) => {
                  const colorClass = LEAVE_TYPE_COLORS[leave.type] ?? LEAVE_TYPE_COLORS.other;
                  const typeLabel = leave.type === 'other' && leave.customTypeName
                    ? leave.customTypeName
                    : LEAVE_TYPE_LABELS[leave.type] ?? LEAVE_TYPE_LABELS.other;

                  return (
                    <div
                      key={leave.id}
                      onClick={() => {
                        setSelectedDay(null);
                        router.push(`/hr/leaves/${leave.id}`);
                      }}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <LeaveStatusIcon status={leave.status} />
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100 min-w-0 max-w-[55%] flex-shrink-0 truncate" title={leave.teacher.name}>
                            {leave.teacher.name}
                          </p>
                          {leave.teacher.department && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 min-w-0 flex-1 truncate" title={leave.teacher.department}>
                              • {leave.teacher.department}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 ${colorClass.light} ${colorClass.dark}`}>
                            {typeLabel}
                          </span>
                          {leave.isHalfDay && leave.halfDayPeriod && (
                            <span className="px-1.5 py-0.5 text-xs rounded flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              {HALF_DAY_PERIOD_LABELS[leave.halfDayPeriod]}
                            </span>
                          )}
                        </div>
                        <Eye className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Modal>
          )}
          </AnimatePresence>
        </main>

        {/* Change Password Dialog */}
        <AnimatePresence>
        {showChangePassword && (
          <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!changingPassword) {
                setShowChangePassword(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }
            }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  เปลี่ยนรหัสผ่าน
                </h3>
                <button
                  onClick={() => {
                    if (!changingPassword) {
                      setShowChangePassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }
                  }}
                  disabled={changingPassword}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    รหัสผ่านปัจจุบัน
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={changingPassword}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                    placeholder="กรอกรหัสผ่านปัจจุบัน"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    รหัสผ่านใหม่
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={changingPassword}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    ยืนยันรหัสผ่านใหม่
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={changingPassword}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (!changingPassword) {
                        setShowChangePassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }
                    }}
                    disabled={changingPassword}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="flex-1 px-4 py-2 bg-sky-600 dark:bg-sky-500 text-white rounded-lg hover:bg-sky-700 dark:hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {changingPassword ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
          </>
        )}
        </AnimatePresence>
      </div>
    </HrLayoutWrapper>
  );
}
