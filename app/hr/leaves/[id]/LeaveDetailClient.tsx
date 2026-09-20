'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  MessageSquare,
  MapPin,
  Clock,
  Check,
  X,
  AlertTriangle,
  Paperclip,
  Download,
  Printer,
  Edit,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseISODateSafe } from '@/lib/dateUtils';
import { formatThaiDate, formatThaiDateShort } from '@/lib/thaiDate';
import type { LeaveStatus, LeaveType, HalfDayPeriod } from '@/types/leave';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_COLORS,
  HALF_DAY_PERIOD_LABELS,
} from '@/types/leave';
import EditLeaveDialog from '@/components/EditLeaveDialog';
import CancelLeaveDialog from '@/components/CancelLeaveDialog';

interface LeaveDetailClientProps {
  leaveId: string;
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
}

interface LeaveDetail {
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
  contactPhone?: string;
  status: LeaveStatus;
  rejectionReason?: string;
  submittedByType: 'teacher' | 'hr';
  submittedByHr?: {
    firstName: string;
    lastName: string;
  };
  proxyReason?: string;
  proxyNote?: string;
  teacher: {
    id: string;
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
    blobUrl: string;
    uploadedAt: string;
  }>;
  leaveDays: Array<{
    date: string;
    isWorkingDay: boolean;
    isHalfDay: boolean;
    halfDayPeriod?: HalfDayPeriod;
  }>;
  approverNameSnapshot?: string;
  approverPositionSnapshot?: string;
  directorNameSnapshot?: string;
  directorPositionSnapshot?: string;
  teacherSignatureUrl?: string;
  pdfUrl?: string;
  createdAt: string;
  approvedAt?: string;
  printedAt?: string;
}

