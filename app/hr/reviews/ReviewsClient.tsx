'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, FileText, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { canReview, type HrRole } from '@/lib/roles';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import LeaveReviewCard from '@/components/hr/leaveReview/LeaveReviewCard';
import LeaveReviewShell from '@/components/hr/leaveReview/LeaveReviewShell';
import ConfirmLeaveDialog from '@/components/hr/leaveReview/ConfirmLeaveDialog';
import RejectLeaveDialog from '@/components/hr/leaveReview/RejectLeaveDialog';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { fetchLeaveList, postLeaveAction, vibrate } from '@/components/hr/leaveReview/api';
import type { ReviewLeave } from '@/components/hr/leaveReview/types';

interface ReviewsClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: HrRole;
  };
}

type Tab = 'pending' | 'reviewed';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'pending', label: 'รอตรวจสอบ' },
  { key: 'reviewed', label: 'ส่งต่อแล้ว' },
];

// หน้าตรวจใบลา: แท็บ "รอตรวจสอบ" (pending) ตรวจผ่าน/ตีกลับ, แท็บ "ส่งต่อแล้ว" (reviewed) ดึงกลับ
// hr และ super_admin ทำได้ ส่วน ผอ. ดูได้อย่างเดียว
export default function ReviewsClient({ hrUser }: ReviewsClientProps) {
  const router = useRouter();
  const canAct = canReview(hrUser.role);
  const [tab, setTab] = useState<Tab>('pending');
  const [leaves, setLeaves] = useState<ReviewLeave[]>([]);
  const [total, setTotal] = useState(0);
  const latestRequestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewingLeave, setReviewingLeave] = useState<ReviewLeave | null>(null);
  const [rejectingLeave, setRejectingLeave] = useState<ReviewLeave | null>(null);
  const [recallingLeave, setRecallingLeave] = useState<ReviewLeave | null>(null);

  const loadLeaves = useCallback(
    async (showSkeleton = true) => {
      if (showSkeleton) setLoading(true);
      const requestId = ++latestRequestRef.current;
      const data = await fetchLeaveList(
        `/api/hr/reviews/pending?status=${tab}`,
        'ไม่สามารถโหลดรายการใบลาได้'
      );
      // ทิ้งผลของ request เก่า (เช่น สลับแท็บเร็ว ๆ แล้ว response แท็บก่อนหน้ามาช้า)
      if (requestId !== latestRequestRef.current) return;
      if (data) {
        setLeaves(data.leaves);
        setTotal(data.total);
      }
      setLoading(false);
    },
    [tab]
  );

  useEffect(() => {
    loadLeaves();
    // Auto-refresh every 60 seconds, but not while the tab is hidden
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadLeaves(false);
    }, 60000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadLeaves(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadLeaves]);

  const { pull, state: pullState, threshold: pullThreshold } = usePullToRefresh(() => loadLeaves(false));

  const removeLeave = (id: string) => {
    setLeaves((prev) => prev.filter((l) => l.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  };

  const confirmReview = async () => {
    if (!reviewingLeave) return;
    const leave = reviewingLeave;
    setProcessingId(leave.id);
    vibrate();

    const ok = await postLeaveAction(`/api/hr/reviews/${leave.id}/approve`, 'ไม่สามารถตรวจผ่านใบลาได้');
    if (ok) {
      toast.success('ตรวจผ่านแล้ว', {
        description: `ส่งใบลา ${leave.leaveNo} ให้ ผอ. อนุมัติแล้ว`,
      });
      removeLeave(leave.id);
    } else {
      loadLeaves(false);
    }
    setReviewingLeave(null);
    setProcessingId(null);
  };

  const confirmReject = async (reason: string) => {
    if (!rejectingLeave) return;
    const leave = rejectingLeave;
    setProcessingId(leave.id);

    const ok = await postLeaveAction(`/api/hr/reviews/${leave.id}/reject`, 'ไม่สามารถตีกลับใบลาได้', {
      reason,
    });
    if (ok) {
      toast.success('ตีกลับใบลาแล้ว', {
        description: `ส่งเหตุผลถึง ${leave.teacher.firstName} ${leave.teacher.lastName} แล้ว`,
      });
      removeLeave(leave.id);
      setRejectingLeave(null);
    } else {
      loadLeaves(false);
    }
    setProcessingId(null);
  };

  const confirmRecall = async () => {
    if (!recallingLeave) return;
    const leave = recallingLeave;
    setProcessingId(leave.id);

    const ok = await postLeaveAction(`/api/hr/reviews/${leave.id}/recall`, 'ไม่สามารถดึงกลับใบลาได้');
    if (ok) {
      toast.success('ดึงกลับแล้ว', {
        description: `ใบลา ${leave.leaveNo} กลับไปอยู่ที่ "รอตรวจสอบ"`,
      });
      removeLeave(leave.id);
    } else {
      loadLeaves(false);
    }
    setRecallingLeave(null);
    setProcessingId(null);
  };

  const closeReview = useCallback(() => setReviewingLeave(null), []);
  const closeReject = useCallback(() => setRejectingLeave(null), []);
  const closeRecall = useCallback(() => setRecallingLeave(null), []);

  const tabBar = (
    <div role="tablist" aria-label="สถานะใบลา" className="mt-3 grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
      {TABS.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => setTab(t.key)}
          className={`py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === t.key
              ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  const isPendingTab = tab === 'pending';

  return (
    <HrLayoutWrapper hrUser={hrUser}>
      <LeaveReviewShell
        title="ตรวจใบลา"
        subtitle={`${isPendingTab ? 'รอตรวจสอบ' : 'ส่งต่อแล้ว รอ ผอ. อนุมัติ'} ${total} ใบลา`}
        pull={pull}
        pullState={pullState}
        pullThreshold={pullThreshold}
        onRefresh={() => loadLeaves(false)}
        readOnlyNote={canAct ? undefined : 'ดูได้อย่างเดียว การตรวจใบลาเป็นของเจ้าหน้าที่ HR'}
        headerExtra={tabBar}
        loading={loading}
        isEmpty={leaves.length === 0}
        emptyTitle={isPendingTab ? 'ไม่มีใบลารอตรวจสอบ' : 'ไม่มีใบลาที่ส่งต่อแล้ว'}
        emptyDescription={
          isPendingTab ? 'ใบลาที่ครูยื่นเข้ามาจะแสดงที่นี่' : 'ใบลาที่ตรวจผ่านและรอ ผอ. อนุมัติจะแสดงที่นี่'
        }
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

          let actions;
          if (!canAct) {
            actions = <div className="grid grid-cols-1">{viewButton}</div>;
          } else if (isPendingTab) {
            actions = (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setReviewingLeave(leave)}
                  disabled={isProcessing}
                  className="py-2.5 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>ตรวจผ่าน</span>
                </button>
                <button
                  onClick={() => setRejectingLeave(leave)}
                  disabled={isProcessing}
                  className="py-2.5 text-sm bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-red-500 text-red-600 dark:text-red-400 rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>ตีกลับ</span>
                </button>
                {viewButton}
              </div>
            );
          } else {
            actions = (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRecallingLeave(leave)}
                  disabled={isProcessing}
                  className="py-2.5 text-sm bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-2 border-amber-500 text-amber-600 dark:text-amber-400 rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>ดึงกลับ</span>
                </button>
                {viewButton}
              </div>
            );
          }

          return <LeaveReviewCard key={leave.id} leave={leave} index={idx} actions={actions} />;
        })}
      </LeaveReviewShell>

      {canAct && (
        <>
          <ConfirmLeaveDialog
            leave={reviewingLeave}
            title="ยืนยันการตรวจผ่าน"
            message="ใบลานี้จะถูกส่งให้ผู้อำนวยการอนุมัติ และครูจะได้รับแจ้งว่าผ่านการตรวจสอบแล้ว"
            confirmLabel="ยืนยันตรวจผ่าน"
            confirmIcon={<Check className="w-4 h-4" />}
            processingLabel="กำลังบันทึก..."
            processing={processingId !== null}
            tone="sky"
            onConfirm={confirmReview}
            onClose={closeReview}
          />
          <ConfirmLeaveDialog
            leave={recallingLeave}
            title="ยืนยันการดึงกลับ"
            message='ใบลานี้จะกลับไปอยู่ที่ "รอตรวจสอบ" และหายไปจากหน้าอนุมัติของ ผอ. (ไม่มีการแจ้งครู)'
            confirmLabel="ยืนยันดึงกลับ"
            confirmIcon={<Undo2 className="w-4 h-4" />}
            processingLabel="กำลังดึงกลับ..."
            processing={processingId !== null}
            tone="amber"
            onConfirm={confirmRecall}
            onClose={closeRecall}
          />
          <RejectLeaveDialog
            leave={rejectingLeave}
            title="ตีกลับใบลา"
            reasonLabel="เหตุผลที่ตีกลับ"
            confirmLabel="ยืนยันตีกลับ"
            processing={processingId !== null}
            onConfirm={confirmReject}
            onClose={closeReject}
          />
        </>
      )}
    </HrLayoutWrapper>
  );
}
