'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Clock,
  User,
  MapPin,
  Trash2,
  AlertTriangle,
  Paperclip,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseError } from '@/lib/errorMessages';
import type { LeaveType, LeaveStatus } from '@/types/leave';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_COLORS,
} from '@/types/leave';
import { formatThaiDate, formatThaiDateShort } from '@/lib/thaiDate';

interface LeaveDetailClientProps {
  leaveId: string;
  teacher: {
    id: string;
    teacherCode: string;
    firstName: string;
    lastName: string;
  };
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
}

interface Leave {
  id: string;
  leaveNo: string;
  type: LeaveType;
  customTypeName?: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: 'morning' | 'afternoon';
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
  attachments: Attachment[];
  createdAt: string;
  approvedAt?: string;
  printedAt?: string;
}

export default function LeaveDetailClient({ leaveId, teacher }: LeaveDetailClientProps) {
  const router = useRouter();
  const [leave, setLeave] = useState<Leave | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchLeave();
  }, [leaveId]);

  const fetchLeave = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teacher/leaves/${leaveId}`);

      if (res.status === 404) {
        toast.error('ไม่พบใบลา');
        router.push('/teacher/history');
        return;
      }

      if (res.status === 403) {
        toast.error('คุณไม่มีสิทธิ์เข้าถึงใบลานี้');
        router.push('/teacher/history');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      setLeave(data.leave);
    } catch (error: any) {
      console.error('Failed to fetch leave:', error);
      const errorMsg = parseError(error, 'ไม่สามารถโหลดข้อมูลใบลาได้');
      toast.error(errorMsg.title, { description: errorMsg.description });
      router.push('/teacher/history');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelLeave = async () => {
    const confirmed = confirm(
      'คุณต้องการยกเลิกใบลานี้หรือไม่?\n\nการยกเลิกจะไม่สามารถยกเลิกคำขอยกเลิกได้'
    );
    if (!confirmed) return;

    try {
      setCancelling(true);

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const res = await fetch(`/api/teacher/leaves/${leaveId}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('ยกเลิกใบลาสำเร็จ');
      router.push('/teacher/history');
    } catch (error: any) {
      console.error('Cancel error:', error);
      toast.error(error.message || 'ไม่สามารถยกเลิกใบลาได้');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusIcon = (status: LeaveStatus) => {
    switch (status) {
      case 'approved':
        return '✓';
      case 'rejected':
        return '✕';
      case 'cancelled':
        return '⊗';
      default:
        return '⏱';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white dark:bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </main>
      </div>
    );
  }

  if (!leave) {
    return null;
  }

  const typeColors = LEAVE_TYPE_COLORS[leave.type];
  const statusColors = LEAVE_STATUS_COLORS[leave.status];
  const displayType =
    leave.type === 'other' && leave.customTypeName
      ? leave.customTypeName
      : LEAVE_TYPE_LABELS[leave.type];
  const canCancel = leave.status === 'pending';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                รายละเอียดใบลา
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">{leave.leaveNo}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-1 text-xs rounded-lg border ${typeColors.light} ${typeColors.dark}`}
              >
                {displayType}
              </span>
              <span
                className={`px-2 py-1 text-xs rounded-lg border ${statusColors.light} ${statusColors.dark} flex items-center gap-1`}
              >
                <span>{getStatusIcon(leave.status)}</span>
                {LEAVE_STATUS_LABELS[leave.status]}
              </span>
              {leave.submittedByType === 'hr' && (
                <span className="px-2 py-1 text-xs rounded-lg border bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800">
                  ยื่นโดยฝ่ายบุคคล
                </span>
              )}
            </div>
          </div>

          {leave.submittedByType === 'hr' && leave.submittedByHr && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg mb-3">
              <p className="text-xs text-purple-900 dark:text-purple-100">
                <span className="font-medium">ยื่นแทนโดย:</span>{' '}
                {leave.submittedByHr.firstName} {leave.submittedByHr.lastName}
              </p>
              {leave.proxyReason && (
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                  <span className="font-medium">เหตุผล:</span> {leave.proxyReason}
                </p>
              )}
            </div>
          )}

          {leave.status === 'rejected' && leave.rejectionReason && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-900 dark:text-red-100 mb-1">
                    เหตุผลที่ไม่อนุมัติ:
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300">{leave.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Date & Duration */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">ช่วงเวลา</h2>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">เริ่มต้น</span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatThaiDateShort(new Date(leave.startDate))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">สิ้นสุด</span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatThaiDateShort(new Date(leave.endDate))}
              </span>
            </div>
            {leave.isHalfDay && leave.halfDayPeriod && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">ช่วงเวลา</span>
                <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                  {leave.halfDayPeriod === 'morning' ? 'ครึ่งเช้า' : 'ครึ่งบ่าย'}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-400">รวม</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {leave.daysWorking} วันทำการ
              </span>
            </div>
          </div>
        </motion.div>

        {/* Reason & Contact */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">รายละเอียด</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                เหตุผลการลา
              </p>
              <p className="text-sm text-slate-900 dark:text-slate-100">{leave.reason}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                ที่อยู่ติดต่อระหว่างลา
              </p>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-900 dark:text-slate-100">{leave.contactAddress}</p>
              </div>
              {leave.contactPhone && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 ml-6">
                  โทร: {leave.contactPhone}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Attachments */}
        {leave.attachments && leave.attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                ไฟล์แนบ ({leave.attachments.length})
              </h2>
            </div>
            <div className="space-y-2">
              {leave.attachments.map((file) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Paperclip className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatFileSize(file.fileSize)}
                      </p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 flex-shrink-0" />
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Timeline</h2>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-2 h-2 bg-sky-600 dark:bg-sky-400 rounded-full mt-1.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">ยื่นใบลา</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatThaiDateShort(new Date(leave.createdAt))}
                </p>
              </div>
            </div>
            {leave.approvedAt && (
              <div className="flex gap-3">
                <div className="w-2 h-2 bg-emerald-600 dark:bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">อนุมัติ</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatThaiDateShort(new Date(leave.approvedAt))}
                  </p>
                </div>
              </div>
            )}
            {leave.printedAt && (
              <div className="flex gap-3">
                <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    พิมพ์ใบลา
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatThaiDateShort(new Date(leave.printedAt))}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Cancel Button */}
        {canCancel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <button
              onClick={handleCancelLeave}
              disabled={cancelling}
              className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-red-200 dark:border-red-800"
            >
              {cancelling ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-400 border-t-red-600 rounded-full animate-spin" />
                  <span>กำลังยกเลิก...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>ยกเลิกใบลา</span>
                </>
              )}
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