export default function LeaveDetailClient({
  leaveId,
  hrUser,
}: LeaveDetailClientProps) {
  const router = useRouter();
  const [leave, setLeave] = useState<LeaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchLeaveDetail();
  }, [leaveId]);

  const fetchLeaveDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hr/leaves/${leaveId}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('ไม่พบใบลานี้');
          router.push('/hr/leaves');
          return;
        }
        throw new Error('Failed to fetch');
      }

      const data = await res.json();
      setLeave(data.leave);
    } catch (error) {
      console.error('Failed to fetch leave detail:', error);
      toast.error('ไม่สามารถโหลดรายละเอียดใบลาได้');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (!leave || isPrinting) return;

    // Check if leave is approved
    if (leave.status !== 'approved') {
      toast.error('ไม่สามารถพิมพ์ได้ กรุณาอนุมัติใบลาก่อน');
      return;
    }

    try {
      setIsPrinting(true);

      const res = await fetch(`/api/hr/leaves/${leave.id}/pdf`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'ไม่สามารถสร้าง PDF ได้');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      // Open PDF in new tab
      window.open(url, '_blank');

      // Refresh leave data to update printedAt
      await fetchLeaveDetail();

      toast.success('เปิด PDF สำเร็จ');
    } catch (error) {
      console.error('Print failed:', error);
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถพิมพ์ PDF ได้');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDeletePermanent = async () => {
    if (!leave || isDeleting) return;

    // Validate confirmation text
    if (deleteConfirmText !== leave.leaveNo) {
      toast.error('กรุณาพิมพ์เลขที่ใบลาให้ถูกต้อง');
      return;
    }

    try {
      setIsDeleting(true);

      const res = await fetch(`/api/hr/admin/leaves/${leave.id}/delete`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถลบใบลาได้');
      }

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }

      // Show success with R2 errors warning if any
      if (data.r2Errors && data.r2Errors.length > 0) {
        toast.success(
          `ลบใบลา ${leave.leaveNo} ถาวรแล้ว (บางไฟล์ใน R2 ลบไม่สำเร็จ: ${data.r2Errors.join(', ')})`
        );
      } else {
        toast.success(`ลบใบลา ${leave.leaveNo} ถาวรแล้ว`);
      }

      // Redirect to leaves list
      router.push('/hr/leaves');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถลบใบลาได้');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-40 bg-white dark:bg-slate-900 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!leave) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">ไม่พบข้อมูลใบลา</p>
        </div>
      </div>
    );
  }

  const typeColors = LEAVE_TYPE_COLORS[leave.type];
  const statusColors = LEAVE_STATUS_COLORS[leave.status];
  const displayType =
    leave.type === 'other' && leave.customTypeName
      ? leave.customTypeName
      : LEAVE_TYPE_LABELS[leave.type];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                รายละเอียดใบลา
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {leave.leaveNo}
              </p>
            </div>

            {leave.status === 'approved' && (
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="พิมพ์ PDF"
              >
                <Printer className={`w-5 h-5 ${isPrinting ? 'animate-pulse' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-3">
        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-1 text-xs rounded-lg border font-medium ${typeColors.light} ${typeColors.dark}`}
              >
                {displayType}
              </span>
              <span
                className={`px-2 py-1 text-xs rounded-lg border font-medium ${statusColors.light} ${statusColors.dark}`}
              >
                {LEAVE_STATUS_LABELS[leave.status]}
              </span>
              {leave.isHalfDay && leave.halfDayPeriod && (
                <span className="px-2 py-1 text-xs rounded-lg border font-medium bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800">
                  {HALF_DAY_PERIOD_LABELS[leave.halfDayPeriod]}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                วันทำการ
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {leave.daysWorking} วัน
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                วันปฏิทิน
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {leave.daysCalendar} วัน
              </p>
            </div>
          </div>
        </motion.div>

        {/* Teacher Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
        >
          <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">
            ข้อมูลครู
          </h2>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {leave.teacher.title}
                {leave.teacher.firstName} {leave.teacher.lastName}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                {leave.teacher.position}
                {leave.teacher.department && ` • ${leave.teacher.department}`}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                รหัส: {leave.teacher.teacherCode}
              </p>
            </div>
          </div>

          {leave.submittedByType === 'hr' && leave.submittedByHr && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-2 p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-xl">🖊️</div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-purple-900 dark:text-purple-100">
                    ยื่นแทนโดย: {leave.submittedByHr.firstName}{' '}
                    {leave.submittedByHr.lastName}
                  </p>
                  {leave.proxyReason && (
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                      เหตุผล: {leave.proxyReason}
                    </p>
                  )}
                  {leave.proxyNote && (
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                      หมายเหตุ: {leave.proxyNote}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Leave Details - Combined Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 space-y-4"
        >
          {/* Date Range */}
          <div>
            <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2.5">
              ช่วงเวลาลา
            </h2>
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-base">
                {formatThaiDate(new Date(leave.startDate), 'd MMMM yyyy')}
                {new Date(leave.endDate).getTime() !==
                  new Date(leave.startDate).getTime() && (
                  <>
                    {' ถึง '}
                    {formatThaiDate(new Date(leave.endDate), 'd MMMM yyyy')}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              เหตุผลการลา
            </h2>
            <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
              {leave.reason}
            </p>
          </div>

          {/* Contact Address */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              ที่อยู่ที่สามารถติดต่อได้
            </h2>
            <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
              {leave.contactAddress}
            </p>
            {leave.contactPhone && (
              <p className="text-slate-600 dark:text-slate-400 mt-1.5 text-sm">
                โทร: {leave.contactPhone}
              </p>
            )}
          </div>
        </motion.div>

        {/* Attachments */}
        {leave.attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
          >
            <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              ไฟล์แนบ ({leave.attachments.length})
            </h2>
            <div className="space-y-2">
              {leave.attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {formatFileSize(file.fileSize)}
                    </p>
                  </div>
                  <a
                    href={file.blobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  </a>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Rejection Reason */}
        {leave.status === 'rejected' && leave.rejectionReason && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-xs font-semibold text-red-900 dark:text-red-100 mb-1.5">
                  เหตุผลที่ไม่อนุมัติ
                </h2>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {leave.rejectionReason}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Approval Info */}
        {leave.status === 'approved' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
          >
            <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">
              ข้อมูลการอนุมัติ
            </h2>
            <div className="space-y-2.5">
              {leave.approverNameSnapshot && (
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {leave.approverNameSnapshot}
                  </p>
                  {leave.approverPositionSnapshot && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {leave.approverPositionSnapshot}
                    </p>
                  )}
                </div>
              )}
              {leave.directorNameSnapshot && (
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {leave.directorNameSnapshot}
                  </p>
                  {leave.directorPositionSnapshot && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {leave.directorPositionSnapshot}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Timestamps */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
        >
          <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            ประวัติ
          </h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">ยื่นเมื่อ:</span>
              <span className="text-slate-900 dark:text-slate-100">
                {formatThaiDateShort(new Date(leave.createdAt))} {new Date(leave.createdAt).toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                })} น.
              </span>
            </div>
            {leave.approvedAt && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  อนุมัติเมื่อ:
                </span>
                <span className="text-slate-900 dark:text-slate-100">
                  {formatThaiDateShort(new Date(leave.approvedAt))} {new Date(leave.approvedAt).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} น.
                </span>
              </div>
            )}
            {leave.printedAt && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  พิมพ์เมื่อ:
                </span>
                <span className="text-slate-900 dark:text-slate-100">
                  {formatThaiDateShort(new Date(leave.printedAt))} {new Date(leave.printedAt).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} น.
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Action buttons */}
        {leave.status === 'approved' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex gap-2.5"
          >
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              พิมพ์ใบลา
            </button>
            <button
              onClick={() => setShowEditDialog(true)}
              className="px-5 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              title="แก้ไขใบลา"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCancelDialog(true)}
              className="px-5 py-2.5 text-sm bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              title="ยกเลิกใบลา"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Danger Zone - Super Admin Only */}
        {hrUser.role === 'super_admin' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 mt-6"
          >
            <div className="flex items-start gap-2.5 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-xs font-bold text-red-900 dark:text-red-100 mb-1">
                  โซนอันตราย
                </h2>
                <p className="text-xs text-red-700 dark:text-red-300">
                  การกระทำในส่วนนี้ไม่สามารถย้อนกลับได้ กรุณาดำเนินการด้วยความระมัดระวัง
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowDeleteDialog(true)}
              className="w-full py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              ลบใบลาถาวร
            </button>
          </motion.div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteDialog && leave && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => {
                if (!isDeleting) {
                  setShowDeleteDialog(false);
                  setDeleteConfirmText('');
                }
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 p-4"
            >
              <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header */}
                <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-red-900 dark:text-red-100 mb-1">
                        ยืนยันการลบถาวร
                      </h2>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        การกระทำนี้ไม่สามารถย้อนกลับได้
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <p className="text-sm text-red-900 dark:text-red-100 font-semibold mb-2">
                      จะลบข้อมูลต่อไปนี้ถาวร:
                    </p>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                      <li>ใบลา {leave.leaveNo}</li>
                      <li>ครู: {leave.teacher.firstName} {leave.teacher.lastName}</li>
                      <li>ประเภท: {leave.type === 'other' && leave.customTypeName ? leave.customTypeName : LEAVE_TYPE_LABELS[leave.type]}</li>
                      <li>วันที่: {formatThaiDateShort(new Date(leave.startDate))} - {formatThaiDateShort(new Date(leave.endDate))}</li>
                      <li>ไฟล์แนบ: {leave.attachments.length} ไฟล์</li>
                    </ul>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      พิมพ์เลขที่ใบลาเพื่อยืนยัน:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={leave.leaveNo}
                      disabled={isDeleting}
                      className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                      พิมพ์ <span className="font-mono font-bold">{leave.leaveNo}</span> เพื่อยืนยัน
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => {
                      if (!isDeleting) {
                        setShowDeleteDialog(false);
                        setDeleteConfirmText('');
                      }
                    }}
                    disabled={isDeleting}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleDeletePermanent}
                    disabled={isDeleting || deleteConfirmText !== leave.leaveNo}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        กำลังลบ...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5" />
                        ยืนยันลบถาวร
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Dialog */}
      {leave && (
        <>
          <EditLeaveDialog
            isOpen={showEditDialog}
            onClose={() => setShowEditDialog(false)}
            onSuccess={fetchLeaveDetail}
            leaveId={leave.id}
            initialData={{
              type: leave.type,
              customTypeName: leave.customTypeName,
              startDate: leave.startDate,
              endDate: leave.endDate,
              isHalfDay: leave.isHalfDay,
              halfDayPeriod: leave.halfDayPeriod,
              reason: leave.reason,
              contactAddress: leave.contactAddress,
              contactPhone: leave.contactPhone,
            }}
          />
          <CancelLeaveDialog
            isOpen={showCancelDialog}
            onClose={() => setShowCancelDialog(false)}
            onSuccess={fetchLeaveDetail}
            leaveId={leave.id}
            leaveNo={leave.leaveNo}
          />
        </>
      )}
    </div>
  );
}
