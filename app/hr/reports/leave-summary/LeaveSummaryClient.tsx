'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  Calendar,
  Download,
  Search,
  X,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import { getFiscalYear, getLeavePeriod } from '@/lib/fiscalYear';
import { formatThaiDate } from '@/lib/thaiDate';

interface TeacherLeave {
  id: string;
  leaveNo: string;
  type: 'sick' | 'personal' | 'maternity' | 'religious' | 'other';
  customTypeName: string | null;
  startDate: string;
  endDate: string;
  daysWorking: number;
  isHalfDay: boolean;
}

interface TeacherStat {
  id: string;
  code: string;
  name: string;
  department: string;
  sickCount: number;
  sickDays: number;
  personalCount: number;
  personalDays: number;
  maternityCount: number;
  maternityDays: number;
  religiousCount: number;
  religiousDays: number;
  otherCount: number;
  otherDays: number;
  totalCount: number;
  totalDays: number;
  leaves: TeacherLeave[];
}

interface SummaryData {
  fiscalYear: number;
  round: 1 | 2;
  startDate: string;
  endDate: string;
  summary: {
    totalTeachers: number;
    totalSickDays: number;
    totalPersonalDays: number;
    totalDays: number;
  };
  teachers: TeacherStat[];
}

type SortField = 'code' | 'name' | 'department' | 'sickDays' | 'personalDays' | 'totalDays';
type SortDirection = 'asc' | 'desc';

