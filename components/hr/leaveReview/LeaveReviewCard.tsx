'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  AlertTriangle,
  User,
  MessageSquare,
  Paperclip,
  Send,
} from 'lucide-react';
import { formatThaiDateShort } from '@/lib/thaiDate';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  HALF_DAY_PERIOD_LABELS,
} from '@/types/leave';
import type { ReviewLeave } from './types';

interface LeaveReviewCardProps {
  leave: ReviewLeave;
  index: number;
  // ปุ่มด้านล่างการ์ด แต่ละหน้าส่งเข้ามาเอง
  actions: ReactNode;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatDateTime = (iso: string) =>
  `${formatThaiDateShort(new Date(iso))} ${new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })} น.`;

export function formatLeaveDateRange(leave: Pick<ReviewLeave, 'startDate' | 'endDate'>) {
  const start = formatThaiDateShort(new Date(leave.startDate));
  if (new Date(leave.endDate).getTime() === new Date(leave.startDate).getTime()) {
    return start;
  }
  return `${start} - ${formatThaiDateShort(new Date(leave.endDate))}`;
}

export default function LeaveReviewCard({ leave, index, actions }: LeaveReviewCardProps) {
  const typeColors = LEAVE_TYPE_COLORS[leave.type];
  const displayType =
    leave.type === 'other' && leave.customTypeName
      ? leave.customTypeName
      : LEAVE_TYPE_LABELS[leave.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border-2 border-slate-200 dark:border-slate-800 transition-all"
    >
      {/* Quota warning */}
      {leave.exceedsQuota && leave.quotaDetails && (
        <div className="px-3 pt-3">
          <div className="flex items-start gap-2.5 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-red-900 dark:text-red-100 mb-0.5">
                เกินเกณฑ์การลา
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                {leave.quotaDetails.used} / {leave.quotaDetails.quota} วัน
                (เกิน {leave.quotaDetails.exceeds} วัน)
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-3">
        {/* Header */}
        <div className="mb-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`px-1.5 py-0.5 text-xs rounded border ${typeColors.light} ${typeColors.dark}`}
            >
              {displayType}
            </span>
            {leave.isHalfDay && leave.halfDayPeriod && (
              <span className="px-1.5 py-0.5 text-xs rounded border bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800">
                {HALF_DAY_PERIOD_LABELS[leave.halfDayPeriod]}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{leave.leaveNo}</p>
        </div>

        {/* Teacher info */}
        <div className="mb-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {leave.teacher.title}{leave.teacher.firstName} {leave.teacher.lastName}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {leave.teacher.position}
                {leave.teacher.department && ` • ${leave.teacher.department}`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                รหัส: {leave.teacher.teacherCode}
              </p>
            </div>
          </div>

          {leave.submittedByType === 'hr' && leave.submittedByHr && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-purple-600 dark:text-purple-400">
                🖊️ ยื่นแทนโดย: {leave.submittedByHr.firstName} {leave.submittedByHr.lastName}
              </p>
            </div>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 mb-2.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs">{formatLeaveDateRange(leave)}</span>
        </div>

        {/* Days summary */}
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-0.5">วันทำการ</p>
            <p className="text-base font-bold text-blue-700 dark:text-blue-300">
              {leave.daysWorking} วัน
            </p>
          </div>
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-0.5">ปฏิทิน</p>
            <p className="text-base font-bold text-purple-700 dark:text-purple-300">
              {leave.daysCalendar} วัน
            </p>
          </div>
        </div>

        {/* Reason */}
        <div className="mb-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <div className="flex items-start gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">เหตุผล:</p>
              <p className="text-xs text-slate-900 dark:text-slate-100">{leave.reason}</p>
            </div>
          </div>
        </div>

        {/* Attachments */}
        {leave.attachments.length > 0 && (
          <div className="mb-2.5">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Paperclip className="w-3 h-3" />
              ไฟล์แนบ ({leave.attachments.length})
            </p>
            <div className="space-y-0.5">
              {leave.attachments.map((file) => (
                <div key={file.id} className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  {file.fileName} ({formatFileSize(file.fileSize)})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="space-y-0.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>ยื่นเมื่อ {formatDateTime(leave.createdAt)}</span>
          </div>
          {leave.reviewedAt && (
            <div className="flex items-center gap-1.5">
              <Send className="w-3 h-3" />
              <span>ตรวจผ่านเมื่อ {formatDateTime(leave.reviewedAt)}</span>
            </div>
          )}
        </div>

        {actions}
      </div>
    </motion.div>
  );
}
