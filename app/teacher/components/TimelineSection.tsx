'use client';

import { motion } from 'framer-motion';
import { Calendar, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { formatThaiDate, formatThaiDateShort } from '@/lib/thaiDate';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, LEAVE_STATUS_LABELS } from '@/types/leave';
import type { LeaveType, LeaveStatus } from '@/types/leave';

interface TimelineLeave {
  id: string;
  leaveNo: string;
  type: LeaveType;
  customTypeName?: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  daysWorking: number;
  isHalfDay: boolean;
  halfDayPeriod?: 'morning' | 'afternoon' | null;
}

interface TimelineSectionProps {
  timeline: Record<string, TimelineLeave[]>;
  periodLabel: string;
  fiscalYear: number;
  stats: {
    totalDays: number;
    totalCount: number;
  };
  onLeaveClick: (id: string) => void;
}

export default function TimelineSection({
  timeline,
  periodLabel,
  fiscalYear,
  stats,
  onLeaveClick
}: TimelineSectionProps) {
  // Sort months descending (newest first)
  const sortedMonths = Object.entries(timeline).sort(([a], [b]) => b.localeCompare(a));

  // Flatten leaves with month info for zigzag pattern
  const allLeaves: Array<{ monthKey: string; leave: TimelineLeave; index: number }> = [];
  sortedMonths.forEach(([monthKey, leaves]) => {
    leaves.forEach((leave, idx) => {
      allLeaves.push({ monthKey, leave, index: allLeaves.length });
    });
  });

  // Limit to 10 most recent leaves
  const displayLeaves = allLeaves.slice(0, 10);

  const getStatusIcon = (status: LeaveStatus) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'rejected':
        return <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />;
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      default:
        return <AlertCircle className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getStatusColor = (status: LeaveStatus) => {
    switch (status) {
      case 'approved':
        return 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30';
      case 'rejected':
        return 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30';
      case 'pending':
        return 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30';
      default:
        return 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30';
    }
  };

  if (displayLeaves.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
      {/* Header with period info */}
      <div className="mb-4 p-3 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 rounded-lg border border-sky-200 dark:border-sky-800">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h2 className="text-base font-bold text-sky-900 dark:text-sky-100">
            {periodLabel}/{fiscalYear}
          </h2>
        </div>
        <p className="text-xs text-sky-700 dark:text-sky-400">
          รวม {stats.totalDays} วัน • {stats.totalCount} ครั้ง (อนุมัติแล้ว)
        </p>
      </div>

      {/* Zigzag Timeline */}
      <div className="relative">
        {/* Center vertical line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-sky-200 via-slate-200 to-transparent dark:from-sky-800 dark:via-slate-700 -translate-x-1/2" />

        <div className="space-y-6">
          {displayLeaves.map(({ monthKey, leave, index }) => {
            const isLeft = index % 2 === 0;
            const typeColors = LEAVE_TYPE_COLORS[leave.type] || LEAVE_TYPE_COLORS['other'];
            const displayType = leave.type === 'other' && leave.customTypeName
              ? leave.customTypeName
              : LEAVE_TYPE_LABELS[leave.type];

            // Month divider (only show when month changes)
            const prevMonthKey = index > 0 ? displayLeaves[index - 1].monthKey : null;
            const showMonthDivider = monthKey !== prevMonthKey;

            // Format month name
            const [year, month] = monthKey.split('-');
            const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const thaiMonthName = formatThaiDate(monthDate, 'MMMM yyyy');

            return (
              <div key={leave.id}>
                {/* Month divider */}
                {showMonthDivider && index > 0 && (
                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                    </div>
                    <div className="relative px-3 py-1 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {thaiMonthName}
                    </div>
                  </div>
                )}

                {/* First month label */}
                {index === 0 && (
                  <div className="relative flex items-center justify-center mb-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-sky-300 dark:border-sky-700" />
                    </div>
                    <div className="relative px-3 py-1 bg-sky-100 dark:bg-sky-900/50 text-xs font-bold text-sky-700 dark:text-sky-300 rounded-full">
                      {thaiMonthName}
                    </div>
                  </div>
                )}

                {/* Timeline item */}
                <motion.div
                  initial={{ opacity: 0, x: isLeft ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  <div className={`flex ${isLeft ? 'flex-row' : 'flex-row-reverse'} items-center gap-3`}>
                    {/* Card */}
                    <div className={`w-[calc(50%-20px)] ${isLeft ? 'text-right' : 'text-left'}`}>
                      <div
                        onClick={() => onLeaveClick(leave.id)}
                        className={`inline-block p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${getStatusColor(leave.status)} ${isLeft ? 'ml-auto' : 'mr-auto'}`}
                      >
                        {/* Leave type badge */}
                        <div className={`flex items-center gap-1.5 mb-2 ${isLeft ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className={`px-2 py-0.5 text-xs rounded border ${typeColors.light} ${typeColors.dark} font-medium`}>
                            {displayType}
                          </span>
                          {leave.isHalfDay && leave.halfDayPeriod && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {leave.halfDayPeriod === 'morning' ? 'ครึ่งเช้า' : 'ครึ่งบ่าย'}
                            </span>
                          )}
                        </div>

                        {/* Days */}
                        <div className={`text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 ${isLeft ? 'text-right' : 'text-left'}`}>
                          {leave.daysWorking} วัน
                        </div>

                        {/* Date range */}
                        <div className={`text-xs text-slate-600 dark:text-slate-400 mb-2 ${isLeft ? 'text-right' : 'text-left'}`}>
                          {leave.startDate === leave.endDate ? (
                            formatThaiDateShort(new Date(leave.startDate))
                          ) : (
                            <>
                              {formatThaiDateShort(new Date(leave.startDate))}
                              {' - '}
                              {formatThaiDateShort(new Date(leave.endDate))}
                            </>
                          )}
                        </div>

                        {/* Status */}
                        <div className={`flex items-center gap-1 text-xs ${isLeft ? 'flex-row-reverse' : 'flex-row'}`}>
                          {getStatusIcon(leave.status)}
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {LEAVE_STATUS_LABELS[leave.status]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Center dot */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-slate-900 border-2 border-sky-400 dark:border-sky-600 flex items-center justify-center relative z-10">
                      <div className="w-3 h-3 rounded-full bg-sky-400 dark:bg-sky-600" />
                    </div>

                    {/* Empty space on other side */}
                    <div className="w-[calc(50%-20px)]" />
                  </div>

                  {/* Connector line to dot */}
                  <div
                    className={`absolute top-5 ${isLeft ? 'right-[calc(50%+20px)]' : 'left-[calc(50%+20px)]'} ${isLeft ? 'left-[calc(50%-20px)]' : 'right-[calc(50%-20px)]'} h-0.5 bg-sky-200 dark:bg-sky-800`}
                    style={{ width: '20px' }}
                  />
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* View all link */}
        {allLeaves.length > 10 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-center"
          >
            <button
              onClick={() => onLeaveClick('')}
              className="text-sm text-sky-600 dark:text-sky-400 hover:underline font-medium"
            >
              ดูประวัติทั้งหมด ({allLeaves.length - 10} ใบที่เหลือ) →
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
