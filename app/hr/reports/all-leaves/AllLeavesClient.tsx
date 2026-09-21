'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  Filter,
  X,
  Eye,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface HrUser {
  id: string;
  firstName: string;
  lastName: string;
  role: 'hr' | 'super_admin';
}

interface LeaveRecord {
  id: string;
  leaveNo: string;
  fiscalYear: number;
  teacher: {
    title: string;
    firstName: string;
    lastName: string;
  };
  type: string;
  customTypeName: string | null;
  startDate: string;
  endDate: string;
  period: 'morning' | 'afternoon' | null;
  daysWorking: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approverNameSnapshot: string | null;
  reviewerNameSnapshot: string | null;
  createdAt: string;
}

interface FilterState {
  fiscalYear: string;
  period: string;
  type: string;
  status: string;
  department: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

export default function AllLeavesClient({ hrUser }: { hrUser: HrUser }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  const currentFiscalYear = (() => {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const year = now.getFullYear();
    // ปีงบประมาณเริ่มต.ค. (month 9)
    // ถ้าเดือนปัจจุบัน >= ต.ค. (9) ใช้ปีถัดไป
    return month >= 9 ? year + 544 : year + 543;
  })();

  const [filters, setFilters] = useState<FilterState>({
    fiscalYear: searchParams.get('year') || currentFiscalYear.toString(),
    period: searchParams.get('period') || '',
    type: searchParams.get('type') || '',
    status: searchParams.get('status') || '',
    department: searchParams.get('dept') || '',
    search: searchParams.get('q') || '',
    dateFrom: searchParams.get('from') || '',
    dateTo: searchParams.get('to') || '',
  });

  const stats = useMemo(() => {
    return {
      total: leaves.length,
      pending: leaves.filter(l => l.status === 'pending').length,
      approved: leaves.filter(l => l.status === 'approved').length,
      rejected: leaves.filter(l => l.status === 'rejected').length,
    };
  }, [leaves]);

  useEffect(() => {
    fetchLeaves();
  }, [filters, sortBy, sortOrder, page, limit]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });

      if (filters.fiscalYear) params.append('year', filters.fiscalYear);
      if (filters.period) params.append('period', filters.period);
      if (filters.type) params.append('type', filters.type);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('q', filters.search);
      if (filters.dateFrom) params.append('from', filters.dateFrom);
      if (filters.dateTo) params.append('to', filters.dateTo);

