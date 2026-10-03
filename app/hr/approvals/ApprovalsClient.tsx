'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { canApprove, type HrRole } from '@/lib/roles';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import LeaveReviewCard from '@/components/hr/leaveReview/LeaveReviewCard';
import LeaveReviewShell from '@/components/hr/leaveReview/LeaveReviewShell';
import ConfirmLeaveDialog from '@/components/hr/leaveReview/ConfirmLeaveDialog';
import RejectLeaveDialog from '@/components/hr/leaveReview/RejectLeaveDialog';
import { usePullToRefresh } from '@/components/hr/leaveReview/usePullToRefresh';
import { fetchLeaveList, postLeaveAction, vibrate } from '@/components/hr/leaveReview/api';
import type { ReviewLeave } from '@/components/hr/leaveReview/types';

interface ApprovalsClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: HrRole;
  };
}

// หน้าอนุมัติใบลา (ใบที่ HR ตรวจผ่านแล้ว status=reviewed)
// ผอ. และ super_admin อนุมัติ/ไม่อนุมัติได้ ส่วน hr ดูได้อย่างเดียว
export default function ApprovalsClient({ hrUser }: ApprovalsClientProps) {
  const router = useRouter();
  const canAct = canApprove(hrUser.role);
  const [leaves, setLeaves] = useState<ReviewLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvingLeave, setApprovingLeave] = useState<ReviewLeave | null>(null);
  const [rejectingLeave, setRejectingLeave] = useState<ReviewLeave | null>(null);

  const loadLeaves = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    const data = await fetchLeaveList('/api/hr/approvals/pending', 'ไม่สามารถโหลดรายการรออนุมัติได้');
    if (data) setLeaves(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeaves();
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => loadLeaves(false), 60000);
    return () => clearInterval(interval);
  }, [loadLeaves]);

  const { pullDistance, isRefreshing } = usePullToRefresh(() => loadLeaves(false));

  const removeLeave = (id: string) => setLeaves((prev) => prev.filter((l) => l.id !== id));

  const confirmApprove = async () => {
    if (!approvingLeave) return;
    const leave = approvingLeave;
    setProcessingId(leave.id);
    vibrate();

    const ok = await postLeaveAction(`/api/hr/approvals/${leave.id}/approve`, 'ไม่สามารถอนุมัติใบลาได้');
    if (ok) {
      toast.success('อนุมัติใบลาสำเร็จ', {
        description: `อนุมัติใบลา ${leave.leaveNo} ของ ${leave.teacher.firstName} ${leave.teacher.lastName} แล้ว`,
      });
      removeLeave(leave.id);
    } else {
      loadLeaves(false);
    }
    setApprovingLeave(null);
    setProcessingId(null);
  };

  const confirmReject = async (reason: string) => {
    if (!rejectingLeave) return;
    const leave = rejectingLeave;
    setProcessingId(leave.id);

    const ok = await postLeaveAction(`/api/hr/approvals/${leave.id}/reject`, 'ไม่สามารถบันทึกการไม่อนุมัติได้', {
      reason,
    });
    if (ok) {
      toast.success('ไม่อนุมัติใบลาสำเร็จ', {
        description: `ส่งเหตุผลถึง ${leave.teacher.firstName} ${leave.teacher.lastName} แล้ว`,
      });
      removeLeave(leave.id);
      setRejectingLeave(null);
    } else {
      loadLeaves(false);
    }
    setProcessingId(null);
  };

  const closeApprove = useCallback(() => setApprovingLeave(null), []);
  const closeReject = useCallback(() => setRejectingLeave(null), []);

  return (
    <HrLayoutWrapper hrUser={hrUser}>
      <LeaveReviewShell
        title="อนุมัติใบลา"
        subtitle={`รอ ผอ. อนุมัติ ${leaves.length} ใบลา`}
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        readOnlyNote={canAct ? undefined : 'ดูได้อย่างเดียว การอนุมัติเป็นของผู้อำนวยการ'}
        loading={loading}
        isEmpty={leaves.length === 0}
        emptyTitle="ไม่มีใบลารออนุมัติ"
        emptyDescription="ใบลาที่ HR ตรวจผ่านแล้วจะแสดงที่นี่"
      >
        {leaves.map((leave, idx) => {
          const isProcessing = processingId === leave.id;
          const viewButton = (
            <button
              onClick={() => router.push(`/hr/leaves/${leave.id}`)}
              className="py-2.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>ดูรายละเอียด</span>
            </button>
          );

          return (
            <LeaveReviewCard
              key={leave.id}
              leave={leave}
              index={idx}
              actions={
                canAct ? (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setApprovingLeave(leave)}
                      disabled={isProcessing}
                      className="py-2.5 text-sm bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>อนุมัติ</span>
                    </button>
                    <button
                      onClick={() => setRejectingLeave(leave)}
                      disabled={isProcessing}
                      className="py-2.5 text-sm bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-red-500 text-red-600 dark:text-red-400 rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>ไม่อนุมัติ</span>
                    </button>
                    {viewButton}
                  </div>
                ) : (
                  <div className="grid grid-cols-1">{viewButton}</div>
                )
              }
            />
          );
        })}
      </LeaveReviewShell>

      {canAct && (
        <>
          <ConfirmLeaveDialog
            leave={approvingLeave}
            title="ยืนยันการอนุมัติ"
            message="คุณต้องการอนุมัติใบลานี้หรือไม่? การอนุมัติจะมีผลทันที"
            confirmLabel="ยืนยันอนุมัติ"
            confirmIcon={<Check className="w-4 h-4" />}
            processingLabel="กำลังอนุมัติ..."
            processing={processingId !== null}
            tone="emerald"
            onConfirm={confirmApprove}
            onClose={closeApprove}
          />
          <RejectLeaveDialog
            leave={rejectingLeave}
            title="ไม่อนุมัติใบลา"
            reasonLabel="เหตุผลที่ไม่อนุมัติ"
            confirmLabel="ยืนยันไม่อนุมัติ"
            processing={processingId !== null}
            onConfirm={confirmReject}
            onClose={closeReject}
          />
        </>
      )}
    </HrLayoutWrapper>
  );
}
