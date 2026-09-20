'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  X,
  Calendar,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveStatus, LeaveType, HalfDayPeriod } from '@/types/leave';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_COLORS,
  HALF_DAY_PERIOD_LABELS,
} from '@/types/leave';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import { formatThaiDateShort } from '@/lib/thaiDate';
import {
  getCurrentFiscalYearAndRound,
  getRecentFiscalYears,
  getFiscalRoundDateRange,
} from '@/lib/fiscalYear';

interface LeavesClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
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
  halfDayPeriod?: HalfDayPeriod;
  daysWorking: number;
  daysCalendar: number;
  reason: string;
  contactAddress: string;
  status: LeaveStatus;
  rejectionReason?: string;
  submittedByType: 'teacher' | 'hr';
  submittedByHr?: {
    firstName: string;
    lastName: string;
  };
  teacher: {
    teacherCode: string;
    title: string;
    firstName: string;
    lastName: string;
    position: string;
    department?: string;
  };
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
  createdAt: string;
  approvedAt?: string;
  printedAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function LeavesClient({ hrUser }: LeavesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [expandedLeaves, setExpandedLeaves] = useState<Set<string>>(new Set());

  // Get default fiscal year and round
  const defaultFiscalData = getCurrentFiscalYearAndRound();
  const availableFiscalYears = getRecentFiscalYears(4);

  // Filter states
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState<LeaveStatus | 'all'>(
    (searchParams.get('status') as LeaveStatus) || 'all'
  );
  const [type, setType] = useState<LeaveType | 'all'>(
    (searchParams.get('type') as LeaveType) || 'all'
  );
  const [submittedBy, setSubmittedBy] = useState<'teacher' | 'hr' | 'all'>(
    (searchParams.get('submittedBy') as 'teacher' | 'hr' | 'all') || 'all'
  );
  const [department, setDepartment] = useState(searchParams.get('department') || '');
  const [fiscalYear, setFiscalYear] = useState(
    searchParams.get('fiscalYear') || defaultFiscalData.fiscalYear.toString()
  );
  const [round, setRound] = useState<'1' | '2' | 'all'>(
    (searchParams.get('round') as '1' | '2' | 'all') || defaultFiscalData.round.toString() as '1' | '2'
  );
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');

  // Loading states for quick actions
  const [quickPDFLoading, setQuickPDFLoading] = useState<string | null>(null);
  const [quickDeleteLoading, setQuickDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaves();
    fetchStats();
    fetchDepartments();
  }, [searchParams]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(searchParams.toString());
      const res = await fetch(`/api/hr/leaves?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      setLeaves(data.leaves);
      setPagination(data.pagination);
     
    } catch (error) {
      console.error('Failed to fetch leaves:', error);
      toast.error('ไม่สามารถโหลดรายการใบลาได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams(searchParams.toString());
      const res = await fetch(`/api/hr/leaves/stats?${params}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/hr/teachers/active');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const uniqueDepts = Array.from(
        new Set(
          data.teachers
            .map((t: any) => t.department)
            .filter((d: string) => d)
        )
      ) as string[];
      setDepartments(uniqueDepts.sort());
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const applyFilters = (overrides?: { status?: LeaveStatus | 'all' }) => {
    const params = new URLSearchParams();
    const finalStatus = overrides?.status !== undefined ? overrides.status : status;

    if (search) params.set('search', search);
    if (finalStatus !== 'all') params.set('status', finalStatus);
    if (type !== 'all') params.set('type', type);
    if (submittedBy !== 'all') params.set('submittedBy', submittedBy);
    if (department) params.set('department', department);
    if (fiscalYear) params.set('fiscalYear', fiscalYear);
    if (round !== 'all') params.set('round', round);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    params.set('page', '1');

    router.push(`/hr/leaves?${params.toString()}`);
    setShowFilter(false);
  };

  const clearFilters = () => {
    const defaultFiscalData = getCurrentFiscalYearAndRound();
    setSearch('');
    setStatus('all');
    setType('all');
    setSubmittedBy('all');
    setDepartment('');
    setFiscalYear(defaultFiscalData.fiscalYear.toString());
    setRound(defaultFiscalData.round.toString() as '1' | '2');
    setStartDate('');
    setEndDate('');
    setSortBy('createdAt');
    setSortOrder('desc');
    router.push('/hr/leaves');
    setShowFilter(false);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/hr/leaves?${params.toString()}`);
  };

  const hasActiveFilters = status !== 'all' || type !== 'all' || submittedBy !== 'all' || search !== '' || department !== '' || fiscalYear !== defaultFiscalData.fiscalYear.toString() || round !== defaultFiscalData.round.toString() || startDate !== '' || endDate !== '' || sortBy !== 'createdAt' || sortOrder !== 'desc';

  const toggleLeave = (leaveId: string) => {
    setExpandedLeaves((prev) => {
      const next = new Set(prev);
      if (next.has(leaveId)) {
        next.delete(leaveId);
      } else {
        next.add(leaveId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (expandedLeaves.size === leaves.length) {
      setExpandedLeaves(new Set());
    } else {
      setExpandedLeaves(new Set(leaves.map((l) => l.id)));
    }
  };

  const handleQuickPDF = async (leaveId: string, leaveNo: string) => {
    setQuickPDFLoading(leaveId);
    try {
      const res = await fetch(`/api/hr/leaves/${leaveId}/pdf`);
      if (!res.ok) throw new Error('Failed to generate PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

      toast.success('เปิด PDF สำเร็จ');

      // Refresh just this leave card to show printed status
      const updatedLeaveRes = await fetch(`/api/hr/leaves/${leaveId}`);
      if (updatedLeaveRes.ok) {
        const data = await updatedLeaveRes.json();
        setLeaves((prevLeaves) =>
          prevLeaves.map((leave) =>
            leave.id === leaveId ? data.leave : leave
          )
        );
      }
    } catch (error) {
      console.error('Failed to open PDF:', error);
      toast.error('ไม่สามารถเปิด PDF ได้');
    } finally {
      setQuickPDFLoading(null);
    }
  };

  const handleQuickDelete = async (leaveId: string, leaveNo: string) => {
    if (!confirm(`ยืนยันการลบใบลา ${leaveNo}?`)) return;

    setQuickDeleteLoading(leaveId);
    try {
      const res = await fetch(`/api/hr/admin/leaves/${leaveId}/delete`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      toast.success('ลบใบลาสำเร็จ');
      fetchLeaves();
      fetchStats();
    } catch (error) {
      console.error('Failed to delete leave:', error);
      toast.error('ไม่สามารถลบใบลาได้');
    } finally {
      setQuickDeleteLoading(null);
    }
  };

  const setDatePreset = (preset: 'today' | 'week' | 'month') => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    switch (preset) {
      case 'today':
        setStartDate(todayStr);
        setEndDate(todayStr);
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        const weekYYYY = weekAgo.getFullYear();
        const weekMM = String(weekAgo.getMonth() + 1).padStart(2, '0');
        const weekDD = String(weekAgo.getDate()).padStart(2, '0');
        setStartDate(`${weekYYYY}-${weekMM}-${weekDD}`);
        setEndDate(todayStr);
        break;
      case 'month':
        const monthStart = `${yyyy}-${mm}-01`;
        setStartDate(monthStart);
        setEndDate(todayStr);
        break;
    }
  };

  return (
    <HrLayoutWrapper hrUser={hrUser}>
      <div className="bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                รายการใบลาทั้งหมด
              </h1>
              {pagination && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  ทั้งหมด {pagination.total} ใบลา
                </p>
              )}
            </div>

            <button
              onClick={() => setShowFilter(!showFilter)}
              className="relative p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-sky-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="ค้นหาเลขที่ / ชื่อครู / รหัสครู"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Filter panel */}
        {showFilter && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
              {/* Sort options */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  เรียงตาม
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  >
                    <option value="createdAt">วันที่ยื่น</option>
                    <option value="startDate">วันที่ลา</option>
                    <option value="teacherName">ชื่อครู</option>
                    <option value="department">แผนก</option>
                    <option value="daysWorking">จำนวนวัน</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  >
                    <option value="desc">ใหม่ → เก่า</option>
                    <option value="asc">เก่า → ใหม่</option>
                  </select>
                </div>
              </div>

              {/* Fiscal Year and Round filter */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  ปีงบประมาณและรอบ
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(e.target.value)}
                    className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  >
                    {availableFiscalYears.map((year) => (
                      <option key={year} value={year}>
                        ปีงบ {year}
                      </option>
                    ))}
                  </select>
                  <select
                    value={round}
                    onChange={(e) => setRound(e.target.value as '1' | '2' | 'all')}
                    className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="1">รอบที่ 1 (ต.ค.-มี.ค.)</option>
                    <option value="2">รอบที่ 2 (เม.ย.-ก.ย.)</option>
                  </select>
                </div>
              </div>

              {/* Date range filter */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  ช่วงวันที่ลา (ระบุเอง)
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button
                    onClick={() => setDatePreset('today')}
                    className="px-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                  >
                    วันนี้
                  </button>
                  <button
                    onClick={() => setDatePreset('week')}
                    className="px-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                  >
                    7 วันล่าสุด
                  </button>
                  <button
                    onClick={() => setDatePreset('month')}
                    className="px-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                  >
                    เดือนนี้
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                      จาก
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                      ถึง
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Status filter */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  สถานะ
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => setStatus('all')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      status === 'all'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  {(['pending', 'approved', 'rejected'] as LeaveStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        status === s
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {LEAVE_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type filter */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  ประเภท
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setType('all')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      type === 'all'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  {(['sick', 'personal', 'maternity', 'religious', 'other'] as LeaveType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        type === t
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {LEAVE_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department filter */}
              {departments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    แผนก
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  >
                    <option value="">ทั้งหมด</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Submitted by filter */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  ยื่นโดย
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['all', 'teacher', 'hr'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSubmittedBy(s as any)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        submittedBy === s
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {s === 'all' ? 'ทั้งหมด' : s === 'teacher' ? 'ครูยื่นเอง' : 'HR ยื่นแทน'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-medium transition-colors"
                >
                  ล้างตัวกรอง
                </button>
                <button
                  onClick={() => applyFilters()}
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  ค้นหา
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {/* Stats Summary */}
        {stats && (
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => applyFilters({ status: 'pending' })}
              className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors text-left"
            >
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">รออนุมัติ</p>
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.byStatus.pending}
              </p>
            </button>
            <button
              onClick={() => applyFilters({ status: 'approved' })}
              className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-green-300 dark:hover:border-green-700 transition-colors text-left"
            >
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">อนุมัติแล้ว</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {stats.byStatus.approved}
              </p>
            </button>
            <button
              onClick={() => applyFilters({ status: 'rejected' })}
              className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700 transition-colors text-left"
            >
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ไม่อนุมัติ</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {stats.byStatus.rejected}
              </p>
            </button>
            <button
              onClick={() => applyFilters({ status: 'all' })}
              className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition-colors text-left"
            >
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ทั้งหมด</p>
              <p className="text-xl font-bold text-sky-600 dark:text-sky-400">
                {stats.byStatus.total}
              </p>
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 bg-white dark:bg-slate-900 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {hasActiveFilters ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีใบลาในระบบ'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {hasActiveFilters ? 'ลองปรับเกณฑ์การค้นหาใหม่' : 'รอครูยื่นใบลาครั้งแรก'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Toggle All Button */}
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                แสดง {expandedLeaves.size} / {leaves.length} รายการ
              </p>
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
              >
                {expandedLeaves.size === leaves.length ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>ซ่อนทั้งหมด</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>แสดงทั้งหมด</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-3">
              {leaves.map((leave, idx) => {
                const typeColors = LEAVE_TYPE_COLORS[leave.type];
                const statusColors = LEAVE_STATUS_COLORS[leave.status];
                const displayType =
                  leave.type === 'other' && leave.customTypeName
                    ? leave.customTypeName
                    : LEAVE_TYPE_LABELS[leave.type];
                const isExpanded = expandedLeaves.has(leave.id);

                return (
                  <motion.div
                    key={leave.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition-colors"
                  >
                    {/* Header - Always visible */}
                    <div
                      onClick={() => toggleLeave(leave.id)}
                      className="flex items-start justify-between mb-2 cursor-pointer p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded border ${typeColors.light} ${typeColors.dark}`}
                          >
                            {displayType}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded border ${statusColors.light} ${statusColors.dark}`}
                          >
                            {LEAVE_STATUS_LABELS[leave.status]}
                          </span>
                          {leave.isHalfDay && leave.halfDayPeriod && (
                            <span className="px-1.5 py-0.5 text-xs rounded border bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800">
                              {HALF_DAY_PERIOD_LABELS[leave.halfDayPeriod]}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {leave.teacher.title}{leave.teacher.firstName} {leave.teacher.lastName}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                            {formatThaiDateShort(new Date(leave.startDate))}
                            {new Date(leave.endDate).getTime() !==
                              new Date(leave.startDate).getTime() && (
                              <>
                                {' - '}
                                {formatThaiDateShort(new Date(leave.endDate))}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {leave.printedAt && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/20 rounded border border-emerald-200 dark:border-emerald-800">
                            <Printer className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs text-emerald-700 dark:text-emerald-300">พิมพ์แล้ว</span>
                          </div>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {leave.leaveNo}
                        </p>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expandable details */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-3 pb-3 border-t border-slate-200 dark:border-slate-800"
                      >
                        {/* Teacher info */}
                        <div className="flex items-center gap-2.5 mb-2 mt-3">
                          <div className="w-9 h-9 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {leave.teacher.teacherCode} • {leave.teacher.position}
                            </p>
                            {leave.teacher.department && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                {leave.teacher.department}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Days */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="text-xs">
                            <span className="text-slate-600 dark:text-slate-400">วันทำการ: </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {leave.daysWorking} วัน
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="text-slate-600 dark:text-slate-400">ปฏิทิน: </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {leave.daysCalendar} วัน
                            </span>
                          </div>
                        </div>

                        {/* Reason preview */}
                        <div className="mb-2">
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">เหตุผล:</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                            {leave.reason}
                          </p>
                        </div>

                        {/* Submitted by HR indicator */}
                        {leave.submittedByType === 'hr' && leave.submittedByHr && (
                          <div className="mb-2">
                            <p className="text-xs text-purple-600 dark:text-purple-400">
                              ยื่นแทนโดย: {leave.submittedByHr.firstName}{' '}
                              {leave.submittedByHr.lastName}
                            </p>
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          ยื่นเมื่อ{' '}
                          {formatThaiDateShort(new Date(leave.createdAt))}
                          {leave.approvedAt && (
                            <>
                              {' • อนุมัติเมื่อ '}
                              {formatThaiDateShort(new Date(leave.approvedAt))}
                            </>
                          )}
                          {leave.printedAt && (
                            <>
                              {' • พิมพ์เมื่อ '}
                              {formatThaiDateShort(new Date(leave.printedAt))}
                            </>
                          )}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/hr/leaves/${leave.id}`);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>ดูรายละเอียด</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickPDF(leave.id, leave.leaveNo);
                            }}
                            disabled={quickPDFLoading === leave.id}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {quickPDFLoading === leave.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {hrUser.role === 'super_admin' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickDelete(leave.id, leave.leaveNo);
                              }}
                              disabled={quickDeleteLoading === leave.id}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {quickDeleteLoading === leave.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          pagination.page === pageNum
                            ? 'bg-orange-500 text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
      </div>
    </HrLayoutWrapper>
  );
}
