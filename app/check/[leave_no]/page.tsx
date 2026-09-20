'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  User,
  FileText,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

interface LeaveVerification {
  leaveNo: string;
  teacher: {
    name: string;
    code: string;
  };
  type: string;
  dateRange: string;
  daysWorking: number;
  status: string;
  submittedAt: string;
  approvedAt: string | null;
}

export default function CheckLeavePage() {
  const params = useParams();
  const router = useRouter();
  const leaveNo = params.leave_no as string;

  const [leave, setLeave] = useState<LeaveVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchLeave();
  }, [leaveNo]);

  const fetchLeave = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/check/${leaveNo}`);

      if (!res.ok) {
        if (res.status === 404) {
          setNotFound(true);
        } else {
          toast.error('ไม่สามารถโหลดข้อมูลได้');
        }
        return;
      }

      const data = await res.json();
      setLeave(data);
    } catch (error) {
      console.error('Failed to fetch leave:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status.includes('อนุมัติแล้ว')) return 'text-green-600 bg-green-50 border-green-200';
    if (status.includes('ไม่อนุมัติ')) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  const getStatusIcon = (status: string) => {
    if (status.includes('อนุมัติแล้ว'))
      return <CheckCircle2 className="w-8 h-8 text-green-600" />;
    if (status.includes('ไม่อนุมัติ'))
      return <XCircle className="w-8 h-8 text-red-600" />;
    return <Clock className="w-8 h-8 text-amber-600" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">กำลังตรวจสอบ...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              ไม่พบใบลา
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              ไม่พบใบลาเลขที่ <span className="font-mono font-medium">{leaveNo}</span> ในระบบ
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              กลับหน้าหลัก
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!leave) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 rounded-full mb-4">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">ตรวจสอบใบลา</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {leave.leaveNo}
            </h1>
          </div>

          {/* Status Card */}
          <div className={`border rounded-2xl p-6 ${getStatusColor(leave.status)}`}>
            <div className="flex items-center gap-4">
              {getStatusIcon(leave.status)}
              <div className="flex-1">
                <div className="text-sm opacity-75 mb-1">สถานะ</div>
                <div className="text-lg font-bold">{leave.status}</div>
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-slate-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  ผู้ยื่นใบลา
                </div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {leave.teacher.name}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-500">
                  รหัส: {leave.teacher.code}
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  ประเภทการลา
                </div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {leave.type}
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  ช่วงเวลาลา
                </div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {leave.dateRange}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                  รวม {leave.daysWorking} วันทำการ
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
              ประวัติ
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-sky-500 rounded-full mt-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    ยื่นใบลา
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {leave.submittedAt}
                  </div>
                </div>
              </div>

              {leave.approvedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      อนุมัติ
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {leave.approvedAt}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400 text-center">
            ข้อมูลนี้เป็นการตรวจสอบสถานะใบลาเท่านั้น
            <br />
            ไม่แสดงรายละเอียดส่วนบุคคลหรือเหตุผลการลา
          </div>

          {/* Back Button */}
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            กลับหน้าหลัก
          </button>
        </motion.div>
      </div>
    </div>
  );
}
