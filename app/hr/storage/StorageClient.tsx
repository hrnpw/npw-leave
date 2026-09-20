'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  HardDrive,
  AlertTriangle,
  Trash2,
  FileText,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Image,
  FileType,
  Calendar,
  TrendingUp,
  Users,
  Download,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';

interface BlobStats {
  totalSize: number;
  count: number;
}

interface StorageSettings {
  storageWarningThreshold: number;
  storageCriticalThreshold: number;
}

interface Analytics {
  totalFiles: number;
  totalSize: number;
  avgFileSize: number;
  byFileType: Record<string, { count: number; size: number }>;
  topTeachers: Array<{
    teacherId: string;
    name: string;
    count: number;
    size: number;
  }>;
  byMonth: Record<string, { count: number; size: number }>;
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  blobUrl: string;
  mimeType: string;
  uploadedAt: string;
}

interface LeaveWithAttachments {
  id: string;
  leaveNo: string;
  teacher: {
    title: string;
    firstName: string;
    lastName: string;
  };
  attachments: Attachment[];
  totalSize: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function StorageClient() {
  const router = useRouter();
  const [stats, setStats] = useState<BlobStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [storageSettings, setStorageSettings] = useState<StorageSettings>({
    storageWarningThreshold: 70,
    storageCriticalThreshold: 90,
  });
  const [leaves, setLeaves] = useState<LeaveWithAttachments[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [fileType, setFileType] = useState('');
  const [sortBy, setSortBy] = useState<'size' | 'date' | 'files'>('size');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Bulk selection
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Preview modal
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);

  useEffect(() => {
    fetchData();
  }, [search, fileType, sortBy, sortOrder, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchAnalytics();
    fetchStorageSettings();
  }, []);

  const fetchStorageSettings = async () => {
    try {
      const res = await fetch('/api/hr/settings');
      if (res.ok) {
        const data = await res.json();
        setStorageSettings({
          storageWarningThreshold: data.storageWarningThreshold || 70,
          storageCriticalThreshold: data.storageCriticalThreshold || 90,
        });
      }
    } catch (error) {
      console.error('Failed to fetch storage settings:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        hasAttachments: 'true',
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });

      if (search) params.append('search', search);
      if (fileType) params.append('fileType', fileType);

      const [statsRes, leavesRes] = await Promise.all([
        fetch('/api/r2/stats'),
        fetch(`/api/hr/leaves/with-attachments?${params}`),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (leavesRes.ok) {
        const leavesData = await leavesRes.json();
        setLeaves(leavesData.leaves || []);
        setPagination(leavesData.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch storage data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/hr/storage/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, blobUrl: string) => {
    if (!confirm('ต้องการลบไฟล์นี้หรือไม่?')) return;

    try {
      setDeleting(attachmentId);

      const res = await fetch(`/api/blob/delete/${encodeURIComponent(blobUrl)}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Delete failed');

      toast.success('ลบไฟล์สำเร็จ');
      await fetchData();
      await fetchAnalytics();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('ไม่สามารถลบไฟล์ได้');
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAttachments.size === 0) return;

    if (!confirm(`ต้องการลบ ${selectedAttachments.size} ไฟล์หรือไม่?`)) return;

    try {
      setBulkDeleting(true);

      const res = await fetch('/api/blob/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentIds: Array.from(selectedAttachments),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Bulk delete failed');

      toast.success(
        `ลบไฟล์สำเร็จ ${data.deletedCount} ไฟล์ (คืนพื้นที่ ${formatBytes(data.totalSize)})`
      );
      setSelectedAttachments(new Set());
      await fetchData();
      await fetchAnalytics();
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      toast.error(error.message || 'ไม่สามารถลบไฟล์ได้');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelectAttachment = (attachmentId: string) => {
    const newSelected = new Set(selectedAttachments);
    if (newSelected.has(attachmentId)) {
      newSelected.delete(attachmentId);
    } else {
      newSelected.add(attachmentId);
    }
    setSelectedAttachments(newSelected);
  };

  const selectAllInLeave = (leave: LeaveWithAttachments) => {
    const newSelected = new Set(selectedAttachments);
    const allSelected = leave.attachments.every((att) => newSelected.has(att.id));

    if (allSelected) {
      leave.attachments.forEach((att) => newSelected.delete(att.id));
    } else {
      leave.attachments.forEach((att) => newSelected.add(att.id));
    }

    setSelectedAttachments(newSelected);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4" />;
    return <FileType className="w-4 h-4" />;
  };

  const totalMB = stats ? stats.totalSize / (1024 * 1024) : 0;
  const limitMB = 10240; // 10 GB for Cloudflare R2
  const percentage = (totalMB / limitMB) * 100;
  const isWarning = percentage > storageSettings.storageWarningThreshold;
  const isCritical = percentage > storageSettings.storageCriticalThreshold;

  const hasActiveFilters = search !== '' || fileType !== '';

  return (
    <HrLayoutWrapper hrUser={{ id: '', firstName: '', lastName: '', role: 'hr' }}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors lg:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  จัดการพื้นที่จัดเก็บ
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Cloudflare R2 Storage
                </p>
              </div>
              {selectedAttachments.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบ {selectedAttachments.size} ไฟล์
                </button>
              )}
            </div>

            {/* Search and Filters */}
            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  placeholder="ค้นหาเลขที่ใบลา, ชื่อครู..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-sm"
              >
                <option value="size">เรียงตามขนาด</option>
                <option value="date">เรียงตามวันที่</option>
                <option value="files">เรียงตามจำนวนไฟล์</option>
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

            {/* Limit selector */}
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span>แสดง:</span>
              <select
                value={pagination.limit}
                onChange={(e) =>
                  setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))
                }
                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span>รายการ</span>
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
                        ประเภทไฟล์
                      </label>
                      <select
                        value={fileType}
                        onChange={(e) => {
                          setFileType(e.target.value);
                          setPagination((p) => ({ ...p, page: 1 }));
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                      >
                        <option value="">ทั้งหมด</option>
                        <option value="image">รูปภาพ</option>
                        <option value="pdf">PDF</option>
                        <option value="application">เอกสาร</option>
                      </select>
                    </div>

                    {hasActiveFilters && (
                      <button
                        onClick={() => {
                          setSearch('');
                          setFileType('');
                          setShowFilters(false);
                        }}
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

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Storage Stats Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`p-3 rounded-xl ${
                  isCritical
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : isWarning
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-sky-100 dark:bg-sky-900/30'
                }`}
              >
                <HardDrive
                  className={`w-6 h-6 ${
                    isCritical
                      ? 'text-red-600 dark:text-red-400'
                      : isWarning
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-sky-600 dark:text-sky-400'
                  }`}
                />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  พื้นที่จัดเก็บ
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {loading ? 'กำลังโหลด...' : `${stats?.count || 0} ไฟล์`}
                </p>
              </div>
            </div>

            {!loading && stats && (
              <>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">ใช้ไปแล้ว</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {totalMB.toFixed(1)} MB / {limitMB.toFixed(0)} MB ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {isWarning && (
                  <div
                    className={`flex items-start gap-2 p-3 rounded-lg ${
                      isCritical
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-5 h-5 flex-shrink-0 ${
                        isCritical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                    <p
                      className={`text-sm ${
                        isCritical ? 'text-red-900 dark:text-red-100' : 'text-amber-900 dark:text-amber-100'
                      }`}
                    >
                      {isCritical
                        ? `พื้นที่ใกล้เต็ม (>${storageSettings.storageCriticalThreshold}%)! แนะนำให้ลบไฟล์โดยเร็ว`
                        : `พื้นที่ใช้งานเกิน ${storageSettings.storageWarningThreshold}% แนะนำให้ลบไฟล์ที่ไม่จำเป็น`}
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* Storage Usage Trend Chart */}
          {analytics && Object.keys(analytics.byMonth).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                เทรนด์การใช้พื้นที่ (6 เดือนล่าสุด)
              </h2>
              <div className="h-48 flex items-end justify-between gap-2">
                {Object.entries(analytics.byMonth)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([month, data]) => {
                    const maxSize = Math.max(
                      ...Object.values(analytics.byMonth).map((d) => d.size)
                    );
                    const heightPercent = maxSize > 0 ? (data.size / maxSize) * 100 : 0;
                    const monthName = new Date(month + '-01').toLocaleDateString('th-TH', {
                      month: 'short',
                      year: '2-digit',
                    });

                    return (
                      <div key={month} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full relative group">
                          <div
                            className="w-full bg-sky-500 hover:bg-sky-600 rounded-t-lg transition-all cursor-pointer"
                            style={{ height: `${Math.max(heightPercent, 5)}%` }}
                            title={`${monthName}: ${formatBytes(data.size)} (${data.count} ไฟล์)`}
                          />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                            {formatBytes(data.size)}
                            <br />
                            {data.count} ไฟล์
                          </div>
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {monthName}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}

          {/* Analytics Cards */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">ไฟล์ทั้งหมด</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {analytics.totalFiles}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ขนาดเฉลี่ย: {formatBytes(analytics.avgFileSize)}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">ครูที่อัปโหลด</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {analytics.topTeachers.length}
                    </p>
                  </div>
                </div>
                {analytics.topTeachers[0] && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    สูงสุด: {analytics.topTeachers[0].name}
                  </p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">ประเภทไฟล์</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {Object.keys(analytics.byFileType).length}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {Object.entries(analytics.byFileType)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 2)
                    .map(([type, data]) => `${type.split('/')[1]}: ${data.count}`)
                    .join(', ')}
                </p>
              </motion.div>
            </div>
          )}

          {/* Leaves with Attachments */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              ใบลาที่มีไฟล์แนบ
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 dark:text-slate-400">
                  {hasActiveFilters ? 'ไม่พบไฟล์ที่ค้นหา' : 'ไม่มีใบลาที่มีไฟล์แนบ'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {leaves.map((leave) => {
                    const allSelected = leave.attachments.every((att) =>
                      selectedAttachments.has(att.id)
                    );
                    return (
                      <div
                        key={leave.id}
                        className="border border-slate-200 dark:border-slate-700 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => selectAllInLeave(leave)}
                              className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                            />
                            <div>
                              <h3 className="font-medium text-slate-900 dark:text-slate-100">
                                {leave.leaveNo}
                              </h3>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {leave.teacher.title}
                                {leave.teacher.firstName} {leave.teacher.lastName}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {formatBytes(leave.totalSize)}
                            </span>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {leave.attachments.length} ไฟล์
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {leave.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between gap-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={selectedAttachments.has(att.id)}
                                  onChange={() => toggleSelectAttachment(att.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                                />
                                {getFileIcon(att.mimeType)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {att.fileName}
                                  </p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    {formatBytes(att.fileSize)} • {new Date(att.uploadedAt).toLocaleDateString('th-TH')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setPreviewFile(att)}
                                  className="p-2 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                  title="ดูตัวอย่าง"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAttachment(att.id, att.blobUrl)}
                                  disabled={deleting === att.id}
                                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                  title="ลบ"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      หน้า {pagination.page} / {pagination.totalPages} ({pagination.total} รายการ)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                        disabled={pagination.page === 1}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                        disabled={pagination.page === pagination.totalPages}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </main>

        {/* File Preview Modal */}
        <AnimatePresence>
          {previewFile && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPreviewFile(null)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {previewFile.fileName}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {formatBytes(previewFile.fileSize)} • {previewFile.mimeType}
                      </p>
                    </div>
                    <button
                      onClick={() => setPreviewFile(null)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-4">
                    {previewFile.mimeType.startsWith('image/') ? (
                      <img
                        src={previewFile.blobUrl}
                        alt={previewFile.fileName}
                        className="max-w-full h-auto mx-auto rounded-lg"
                      />
                    ) : previewFile.mimeType === 'application/pdf' ? (
                      <iframe
                        src={previewFile.blobUrl}
                        className="w-full h-[600px] rounded-lg"
                        title={previewFile.fileName}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-600 dark:text-slate-400">
                          ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <a
                      href={previewFile.blobUrl}
                      download={previewFile.fileName}
                      className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      ดาวน์โหลด
                    </a>
                    <button
                      onClick={() => setPreviewFile(null)}
                      className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors"
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
