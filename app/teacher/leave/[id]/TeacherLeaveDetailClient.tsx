'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  MapPin,
  Phone,
  User,
  AlertTriangle,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseError, getSuccessMessage } from '@/lib/errorMessages';
import type { LeaveType, LeaveStatus, HalfDayPeriod } from '@/types/leave';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_COLORS,
  HALF_DAY_PERIOD_LABELS,
} from '@/types/leave';
import { formatThaiDate } from '@/lib/thaiDate';

interface TeacherLeaveDetailClientProps {
  leaveId: string;
  teacher: {
    id: string;
    teacherCode: string;
    firstName: string;
    lastName: string;
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
  daysCalendar: number;
  daysWorking: number;
  reason: string;
  contactAddress: string;
  contactPhone?: string;
  status: LeaveStatus;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TeacherLeaveDetailClient({
  leaveId,
  teacher,
}: TeacherLeaveDetailClientProps) {
  const router = useRouter();
  const [leave, setLeave] = useState<LeaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchLeaveDetail();
  }, [leaveId]);

  const fetchLeaveDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teacher/leaves/${leaveId}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('ไม่พบใบลานี้');
        }
        const error = await res.json();
        throw new Error(error.error || 'ไม่สามารถโหลดข้อมูลได้');
      }

      const data = await res.json();
      setLeave(data.leave);
    } catch (error: any) {
      console.error('Failed to fetch leave detail:', error);
      const errorMsg = parseError(error, 'ไม่สามารถโหลดรายละเอียดใบลาได้');
      toast.error(errorMsg.title, { description: errorMsg.description });

      // Redirect back if not found
      if (error.message?.includes('ไม่พบ')) {
        setTimeout(() => router.push('/teacher'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelLeave = async () => {
    if (!leave) return;

    const confirmed = confirm(
      `คุณต้องการยกเลิกใบลา ${leave.leaveNo} หรือไม่?\n\nการยกเลิกจะไม่สามารถย้อนกลับได้`
    );

    if (!confirmed) return;

    try {
      setCancelling(true);

      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const res = await fetch(`/api/teacher/leaves/${leaveId}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'ไม่สามารถยกเลิกใบลาได้');
      }

      const successMsg = getSuccessMessage('leave_cancelled', {
        leaveNo: leave.leaveNo,
      });
      toast.success(successMsg.title, { description: successMsg.description });

      // Redirect back
      router.push('/teacher');
    } catch (error: any) {
      console.error('Cancel error:', error);
      const errorMsg = parseError(error, 'ไม่สามารถยกเลิกใบลาได้');
      toast.error(errorMsg.title, { description: errorMsg.description });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            กำลังโหลดรายละเอียดใบลา...
          </p>
        </div>
      </div>
    );
  }

  if (!leave) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            ไม่พบใบลา
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            ใบลานี้อาจถูกลบหรือไม่มีอยู่ในระบบ
          </p>
          <button
            onClick={() => router.push('/teacher')}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-medium transition-colors"
          >
            กลับหน้าหลัก
          </button>
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

  const canCancel = leave.status === 'pending' || leave.status === 'approved';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </button>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            รายละเอียดใบลา
          </h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                เลขที่ใบลา
              </p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {leave.leaveNo}
              </p>
            </div>
            <span
              className={`px-3 py-1.5 text-sm rounded-lg border flex items-center gap-1.5 ${statusColors.light} ${statusColors.dark}`}
            >
              {leave.status === 'pending' && (
                <Clock className="w-4 h-4" />
              )}
              {leave.status === 'approved' && (
                <CheckCircle className="w-4 h-4" />
              )}
              {leave.status === 'rejected' && (
                <XCircle className="w-4 h-4" />
              )}
              {LEAVE_STATUS_LABELS[leave.status]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                ประเภทการลา
              </p>
              <span
                className={`inline-block px-2 py-1 text-sm rounded border ${typeColors.light} ${typeColors.dark}`}
              >
                {displayType}
              </span>
            </div>
            {leave.isHalfDay && leave.halfDayPeriod && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  ช่วงเวลา
                </p>
                <span className="inline-block px-2 py-1 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                  {HALF_DAY_PERIOD_LABELS[leave.halfDayPeriod]}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Rejection reason */}
        {leave.status === 'rejected' && leave.rejectionReason && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                  เหตุผลการไม่อนุมัติ
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                  {leave.rejectionReason}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Date range */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              ช่วงวันที่ลา
            </h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                วันที่เริ่มต้น
              </span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatThaiDate(new Date(leave.startDate), 'd MMMM yyyy')}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                วันที่สิ้นสุด
              </span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatThaiDate(new Date(leave.endDate), 'd MMMM yyyy')}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                จำนวนวันลา
              </span>
              <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
                {leave.daysWorking} วัน
              </span>
            </div>
          </div>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              รายละเอียด
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                เหตุผลการลา
              </label>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                {leave.reason}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                ที่อยู่ติดต่อระหว่างลา
              </label>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                {leave.contactAddress}
              </p>
            </div>

            {leave.contactPhone && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  เบอร์โทรติดต่อ
                </label>
                <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  {leave.contactPhone}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Timestamps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              ยื่นเมื่อ: {formatThaiDate(new Date(leave.createdAt), 'd MMM yyyy')}{' '}
              {new Date(leave.createdAt).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {leave.updatedAt !== leave.createdAt && (
              <span>
                อัปเดต: {formatThaiDate(new Date(leave.updatedAt), 'd MMM yyyy')}{' '}
                {new Date(leave.updatedAt).toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </motion.div>

        {/* Cancel button */}
        {canCancel && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={handleCancelLeave}
              disabled={cancelling}
              className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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
