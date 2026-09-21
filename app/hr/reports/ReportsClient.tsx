'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  Calendar,
  Users,
  FileText,
  History,
  Building,
} from 'lucide-react';
import { toast } from 'sonner';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';

interface ReportsClientProps {
  user: {
    role: 'hr' | 'super_admin';
  };
}

export default function ReportsClient({ user }: ReportsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const reports = [
    {
      id: 'leave-summary',
      title: 'สรุปข้อมูลการลา',
      description: 'รายงานการลาของครูทุกคนแยกตามประเภท',
      icon: Users,
      color: 'sky',
      path: '/hr/reports/leave-summary',
    },
    {
      id: 'all-leaves',
      title: 'รายการใบลาทั้งหมด',
      description: 'รายการใบลาทั้งหมดพร้อมตัวกรองและค้นหา',
      icon: FileText,
      color: 'purple',
      path: '/hr/reports/all-leaves',
    },
    {
      id: 'by-department',
      title: 'สถิติรายกลุ่มสาระ',
      description: 'วันลาเฉลี่ยต่อคนแยกตามกลุ่มสาระ/ฝ่าย',
      icon: Building,
      color: 'amber',
      path: '/hr/reports/by-department',
    },
    {
      id: 'proxy',
      title: 'รายงานใบลาที่ยื่นแทน',
      description: 'ใบลาที่ HR ยื่นแทนครู พร้อมเหตุผล',
      icon: Users,
      color: 'orange',
      path: '/hr/reports/proxy',
    },
    {
      id: 'audit',
      title: 'Audit Log',
      description:
        user.role === 'super_admin'
          ? 'ประวัติการทำงานทั้งหมด'
          : 'ประวัติการทำงาน 90 วันล่าสุด',
      icon: History,
      color: 'red',
      path: '/hr/reports/audit',
      requireSuperAdmin: false,
    },
  ];

  const handleExport = async (reportId: string) => {
    try {
      setLoading(reportId);

      let url = '';
      let filename = '';

      switch (reportId) {
        case 'leave-summary':
          toast.info('กรุณาเลือกปีและรอบในหน้ารายงาน');
          return;
        case 'by-department':
          url = '/api/hr/reports/by-department?format=excel';
          filename = 'leaves-by-department.xlsx';
          break;
        case 'proxy':
          url = '/api/hr/reports/leaves-proxy?format=excel';
          filename = 'leaves-proxy.xlsx';
          break;
        case 'audit':
          url = '/api/hr/reports/audit-log?format=excel';
          filename = 'audit-log.xlsx';
          break;
        default:
          throw new Error('Unknown report type');
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('ดาวน์โหลดสำเร็จ');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('ไม่สามารถ Export ได้');
    } finally {
      setLoading(null);
    }
  };

  return (
    <HrLayoutWrapper
      hrUser={{
        id: '',
        firstName: '',
        lastName: '',
        role: user.role,
      }}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors lg:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  รายงาน
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  รายงานและสถิติการลา
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report, idx) => {
              if (report.requireSuperAdmin && user.role !== 'super_admin') {
                return null;
              }

              const Icon = report.icon;
              const isLoading = loading === report.id;

              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
                >
                  <div
                    className={`p-3 bg-${report.color}-100 dark:bg-${report.color}-900/30 rounded-xl w-fit mb-4`}
                  >
                    <Icon
                      className={`w-6 h-6 text-${report.color}-600 dark:text-${report.color}-400`}
                    />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {report.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {report.description}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(report.path)}
                      className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg transition-colors text-sm font-medium"
                    >
                      ดูรายงาน
                    </button>
                    <button
                      onClick={() => handleExport(report.id)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </main>
      </div>
    </HrLayoutWrapper>
  );
}
