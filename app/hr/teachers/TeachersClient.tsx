'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import Tooltip from '@/components/ui/Tooltip';

interface TeachersClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
}

interface Teacher {
  id: string;
  teacherCode: string;
  title: string;
  firstName: string;
  lastName: string;
  citizenId: string;
  birthDate: string;
  position: string;
  department: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  _count: {
    leaves: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function TeachersClient({ hrUser }: TeachersClientProps) {
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'leaves' | 'department'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [viewingTeacherLeaves, setViewingTeacherLeaves] = useState<Teacher | null>(null);
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  const [formData, setFormData] = useState({
    teacherCode: '',
    title: '',
    firstName: '',
    lastName: '',
    citizenId: '',
    birthDate: '',
    position: '',
    department: '',
    phoneNumber: '',
  });

  useEffect(() => {
    fetchTeachers();
  }, [search, statusFilter, departmentFilter, sortBy, sortOrder, pagination.page]);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (departmentFilter) params.append('department', departmentFilter);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const res = await fetch(`/api/hr/teachers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.teachers);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch teachers:', error);
      toast.error('ไม่สามารถโหลดข้อมูลครูได้');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (
      !formData.title.trim() ||
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.citizenId.trim() ||
      !formData.birthDate ||
      !formData.position.trim()
    ) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    try {
      const res = await fetch('/api/hr/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('เพิ่มครูสำเร็จ');
      setShowAddDialog(false);
      resetForm();
      fetchTeachers();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถเพิ่มครูได้');
    }
  };

  const handleEdit = async () => {
    if (!editingTeacher) return;

    if (
      !formData.title.trim() ||
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.position.trim()
    ) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const res = await fetch(`/api/hr/teachers/${editingTeacher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('แก้ไขข้อมูลสำเร็จ');
      setEditingTeacher(null);
      resetForm();
      fetchTeachers();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถแก้ไขข้อมูลได้');
    }
  };

  const handleToggleActive = async (teacher: Teacher) => {
    try {
      const res = await fetch(`/api/hr/teachers/${teacher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !teacher.isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success(teacher.isActive ? 'ปิดใช้งานสำเร็จ' : 'เปิดใช้งานสำเร็จ');
      fetchTeachers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (teacher: Teacher) => {
    if (hrUser.role !== 'super_admin') {
      toast.error('เฉพาะผู้ดูแลระบบเท่านั้นที่ลบได้');
      return;
    }

    if (teacher._count.leaves > 0) {
      toast.error(
        `ไม่สามารถลบครูที่มีประวัติการลา (${teacher._count.leaves} ใบ) กรุณาใช้ "ปิดใช้งาน" แทน`
      );
      return;
    }

    const confirmed = confirm(
      `ต้องการลบ ${teacher.title}${teacher.firstName} ${teacher.lastName} หรือไม่?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/hr/teachers/${teacher.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('ลบครูสำเร็จ');
      fetchTeachers();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถลบครูได้');
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (departmentFilter) params.append('department', departmentFilter);

      const res = await fetch(`/api/hr/teachers/export?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      // Convert to CSV
      const headers = [
        'รหัสครู',
        'คำนำหน้า',
        'ชื่อ',
        'นามสกุล',
        'เลขบัตรประชาชน',
        'วันเกิด',
        'ตำแหน่ง',
        'กลุ่มสาระ/ฝ่าย',
        'เบอร์โทร',
        'สถานะ',
        'จำนวนใบลา',
      ];

      const rows = data.teachers.map((t: any) => [
        t?.teacherCode || '',
        t?.title || '',
        t?.firstName || '',
        t?.lastName || '',
        t?.citizenId || '',
        t?.birthDate || '',
        t?.position || '',
        t?.department || '',
        t?.phoneNumber || '',
        t?.isActive || false,
        t?.leavesCount || 0,
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map((cell: any) => `"${cell}"`).join(','))
        .join('\n');

      // Download
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `teachers-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Export สำเร็จ');
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถ export ได้');
    }
  };

  const fetchLeaveHistory = async (teacher: Teacher) => {
    try {
      setLoadingLeaves(true);
      setViewingTeacherLeaves(teacher);

      const res = await fetch(`/api/hr/teachers/${teacher.id}/leaves`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      setLeaveHistory(data.leaves);
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถโหลดประวัติการลาได้');
      setViewingTeacherLeaves(null);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const closeLeaveHistory = () => {
    setViewingTeacherLeaves(null);
    setLeaveHistory([]);
  };

  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (teacher: Teacher) => {
    setFormData({
      teacherCode: teacher.teacherCode,
      title: teacher.title,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      citizenId: formatCitizenId(teacher.citizenId),
      birthDate: teacher.birthDate.split('T')[0],
      position: teacher.position,
      department: teacher.department || '',
      phoneNumber: teacher.phoneNumber || '',
    });
    setEditingTeacher(teacher);
  };

  const resetForm = () => {
    setFormData({
      teacherCode: '',
      title: '',
      firstName: '',
      lastName: '',
      citizenId: '',
      birthDate: '',
      position: '',
      department: '',
      phoneNumber: '',
    });
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setDepartmentFilter('');
    setShowFilters(false);
  };

  const hasActiveFilters = statusFilter !== 'all' || departmentFilter !== '';

  return (
    <HrLayoutWrapper hrUser={hrUser}>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                จัดการครู
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {pagination.total} คน
              </p>
            </div>
            <button
              onClick={handleExport}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Export Excel"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/hr/teachers/import')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Import Excel"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              onClick={openAddDialog}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่ม</span>
            </button>
          </div>

          {/* Search + Filters */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                placeholder="ค้นหาชื่อ, นามสกุล, รหัส, เลขบัตร..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-sm"
            >
              <option value="code">เรียงตามรหัส</option>
              <option value="name">เรียงตามชื่อ</option>
              <option value="department">เรียงตามแผนก</option>
              <option value="leaves">เรียงตามใบลา</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
              title={sortOrder === 'asc' ? 'น้อย → มาก' : 'มาก → น้อย'}
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                hasActiveFilters
                  ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-sky-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      สถานะ
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value as any);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                    >
                      <option value="all">ทั้งหมด</option>
                      <option value="active">ใช้งาน</option>
                      <option value="inactive">ปิดใช้งาน</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      กลุ่มสาระ/ฝ่าย
                    </label>
                    <input
                      type="text"
                      value={departmentFilter}
                      onChange={(e) => {
                        setDepartmentFilter(e.target.value);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      placeholder="ค้นหากลุ่มสาระ..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-24 bg-white dark:bg-slate-900 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <Search className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              {search || hasActiveFilters ? 'ไม่พบครู' : 'ยังไม่มีครู'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {search || hasActiveFilters
                ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง'
                : 'เริ่มต้นด้วยการเพิ่มครูคนแรก'}
            </p>
            {!search && !hasActiveFilters && (
              <button
                onClick={openAddDialog}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                เพิ่มครู
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Teacher List */}
            <div className="space-y-3">
              {teachers.map((teacher, idx) => (
                <motion.div
                  key={teacher.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => fetchLeaveHistory(teacher)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">
                          {teacher.title}
                          {teacher.firstName} {teacher.lastName}
                        </h3>
                        {!teacher.isActive && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-full">
                            ปิดใช้งาน
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                        <p>รหัส: {teacher.teacherCode}</p>
                        <p>ตำแหน่ง: {teacher.position}</p>
                        {teacher.department && <p>กลุ่มสาระ: {teacher.department}</p>}
                        <p className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          ใบลา: {teacher._count.leaves} ใบ
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tooltip content="แก้ไขข้อมูลครู">
                        <button
                          onClick={() => openEditDialog(teacher)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </button>
                      </Tooltip>
                      <Tooltip content={teacher.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                        <button
                          onClick={() => handleToggleActive(teacher)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          {teacher.isActive ? (
                            <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          )}
                        </button>
                      </Tooltip>
                      {hrUser.role === 'super_admin' && (
                        <Tooltip content={teacher._count.leaves > 0 ? 'ไม่สามารถลบครูที่มีประวัติการลาได้' : 'ลบครู'}>
                          <button
                            onClick={() => handleDelete(teacher)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:cursor-not-allowed"
                            disabled={teacher._count.leaves > 0}
                          >
                            <Trash2
                              className={`w-4 h-4 ${
                                teacher._count.leaves > 0
                                  ? 'text-slate-300 dark:text-slate-700'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  ก่อนหน้า
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  หน้า {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page + 1 }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  ถัดไป
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <AnimatePresence>
        {(showAddDialog || editingTeacher) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowAddDialog(false);
                setEditingTeacher(null);
                resetForm();
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl pointer-events-auto flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Fixed Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {editingTeacher ? 'แก้ไขข้อมูลครู' : 'เพิ่มครู'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddDialog(false);
                      setEditingTeacher(null);
                      resetForm();
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-6">
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    รหัสครู {!showAddDialog && '(ไม่บังคับ - ระบบจะสร้างให้)'}
                  </label>
                  <input
                    type="text"
                    value={formData.teacherCode}
                    onChange={(e) =>
                      setFormData({ ...formData, teacherCode: e.target.value })
                    }
                    placeholder="เช่น T-0001"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      คำนำหน้า <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="นาย/นาง/นางสาว"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      ชื่อ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      นามสกุล <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      เลขบัตรประชาชน <span className="text-red-500">*</span>
                      {editingTeacher !== null && hrUser.role !== 'super_admin' && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                          (Super admin เท่านั้น)
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formData.citizenId}
                      onChange={(e) =>
                        setFormData({ ...formData, citizenId: e.target.value })
                      }
                      placeholder="1-2345-67890-12-3"
                      disabled={editingTeacher !== null && hrUser.role !== 'super_admin'}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      วันเกิด <span className="text-red-500">*</span>
                      {editingTeacher !== null && hrUser.role !== 'super_admin' && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                          (Super admin เท่านั้น)
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) =>
                        setFormData({ ...formData, birthDate: e.target.value })
                      }
                      disabled={editingTeacher !== null && hrUser.role !== 'super_admin'}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    ตำแหน่ง <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    placeholder="เช่น ครูผู้สอน"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      กลุ่มสาระ/ฝ่าย
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value })
                      }
                      placeholder="เช่น คณิตศาสตร์"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      เบอร์โทร
                    </label>
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, phoneNumber: e.target.value })
                      }
                      placeholder="08X-XXX-XXXX"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {editingTeacher && editingTeacher._count.leaves > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      ครูท่านนี้มีประวัติการลา {editingTeacher._count.leaves} ใบ
                      ไม่สามารถลบได้
                    </p>
                  </div>
                )}
              </div>

              {/* Fixed Footer */}
              <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setEditingTeacher(null);
                    resetForm();
                  }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={editingTeacher ? handleEdit : handleAdd}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
                >
                  {editingTeacher ? 'บันทึก' : 'เพิ่ม'}
                </button>
              </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Leave History Modal */}
      <AnimatePresence>
        {viewingTeacherLeaves && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeLeaveHistory}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      ประวัติการลา
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {viewingTeacherLeaves.title}
                      {viewingTeacherLeaves.firstName} {viewingTeacherLeaves.lastName} ({viewingTeacherLeaves.teacherCode})
                    </p>
                  </div>
                  <button
                    onClick={closeLeaveHistory}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {loadingLeaves ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
                      />
                    ))}
                  </div>
                ) : leaveHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      ยังไม่มีประวัติการลา
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaveHistory.map((leave) => (
                      <div
                        key={leave.id}
                        className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {leave.leaveNo}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  leave.status === 'approved'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    : leave.status === 'rejected'
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                    : leave.status === 'reviewed'
                                    ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {leave.status === 'approved'
                                  ? 'อนุมัติ'
                                  : leave.status === 'rejected'
                                  ? 'ไม่อนุมัติ'
                                  : leave.status === 'reviewed'
                                  ? 'รออนุมัติ'
                                  : 'รอตรวจสอบ'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {getLeaveTypeName(leave.type)}
                            </p>
                          </div>
                          {leave.status === 'approved' && leave.pdfUrl && (
                            <button
                              onClick={() => window.open(`/api/hr/leaves/${leave.id}/pdf`, '_blank')}
                              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              ดู PDF
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(leave.startDate).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {' - '}
                            {new Date(leave.endDate).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p>จำนวน: {leave.daysWorking} วัน</p>
                        </div>
                        {leave.reason && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                            เหตุผล: {leave.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6">
                  <button
                    onClick={closeLeaveHistory}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors"
                  >
                    ปิด
                  </button>
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

function getLeaveTypeName(type: string): string {
  const types: Record<string, string> = {
    sick: 'ลาป่วย',
    personal: 'ลากิจ',
    vacation: 'ลาพักร้อน',
    maternity: 'ลาคลอด',
    ordination: 'ลาอุปสมบท',
    military: 'ลาเกณฑ์ทหาร',
    study: 'ลาศึกษาต่อ',
    other: 'อื่นๆ',
  };
  return types[type] || type;
}

function formatCitizenId(id: string): string {
  return `${id.slice(0, 1)}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id.slice(12)}`;
}