export default function LeaveSummaryClient() {
  const router = useRouter();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [fiscalYear, setFiscalYear] = useState(getFiscalYear(new Date()));
  const [round, setRound] = useState<1 | 2>(getLeavePeriod(new Date()));
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalDays');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAll, setShowAll] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherStat | null>(null);

  useEffect(() => {
    fetchAvailableYears();
    fetchData();
  }, [fiscalYear, round]);

  const fetchAvailableYears = async () => {
    try {
      const response = await fetch('/api/hr/reports/leave-summary?action=years');
      if (response.ok) {
        const result = await response.json();
        setAvailableYears(result.years || [getFiscalYear(new Date())]);
      }
    } catch (error) {
      console.error('Failed to fetch available years:', error);
      setAvailableYears([getFiscalYear(new Date())]);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/hr/reports/leave-summary?fiscalYear=${fiscalYear}&round=${round}`
      );
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await fetch(
        `/api/hr/reports/leave-summary/export?fiscalYear=${fiscalYear}&round=${round}`
      );
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leave-summary-${fiscalYear}-round${round}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('ดาวน์โหลดสำเร็จ');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('ไม่สามารถ Export ได้');
    } finally {
      setExporting(false);
    }
  };

  const filteredAndSortedTeachers = useMemo(() => {
    if (!data) return [];

    let filtered = data.teachers;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.code.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query) ||
          t.department.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data, searchQuery, sortField, sortDirection]);

  const displayedTeachers = showAll
    ? filteredAndSortedTeachers
    : filteredAndSortedTeachers.slice(0, 20);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getColorClass = (totalDays: number) => {
    if (totalDays > 23) return 'bg-red-50 dark:bg-red-900/20';
    if (totalDays > 15) return 'bg-orange-50 dark:bg-orange-900/20';
    if (totalDays > 10) return 'bg-yellow-50 dark:bg-yellow-900/20';
    return '';
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <HrLayoutWrapper
      hrUser={{
        id: '',
        firstName: '',
        lastName: '',
        role: 'hr',
      }}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4 mb-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors lg:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  สรุปข้อมูลการลา
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  รายงานการลาของครูทุกคน
                </p>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting || !data}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="hidden sm:inline">กำลัง Export...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </>
                )}
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={fiscalYear}
                onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {availableYears.length > 0 ? (
                  availableYears.map((year) => (
                    <option key={year} value={year}>
                      ปีงบประมาณ {year}
                    </option>
                  ))
                ) : (
                  <option value={getFiscalYear(new Date())}>
                    ปีงบประมาณ {getFiscalYear(new Date())}
                  </option>
                )}
              </select>

              <select
                value={round}
                onChange={(e) => setRound(parseInt(e.target.value) as 1 | 2)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value={1}>รอบที่ 1 (ต.ค. - มี.ค.)</option>
                <option value={2}>รอบที่ 2 (เม.ย. - ก.ย.)</option>
              </select>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 rounded-xl p-4 h-24 animate-pulse"
                />
              ))}
            </div>
          ) : data ? (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                      <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      จำนวนครูทั้งหมด
                    </h3>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {data.summary.totalTeachers}
                    <span className="text-sm text-slate-500 font-normal ml-1">คน</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <Calendar className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      ลาป่วยรวม
                    </h3>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {data.summary.totalSickDays.toFixed(1)}
                    <span className="text-sm text-slate-500 font-normal ml-1">วัน</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      ลากิจรวม
                    </h3>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {data.summary.totalPersonalDays.toFixed(1)}
                    <span className="text-sm text-slate-500 font-normal ml-1">วัน</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      วันลารวม
                    </h3>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {data.summary.totalDays.toFixed(1)}
                    <span className="text-sm text-slate-500 font-normal ml-1">วัน</span>
                  </p>
                </motion.div>
              </div>

              {/* Search */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อ, รหัส, กลุ่มสาระ..."
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                    >
                      <X className="w-3 h-3 text-slate-500" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  แสดง {displayedTeachers.length} จาก {filteredAndSortedTeachers.length} คน
                </p>
              </div>

              {/* Table - Desktop */}
              <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr className="text-xs text-slate-600 dark:text-slate-400">
                        <th
                          onClick={() => handleSort('code')}
                          className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                          rowSpan={2}
                        >
                          <div className="flex items-center gap-2">
                            รหัส
                            <SortIcon field="code" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('name')}
                          className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                          rowSpan={2}
                        >
                          <div className="flex items-center gap-2">
                            ชื่อ-สกุล
                            <SortIcon field="name" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('department')}
                          className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                          rowSpan={2}
                        >
                          <div className="flex items-center gap-2">
                            กลุ่มสาระ
                            <SortIcon field="department" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-center font-medium border-r border-slate-200 dark:border-slate-700" colSpan={2}>
                          ลาป่วย
                        </th>
                        <th className="px-4 py-3 text-center font-medium border-r border-slate-200 dark:border-slate-700" colSpan={2}>
                          ลากิจ
                        </th>
                        <th className="px-4 py-3 text-center font-medium border-r border-slate-200 dark:border-slate-700" colSpan={2}>
                          ลาคลอด
                        </th>
                        <th className="px-4 py-3 text-center font-medium border-r border-slate-200 dark:border-slate-700" colSpan={2}>
                          ลาทางศาสนา
                        </th>
                        <th className="px-4 py-3 text-center font-medium" colSpan={2}>
                          รวม
                        </th>
                        <th className="px-4 py-3 text-center font-medium" rowSpan={2}>ดูรายละเอียด</th>
                      </tr>
                      <tr className="text-xs text-slate-600 dark:text-slate-400">
                        <th
                          className="px-2 py-2 text-center font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          ครั้ง
                        </th>
                        <th
                          onClick={() => handleSort('sickDays')}
                          className="px-2 py-2 text-center font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-center justify-center gap-1">
                            วัน
                            <SortIcon field="sickDays" />
                          </div>
                        </th>
                        <th
                          className="px-2 py-2 text-center font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          ครั้ง
                        </th>
                        <th
                          onClick={() => handleSort('personalDays')}
                          className="px-2 py-2 text-center font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-center justify-center gap-1">
                            วัน
                            <SortIcon field="personalDays" />
                          </div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium">ครั้ง</th>
                        <th className="px-2 py-2 text-center font-medium border-r border-slate-200 dark:border-slate-700">วัน</th>
                        <th className="px-2 py-2 text-center font-medium">ครั้ง</th>
                        <th className="px-2 py-2 text-center font-medium border-r border-slate-200 dark:border-slate-700">วัน</th>
                        <th className="px-2 py-2 text-center font-medium">ครั้ง</th>
                        <th
                          onClick={() => handleSort('totalDays')}
                          className="px-2 py-2 text-center font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <div className="flex items-center justify-center gap-1">
                            วัน
                            <SortIcon field="totalDays" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {displayedTeachers.map((teacher) => (
                        <tr
                          key={teacher.id}
                          className={`text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 ${getColorClass(teacher.totalDays)}`}
                        >
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                            {teacher.code}
                          </td>
                          <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                            {teacher.name}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {teacher.department}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-900 dark:text-slate-100">
                            {teacher.sickCount}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                            {teacher.sickDays.toFixed(1)}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-900 dark:text-slate-100">
                            {teacher.personalCount}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                            {teacher.personalDays.toFixed(1)}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-900 dark:text-slate-100">
                            {teacher.maternityCount}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                            {teacher.maternityDays.toFixed(1)}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-900 dark:text-slate-100">
                            {teacher.religiousCount}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                            {teacher.religiousDays.toFixed(1)}
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                            {teacher.totalCount}
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                            {teacher.totalDays.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setSelectedTeacher(teacher)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors text-xs font-medium"
                            >
                              <Eye className="w-3 h-3" />
                              ดู
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card List - Mobile */}
              <div className="lg:hidden space-y-3">
                {displayedTeachers.map((teacher) => (
                  <motion.div
                    key={teacher.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 ${getColorClass(teacher.totalDays)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">
                          {teacher.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {teacher.code} • {teacher.department}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedTeacher(teacher)}
                        className="p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">ลาป่วย (ครั้ง)</p>
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {teacher.sickCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">ลาป่วย (วัน)</p>
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {teacher.sickDays.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">ลากิจ (ครั้ง)</p>
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {teacher.personalCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">ลากิจ (วัน)</p>
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {teacher.personalDays.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-center text-xs">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">รวม (ครั้ง)</p>
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {teacher.totalCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">รวม (วัน)</p>
                        <p className="font-bold text-lg text-slate-900 dark:text-slate-100">
                          {teacher.totalDays.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Show All Button */}
              {!showAll && filteredAndSortedTeachers.length > 20 && (
                <div className="text-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="px-6 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg transition-colors text-sm font-medium shadow-sm"
                  >
                    แสดงทั้งหมด ({filteredAndSortedTeachers.length} คน)
                  </button>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>

      {/* Teacher Detail Modal */}
      <AnimatePresence>
        {selectedTeacher && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedTeacher(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedTeacher.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedTeacher.code} • {selectedTeacher.department}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTeacher(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Leave List Table */}
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                รายการใบลาทั้งหมด ({selectedTeacher.leaves.length} ใบ)
              </h4>

              {selectedTeacher.leaves.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300">
                          เลขที่ใบลา
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300">
                          ประเภท
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300">
                          วันที่
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                          จำนวนครั้ง
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                          จำนวนวัน
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {selectedTeacher.leaves.map((leave) => {
                        const typeLabels: Record<string, string> = {
                          sick: 'ลาป่วย',
                          personal: 'ลากิจ',
                          maternity: 'ลาคลอด',
                          religious: 'ลาทางศาสนา',
                          other: 'อื่นๆ',
                        };

                        const typeColors: Record<string, string> = {
                          sick: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                          personal:
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                          maternity:
                            'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
                          religious:
                            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                          other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
                        };

                        return (
                          <tr
                            key={leave.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-3 py-3 text-xs text-slate-900 dark:text-slate-100 font-mono">
                              {leave.leaveNo}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-block px-2 py-1 text-xs rounded ${typeColors[leave.type]}`}
                              >
                                {leave.type === 'other' && leave.customTypeName
                                  ? leave.customTypeName
                                  : typeLabels[leave.type]}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-900 dark:text-slate-100">
                              <div className="text-xs">
                                {formatThaiDate(new Date(leave.startDate), 'd MMM yyyy')}
                                {leave.startDate !== leave.endDate && (
                                  <>
                                    {' - '}
                                    {formatThaiDate(new Date(leave.endDate), 'd MMM yyyy')}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                1
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {leave.daysWorking.toFixed(1)}
                              </span>
                              {leave.isHalfDay && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                                  (ครึ่งวัน)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                  ไม่มีใบลาในรอบนี้
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </HrLayoutWrapper>
  );
}
