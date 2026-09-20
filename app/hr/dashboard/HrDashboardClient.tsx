'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Users,
  UserMinus,
  Calendar,
  Clock,
  AlertTriangle,
  FileText,
  UserPlus,
  Settings,
  LogOut,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  KeyRound
} from 'lucide-react';
import { toast } from 'sonner';
import { CountUp } from '@/components/CountUp';
import { formatFullThaiDate, formatThaiDate } from '@/lib/thaiDate';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import { format, addMonths, subMonths, startOfMonth, getDay } from 'date-fns';

interface HrDashboardClientProps {
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
    createdAt: number;
  };
}

interface DashboardSummary {
  totalTeachers: number;
  attendingToday: number;
  leavesToday: number;
  leavesTomorrow: number;
  pendingCount: number;
  exceedingCount: number;
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
    type: string;
    customTypeName: string | null;
    isHalfDay: boolean;
    halfDayPeriod: string | null;
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
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);
  const [modalType, setModalType] = useState<'pending' | 'today' | 'tomorrow' | null>(null);
  const [modalData, setModalData] = useState<any[]>([]);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchLeavesToday();
    fetchHeatmap();
  }, []);

  useEffect(() => {
    fetchHeatmap();
  }, [selectedMonth]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/hr/dashboard/summary');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeavesToday = async () => {
    try {
      setLoadingLeaves(true);
      const response = await fetch('/api/hr/dashboard/leaves-today');
      if (response.ok) {
        const data = await response.json();
        setLeavesToday(data.leaves || []);
      }
    } catch (error) {
      console.error('Error fetching leaves today:', error);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const fetchHeatmap = async () => {
    try {
      setLoadingHeatmap(true);
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;

      // Fetch heatmap data
      const response = await fetch(`/api/hr/dashboard/heatmap?year=${year}&month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setHeatmapData(data.heatmap || []);
      }

      // Fetch holidays
      const holidaysResponse = await fetch(`/api/public/holidays?year=${year}&month=${month}`);
      if (holidaysResponse.ok) {
        const data = await holidaysResponse.json();
        const holidayMap = new Map<string, string>(
          data.holidays.map((h: { date: string; name: string }) => [
            h.date.split('T')[0],
            h.name
          ])
        );
        setHolidays(holidayMap);
      }
    } catch (error) {
      console.error('Error fetching heatmap:', error);
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

  const menuItems = [
    { icon: Clock, label: 'รออนุมัติ', href: '/hr/approvals', badge: summary?.pendingCount },
    { icon: FileText, label: 'ใบลาทั้งหมด', href: '/hr/leaves' },
    { icon: UserPlus, label: 'ยื่นใบลาแทนครู', href: '/hr/leave/new' },
    { icon: Users, label: 'จัดการครู', href: '/hr/teachers' },
    { icon: BarChart3, label: 'รายงาน', href: '/hr/reports' },
    { icon: Settings, label: 'ตั้งค่า', href: '/hr/settings' },
  ];

  if (user.role === 'super_admin') {
    menuItems.push({ icon: Settings, label: 'Super Admin', href: '/hr/admin' });
  }

  return (
    <HrLayoutWrapper
      hrUser={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
      }}
      pendingCount={summary?.pendingCount || 0}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 lg:pb-4">
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
              {formatFullThaiDate(new Date())}
            </p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          {/* Stats cards */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-4 h-28 animate-pulse" />
              ))}
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Attending */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all"
                onClick={() => router.push('/hr/teachers')}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    มาปฏิบัติงาน
                  </h3>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                  <CountUp end={summary.attendingToday} /> <span className="text-base text-slate-500 font-normal ml-1">คน</span>
                </p>
              </motion.div>

              {/* Pending */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={async () => {
                  try {
                    const res = await fetch('/api/hr/leaves?status=pending');
                    const data = await res.json();
                    setModalData(data.leaves || []);
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
                    รออนุมัติ
                  </h3>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                  <CountUp end={summary.pendingCount} /> <span className="text-base text-slate-500 font-normal ml-1">ใบ</span>
                </p>
              </motion.div>

              {/* Leaves today */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/hr/dashboard/leaves-today');
                    const data = await res.json();
                    setModalData(data.leaves || []);
                    setModalType('today');
                  } catch (error) {
                    toast.error('ไม่สามารถโหลดข้อมูลได้');
                  }
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
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                  <CountUp end={summary.leavesToday} /> <span className="text-base text-slate-500 font-normal ml-1">คน</span>
                </p>
              </motion.div>

              {/* Leaves tomorrow */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/hr/dashboard/leaves-tomorrow');
                    const data = await res.json();
                    setModalData(data.leaves || []);
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
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                  <CountUp end={summary.leavesTomorrow} /> <span className="text-base text-slate-500 font-normal ml-1">คน</span>
                </p>
              </motion.div>

              {/* Exceeding */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-red-300 dark:hover:border-red-700 hover:shadow-md transition-all"
                onClick={() => router.push('/hr/teachers?filter=exceeding')}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    เกินเกณฑ์
                  </h3>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                  <CountUp end={summary.exceedingCount} /> <span className="text-base text-slate-500 font-normal ml-1">คน</span>
                </p>
              </motion.div>
            </div>
          ) : null}

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
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                {leave.teacher.name}
                              </p>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                • {leave.teacher.department || 'ไม่ระบุกลุ่มสาระ'}
                              </span>
                              <span className={`px-1.5 py-0.5 text-xs rounded ${typeColors[leave.type]}`}>
                                {leave.type === 'other' && leave.customTypeName ? leave.customTypeName : typeLabels[leave.type]}
                              </span>
                              {leave.isHalfDay && (
                                <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
            >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ปฏิทินการลา
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="เดือนก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 min-w-[120px] text-center">
                  {formatThaiDate(selectedMonth, 'MMMM yyyy')}
                </span>
                <button
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="เดือนถัดไป"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {loadingHeatmap ? (
              <div className="animate-pulse space-y-2">
                <div className="grid grid-cols-7 gap-1">
                  {[...Array(35)].map((_, i) => (
                    <div key={i} className="h-10 bg-slate-200 dark:bg-slate-800 rounded" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Empty cells for days before month starts */}
                  {[...Array(getDay(startOfMonth(selectedMonth)))].map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}

                  {/* Day cells */}
                  {heatmapData.map((day) => {
                    const date = new Date(day.date);
                    const dayNum = date.getDate();
                    const isToday = format(new Date(), 'yyyy-MM-dd') === day.date;
                    const count = day.count;
                    const holidayName = holidays.get(day.date);
                    const isHoliday = !!holidayName;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                    let bgColor = 'bg-slate-50 dark:bg-slate-800/30';
                    let hoverColor = 'hover:bg-slate-100 dark:hover:bg-slate-800/50';
                    if (count > 0 && count <= 2) {
                      bgColor = 'bg-sky-100 dark:bg-sky-900/30';
                      hoverColor = 'hover:bg-sky-200 dark:hover:bg-sky-900/50';
                    }
                    if (count > 2 && count <= 5) {
                      bgColor = 'bg-sky-200 dark:bg-sky-800/50';
                      hoverColor = 'hover:bg-sky-300 dark:hover:bg-sky-800/70';
                    }
                    if (count > 5 && count <= 10) {
                      bgColor = 'bg-sky-300 dark:bg-sky-700/70';
                      hoverColor = 'hover:bg-sky-400 dark:hover:bg-sky-700/90';
                    }
                    if (count > 10) {
                      bgColor = 'bg-sky-500 dark:bg-sky-600';
                      hoverColor = 'hover:bg-sky-600 dark:hover:bg-sky-700';
                    }

                    return (
                      <div key={day.date} className="relative group">
                        <button
                          onClick={() => count > 0 && setSelectedDay(day)}
                          className={`
                            relative h-12 rounded-lg transition-all text-sm font-semibold w-full
                            ${bgColor}
                            ${count > 0 ? `cursor-pointer ${hoverColor} hover:scale-105 hover:shadow-md` : 'cursor-default'}
                            ${isToday ? 'ring-2 ring-orange-500 dark:ring-orange-400 ring-offset-1' : ''}
                            ${count > 10 ? 'text-white' : isWeekend ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}
                          `}
                        >
                          <span className={`block ${isHoliday ? 'line-through decoration-red-600 dark:decoration-red-400 decoration-2' : ''}`}>
                            {dayNum}
                          </span>
                          {count > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 dark:bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900">
                              {count}
                            </span>
                          )}
                        </button>

                        {/* Holiday Tooltip */}
                        {isHoliday && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="bg-gradient-to-br from-red-900 to-red-800 dark:from-red-100 dark:to-red-50 text-white dark:text-red-900 text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                              <div className="font-bold">{holidayName}</div>
                              {/* Arrow */}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                                <div className="border-4 border-transparent border-t-red-800 dark:border-t-red-50" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend - Compact */}
                <div className="flex items-center gap-3 pt-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                  <span className="font-medium">คนลา:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700" />
                    <span>0</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-sky-100 dark:bg-sky-900/30" />
                    <span>1-2</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-sky-200 dark:bg-sky-800/50" />
                    <span>3-5</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-sky-300 dark:bg-sky-700/70" />
                    <span>6-10</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-sky-500 dark:bg-sky-600" />
                    <span>10+</span>
                  </div>
                </div>
              </div>
            )}
            </motion.div>
          </div>

          {/* Stats Cards Modal */}
          {modalType && (
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
              onClick={() => {
                setModalType(null);
                setModalData([]);
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {modalType === 'pending' && 'ใบลารออนุมัติ'}
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
                  {modalData.length > 0 ? `ทั้งหมด ${modalData.length} รายการ` : 'ไม่มีข้อมูล'}
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

                      const statusColors: Record<string, string> = {
                        pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      };

                      const statusLabels: Record<string, string> = {
                        pending: 'รออนุมัติ',
                        approved: 'อนุมัติแล้ว',
                        rejected: 'ไม่อนุมัติ'
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
                            {modalType === 'pending' && (
                              <span className={`px-1.5 py-0.5 text-xs rounded ${statusColors[item.status]}`}>
                                {statusLabels[item.status]}
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
          )}

          {/* Selected Day Detail Modal */}
          {selectedDay && (
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
              onClick={() => setSelectedDay(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {formatThaiDate(new Date(selectedDay.date), 'd MMMM yyyy')}
                  </h3>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-slate-500 text-xl">×</span>
                  </button>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  มีครู {selectedDay.count} คนลาในวันนี้
                </p>

                <div className="space-y-2">
                  {selectedDay.leaves.map((leave) => {
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
                      onClick={() => {
                        setSelectedDay(null);
                        router.push(`/hr/leaves/${leave.id}`);
                      }}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                            {leave.teacher.name}
                          </p>
                          {leave.teacher.department && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              • {leave.teacher.department}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-xs rounded ${typeColors[leave.type]}`}>
                            {leave.type === 'other' && leave.customTypeName ? leave.customTypeName : typeLabels[leave.type]}
                          </span>
                          {leave.isHalfDay && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              {leave.halfDayPeriod === 'morning' ? 'ครึ่งเช้า' : 'ครึ่งบ่าย'}
                            </span>
                          )}
                        </div>
                        <Eye className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </div>
                    </div>
                  );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </main>

        {/* Change Password Dialog */}
        {showChangePassword && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => {
              if (!changingPassword) {
                setShowChangePassword(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md"
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
        )}
      </div>
    </HrLayoutWrapper>
  );
}
