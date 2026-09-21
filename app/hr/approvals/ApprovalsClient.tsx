'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  ChevronRight,
  User,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveType, HalfDayPeriod } from '@/types/leave';
import { formatThaiDateShort } from '@/lib/thaiDate';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  HALF_DAY_PERIOD_LABELS,
} from '@/types/leave';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';

interface ApprovalsClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
}

interface PendingLeave {
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
  exceedsQuota: boolean;
  quotaDetails?: {
    type: string;
    used: number;
    quota: number;
    exceeds: number;
  };
}

export default function ApprovalsClient({ hrUser }: ApprovalsClientProps) {
  const router = useRouter();
  const [leaves, setLeaves] = useState<PendingLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeaves, setSelectedLeaves] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingLeave, setRejectingLeave] = useState<PendingLeave | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvingLeave, setApprovingLeave] = useState<PendingLeave | null>(null);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    fetchPendingLeaves();
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPendingLeaves();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Escape to close dialogs
      if (e.key === 'Escape') {
        setShowApproveDialog(false);
        setShowRejectDialog(false);
      }

      // Ctrl/Cmd + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && leaves.length > 0) {
        e.preventDefault();
        setSelectedLeaves(new Set(leaves.map(l => l.id)));
      }

      // Ctrl/Cmd + D to deselect all
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedLeaves.size > 0) {
        e.preventDefault();
        setSelectedLeaves(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [leaves, selectedLeaves]);

  // Pull-to-refresh
  useEffect(() => {
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger at top of page
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        setPullStartY(startY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY === 0 || window.scrollY > 0) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY;

      if (distance > 0 && distance < 100) {
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 60) {
        setIsPullRefreshing(true);
        await fetchPendingLeaves();
        setIsPullRefreshing(false);
      }

      setPullDistance(0);
      setPullStartY(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, pullStartY]);

  const fetchPendingLeaves = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hr/approvals/pending');
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'ไม่สามารถโหลดข้อมูลได้');
      }

      const data = await res.json();
      setLeaves(data.leaves);
    } catch (error: any) {
      console.error('Failed to fetch pending leaves:', error);

      let errorMsg = 'ไม่สามารถโหลดรายการรออนุมัติได้';
      let errorDesc = 'กรุณาลองอีกครั้ง หรือรีเฟรชหน้าเว็บ';

      if (error.message === 'Failed to fetch') {
        errorMsg = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
        errorDesc = 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง';
      }

      toast.error(errorMsg, { description: errorDesc });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (leave: PendingLeave) => {
    setApprovingLeave(leave);
    setShowApproveDialog(true);
  };

  const confirmApprove = async () => {
    if (!approvingLeave) return;

    try {
      setProcessingId(approvingLeave.id);

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const res = await fetch(`/api/hr/approvals/${approvingLeave.id}/approve`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('อนุมัติใบลาสำเร็จ', {
        description: `อนุมัติใบลา ${approvingLeave.leaveNo} ของ ${approvingLeave.teacher.firstName} ${approvingLeave.teacher.lastName} แล้ว`
      });

      // Optimistic update
      setLeaves(prev => prev.filter(l => l.id !== approvingLeave.id));
      setShowApproveDialog(false);
      setApprovingLeave(null);
    } catch (error: any) {
      console.error('Approve error:', error);

      let errorMsg = 'ไม่สามารถอนุมัติใบลาได้';
      let errorDesc = error.message || 'กรุณาลองอีกครั้ง';

      if (error.message?.includes('ไม่พบ')) {
        errorDesc = 'ใบลานี้อาจถูกยกเลิกหรืออนุมัติไปแล้ว กรุณารีเฟรชหน้า';
      } else if (error.message === 'Failed to fetch') {
        errorMsg = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
        errorDesc = 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง';
      }

      toast.error(errorMsg, { description: errorDesc });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (leave: PendingLeave) => {
    setRejectingLeave(leave);
    setRejectionReason('');
    setShowRejectDialog(true);
  };

  const confirmReject = async () => {
    if (!rejectingLeave) return;

    if (rejectionReason.trim().length < 10) {
      toast.error('เหตุผลสั้นเกินไป', {
        description: `กรุณากรอกอย่างน้อย 10 ตัวอักษร (ปัจจุบัน ${rejectionReason.trim().length} ตัวอักษร)`
      });
      return;
    }

    try {
      setProcessingId(rejectingLeave.id);

      const res = await fetch(`/api/hr/approvals/${rejectingLeave.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('ไม่อนุมัติใบลาสำเร็จ', {
        description: `ส่งเหตุผลถึง ${rejectingLeave.teacher.firstName} ${rejectingLeave.teacher.lastName} แล้ว`
      });

      // Optimistic update
      setLeaves(prev => prev.filter(l => l.id !== rejectingLeave.id));
      setShowRejectDialog(false);
      setRejectingLeave(null);
    } catch (error: any) {
      console.error('Reject error:', error);

      let errorMsg = 'ไม่สามารถปฏิเสธใบลาได้';
      let errorDesc = error.message || 'กรุณาลองอีกครั้ง';

      if (error.message === 'Failed to fetch') {
        errorMsg = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
        errorDesc = 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง';
      }

      toast.error(errorMsg, { description: errorDesc });
    } finally {
      setProcessingId(null);
    }
  };

  const handleMultiApprove = async () => {
    if (selectedLeaves.size === 0) return;

    const confirmed = confirm(`คุณต้องการอนุมัติ ${selectedLeaves.size} ใบลาหรือไม่?`);
    if (!confirmed) return;

    try {
      const promises = Array.from(selectedLeaves).map(id =>
        fetch(`/api/hr/approvals/${id}/approve`, { method: 'POST' })
      );

      await Promise.all(promises);

      toast.success(`อนุมัติ ${selectedLeaves.size} ใบลาสำเร็จ`);
      setSelectedLeaves(new Set());
      fetchPendingLeaves();
    } catch (error) {
      console.error('Multi-approve error:', error);
      toast.error('เกิดข้อผิดพลาดในการอนุมัติบางใบลา');
    }
  };

  const toggleSelect = (leaveId: string) => {
    const newSelected = new Set(selectedLeaves);
    if (newSelected.has(leaveId)) {
      newSelected.delete(leaveId);
    } else {
      newSelected.add(leaveId);
    }
    setSelectedLeaves(newSelected);
  };

  const selectAll = () => {
    setSelectedLeaves(new Set(leaves.map(l => l.id)));
    toast.success(`เลือกทั้งหมด ${leaves.length} ใบลา`);
  };

  const deselectAll = () => {
    setSelectedLeaves(new Set());
    toast.success('ยกเลิกการเลือกทั้งหมด');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <HrLayoutWrapper hrUser={hrUser} pendingCount={leaves.length}>
      <div className="bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
        {/* Pull-to-refresh indicator */}
        {pullDistance > 0 && (
          <div
            className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
            style={{ transform: `translateY(${Math.min(pullDistance - 20, 40)}px)` }}
          >
            <div className="bg-white dark:bg-slate-900 rounded-full p-2 shadow-lg">
              <div
                className={`w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full ${isPullRefreshing ? 'animate-spin' : ''}`}
                style={{
                  transform: `rotate(${pullDistance * 3.6}deg)`,
                  transition: isPullRefreshing ? 'none' : 'transform 0.1s'
                }}
              />
            </div>
          </div>
        )}

        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                รออนุมัติ
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {leaves.length} ใบลา
                {selectedLeaves.size > 0 && (
                  <span className="ml-2 text-sky-600 dark:text-sky-400">
                    • เลือก {selectedLeaves.size} ใบลา
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {leaves.length > 0 && selectedLeaves.size === 0 && (
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                >
                  เลือกทั้งหมด
                </button>
              )}

              {selectedLeaves.size > 0 && selectedLeaves.size < leaves.length && (
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                >
                  เลือกทั้งหมด
                </button>
              )}

              {selectedLeaves.size > 0 && (
                <>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleMultiApprove}
                    className="px-3 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    อนุมัติ {selectedLeaves.size}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          {leaves.length > 0 && (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 hidden lg:block">
              💡 Ctrl+A เลือกทั้งหมด • Ctrl+D ยกเลิกการเลือก • Esc ปิด dialog
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 bg-white dark:bg-slate-900 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
              ไม่มีใบลารออนุมัติ 🎉
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              พักสายตาสักครู่ได้เลย
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaves.map((leave, idx) => {
              const typeColors = LEAVE_TYPE_COLORS[leave.type];
              const displayType =
                leave.type === 'other' && leave.customTypeName
                  ? leave.customTypeName
                  : LEAVE_TYPE_LABELS[leave.type];

              const isSelected = selectedLeaves.has(leave.id);
              const isProcessing = processingId === leave.id;

              return (
                <motion.div
                  key={leave.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`
                    bg-white dark:bg-slate-900 rounded-xl shadow-sm border-2 transition-all
                    ${
                      isSelected
                        ? 'border-sky-500 dark:border-sky-400'
                        : 'border-slate-200 dark:border-slate-800'
                    }
                  `}
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
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(leave.id)}
                          className="w-4 h-4 text-sky-500 rounded border-slate-300 focus:ring-sky-500"
                        />
                        <div>
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
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {leave.leaveNo}
                          </p>
                        </div>
                      </div>
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
                            🖊️ ยื่นแทนโดย: {leave.submittedByHr.firstName}{' '}
                            {leave.submittedByHr.lastName}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Date range */}
                    <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 mb-2.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs">
                        {formatThaiDateShort(new Date(leave.startDate))}
                        {new Date(leave.endDate).getTime() !==
                          new Date(leave.startDate).getTime() && (
                          <>
                            {' - '}
                            {formatThaiDateShort(new Date(leave.endDate))}
                          </>
                        )}
                      </span>
                    </div>

                    {/* Days summary */}
                    <div className="grid grid-cols-2 gap-2 mb-2.5">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-0.5">
                          วันทำการ
                        </p>
                        <p className="text-base font-bold text-blue-700 dark:text-blue-300">
                          {leave.daysWorking} วัน
                        </p>
                      </div>
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <p className="text-xs text-purple-600 dark:text-purple-400 mb-0.5">
                          ปฏิทิน
                        </p>
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
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">
                            เหตุผล:
                          </p>
                          <p className="text-xs text-slate-900 dark:text-slate-100">
                            {leave.reason}
                          </p>
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
                            <div
                              key={file.id}
                              className="text-xs text-slate-600 dark:text-slate-400 truncate"
                            >
                              {file.fileName} ({formatFileSize(file.fileSize)})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
                      <Clock className="w-3 h-3" />
                      <span>
                        ยื่นเมื่อ {formatThaiDateShort(new Date(leave.createdAt))} {new Date(leave.createdAt).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} น.
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleApprove(leave)}
                        disabled={isProcessing}
                        className="py-2.5 text-sm bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">อนุมัติ</span>
                      </button>

                      <button
                        onClick={() => handleReject(leave)}
                        disabled={isProcessing}
                        className="py-2.5 text-sm bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-red-500 text-red-600 dark:text-red-400 rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">ไม่อนุมัติ</span>
                      </button>

                      <button
                        onClick={() => router.push(`/hr/leaves/${leave.id}`)}
                        className="py-2.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">ดู</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Approve confirmation dialog */}
      <AnimatePresence>
        {showApproveDialog && approvingLeave && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApproveDialog(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    ยืนยันการอนุมัติ
                  </h3>
                  <button
                    onClick={() => setShowApproveDialog(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {approvingLeave.teacher.title}{approvingLeave.teacher.firstName}{' '}
                        {approvingLeave.teacher.lastName}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {approvingLeave.teacher.position}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{approvingLeave.leaveNo}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>
                        {formatThaiDateShort(new Date(approvingLeave.startDate))}
                        {new Date(approvingLeave.endDate).getTime() !==
                          new Date(approvingLeave.startDate).getTime() && (
                          <>
                            {' - '}
                            {formatThaiDateShort(new Date(approvingLeave.endDate))}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{approvingLeave.daysWorking} วันทำการ</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  คุณต้องการอนุมัติใบลานี้หรือไม่? การอนุมัติจะมีผลทันที และไม่สามารถยกเลิกได้ในภายหลัง
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowApproveDialog(false)}
                    disabled={processingId !== null}
                    className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={confirmApprove}
                    disabled={processingId !== null}
                    className="py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processingId ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>กำลังอนุมัติ...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>ยืนยันอนุมัติ</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Reject dialog */}
      <AnimatePresence>
        {showRejectDialog && rejectingLeave && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRejectDialog(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    ไม่อนุมัติใบลา
                  </h3>
                  <button
                    onClick={() => setShowRejectDialog(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {rejectingLeave.teacher.title}{rejectingLeave.teacher.firstName}{' '}
                    {rejectingLeave.teacher.lastName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {rejectingLeave.leaveNo}
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    เหตุผลที่ไม่อนุมัติ <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="กรุณาระบุเหตุผลอย่างละเอียด (อย่างน้อย 10 ตัวอักษร)"
                    rows={4}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all resize-none"
                  />
                  <p
                    className={`text-xs mt-1 ${
                      rejectionReason.length < 10
                        ? 'text-red-500'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {rejectionReason.length < 10
                      ? `ต้องการอีก ${10 - rejectionReason.length} ตัวอักษร`
                      : '✓ เหตุผลครบถ้วน'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowRejectDialog(false)}
                    className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-semibold transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={confirmReject}
                    disabled={rejectionReason.trim().length < 10 || processingId !== null}
                    className="py-3 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processingId ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4" />
                        <span>ยืนยันไม่อนุมัติ</span>
                      </>
                    )}
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