      const res = await fetch(`/api/hr/reports/all-leaves?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      setLeaves(data.leaves || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch leaves:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleExport = async (format: 'excel' | 'csv') => {
    try {
      setExporting(true);

      // Dynamic import for better code splitting
      const { downloadExcelFile } = await import('@/lib/excelExport');

      const params = new URLSearchParams();

      if (filters.fiscalYear) params.append('year', filters.fiscalYear);
      if (filters.period) params.append('period', filters.period);
      if (filters.type) params.append('type', filters.type);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('q', filters.search);
      if (filters.dateFrom) params.append('from', filters.dateFrom);
      if (filters.dateTo) params.append('to', filters.dateTo);
      params.append('format', format);

      const filename = `all-leaves-${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      await downloadExcelFile(`/api/hr/reports/all-leaves?${params}`, filename);

      toast.success('ดาวน์โหลดสำเร็จ');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('ไม่สามารถ Export ได้');
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (leave: LeaveRecord) => {
    if (leave.status === 'pending') {
      return <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded-full">รออนุมัติ</span>;
    } else if (leave.status === 'approved') {
      return <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">อนุมัติแล้ว</span>;
    } else if (leave.status === 'rejected') {
      return <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full">ไม่อนุมัติ</span>;
    } else {
      return <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 text-xs rounded-full">ยกเลิก</span>;
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <HrLayoutWrapper hrUser={hrUser}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    รายการใบลาทั้งหมด
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {total} รายการ
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('excel')}
                  disabled={exporting || loading}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting || loading}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-600 dark:text-slate-400">ทั้งหมด</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</div>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-3">
                <div className="text-xs text-yellow-700 dark:text-yellow-400">รออนุมัติ</div>
                <div className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{stats.pending}</div>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                <div className="text-xs text-green-700 dark:text-green-400">อนุมัติแล้ว</div>
                <div className="text-xl font-bold text-green-700 dark:text-green-400">{stats.approved}</div>
              </div>
              <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3">
                <div className="text-xs text-red-700 dark:text-red-400">ไม่อนุมัติ</div>
                <div className="text-xl font-bold text-red-700 dark:text-red-400">{stats.rejected}</div>
              </div>
            </div>

            {/* Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium w-full justify-center"
            >
              <Filter className="w-4 h-4" />
              ตัวกรอง
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">ปีการศึกษา</label>
                      <select
                        value={filters.fiscalYear}
                        onChange={(e) => setFilters({ ...filters, fiscalYear: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                      >
                        <option value="">ทั้งหมด</option>
                        {Array.from({ length: currentFiscalYear - 2568 }, (_, i) => 2569 + i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">รอบที่</label>
                      <select
                        value={filters.period}
                        onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                      >
                        <option value="">ทั้งหมด</option>
                        <option value="1">รอบที่ 1 (ต.ค.-มี.ค.)</option>
                        <option value="2">รอบที่ 2 (เม.ย.-ก.ย.)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">ประเภทการลา</label>
                      <select
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                      >
                        <option value="">ทั้งหมด</option>
                        <option value="sick">ลาป่วย</option>
                        <option value="personal">ลากิจ</option>
                        <option value="maternity">ลาคลอด</option>
                        <option value="religious">ลาอุปสมบท</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">สถานะ</label>
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                      >
                        <option value="">ทั้งหมด</option>
                        <option value="pending">รออนุมัติ</option>
                        <option value="approved">อนุมัติแล้ว</option>
                        <option value="rejected">ไม่อนุมัติ</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">ค้นหาครู</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="ชื่อ-สกุล หรือเลขที่ใบลา"
                          value={filters.search}
                          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                          className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div className="col-span-2 flex gap-2">
                      <button
                        onClick={() => {
                          setFilters({
                            fiscalYear: currentFiscalYear.toString(),
                            period: '',
                            type: '',
                            status: '',
                            department: '',
                            search: '',
                            dateFrom: '',
                            dateTo: '',
                          });
                          setPage(1);
                        }}
                        className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        รีเซ็ต
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th
                          onClick={() => handleSort('leaveNo')}
                          className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <div className="flex items-center gap-1">
                            เลขที่
                            {sortBy === 'leaveNo' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('teacher')}
                          className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <div className="flex items-center gap-1">
                            ชื่อ-สกุล
                            {sortBy === 'teacher' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">ประเภท</th>
                        <th
                          onClick={() => handleSort('startDate')}
                          className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <div className="flex items-center gap-1">
                            วันที่ลา
                            {sortBy === 'startDate' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">จำนวนวัน</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">สถานะ</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">ผู้อนุมัติ</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-400">การกระทำ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {leaves.map((leave) => (
                        <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{leave.leaveNo}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                            {leave.teacher.title}{leave.teacher.firstName} {leave.teacher.lastName}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                            {leave.type === 'sick' && 'ลาป่วย'}
                            {leave.type === 'personal' && 'ลากิจ'}
                            {leave.type === 'maternity' && 'ลาคลอด'}
                            {leave.type === 'religious' && 'ลาอุปสมบท'}
                            {leave.customTypeName && ` (${leave.customTypeName})`}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                            {format(new Date(leave.startDate), 'd MMM yy', { locale: th })}
                            {' - '}
                            {format(new Date(leave.endDate), 'd MMM yy', { locale: th })}
                            {leave.period && (
                              <span className="ml-1 text-xs">({leave.period === 'morning' ? 'เช้า' : 'บ่าย'})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-medium">{leave.daysWorking}</td>
                          <td className="px-4 py-3">{getStatusBadge(leave)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                            {leave.approverNameSnapshot || leave.reviewerNameSnapshot || '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => router.push(`/hr/leaves/${leave.id}`)}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                title="ดูรายละเอียด"
                              >
                                <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                              </button>
                              <button
                                onClick={() => window.open(`/api/pdf/${leave.id}`, '_blank')}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                title="ดาวน์โหลด PDF"
                              >
                                <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">แสดง</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    รายการ (ทั้งหมด {total})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    ก่อนหน้า
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    หน้า {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </HrLayoutWrapper>
  );
}

