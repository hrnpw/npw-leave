'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  Database,
  FileText,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Key,
  CheckCircle2,
  XCircle,
  Activity,
  HardDrive,
  Send,
  Clock,
  Download,
  RotateCcw,
  Eraser,
  FileDown,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import { formatThaiDateShort, formatFullThaiDate } from '@/lib/thaiDate';

interface AdminClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'super_admin';
  };
}

interface HrUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'hr' | 'super_admin';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface SystemStatus {
  database: {
    connected: boolean;
    message: string;
  };
  blob: {
    usedMB: number;
    totalMB: number;
    percentage: number;
  };
  telegram: {
    configured: boolean;
    botToken: string | null;
    chatId: string | null;
  };
  cron: {
    lastRun: string | null;
    status: string;
  };
  stats: {
    teachersCount: number;
    leavesCount: number;
    attachmentsCount: number;
  };
}

interface AuditLog {
  id: string;
  userId: string;
  userType: 'hr' | 'teacher';
  action: string;
  resource: string;
  resourceId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

type Tab = 'users' | 'status' | 'audit' | 'danger';

export default function AdminClient({ hrUser }: AdminClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [pendingCount, setPendingCount] = useState(0);

  // Users state
  const [users, setUsers] = useState<HrUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<HrUser | null>(null);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<HrUser | null>(null);

  // System status state
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState({
    action: '',
    userType: '',
    search: '',
  });

  // Danger zone state
  const [showDangerDialog, setShowDangerDialog] = useState<
    'clear-test' | 'reset-counter' | 'revert-status' | 'export-db' | 'delete-all-leaves' | null
  >(null);
  const [dangerConfirmation, setDangerConfirmation] = useState('');
  const [dangerProcessing, setDangerProcessing] = useState(false);
  const [fiscalYearInput, setFiscalYearInput] = useState('');
  const [leaveIdInput, setLeaveIdInput] = useState('');

  // User form state
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'hr' as 'hr' | 'super_admin',
  });

  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    fetchPendingCount();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'status') fetchSystemStatus();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

  const fetchPendingCount = async () => {
    try {
      const response = await fetch('/api/hr/leaves/pendingCount');
      if (response.ok) {
        const data = await response.json();
        setPendingCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch pending count:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/hr/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('ไม่สามารถโหลดรายการผู้ใช้ได้');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      setLoadingStatus(true);
      const response = await fetch('/api/hr/system/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setSystemStatus(data);
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      toast.error('ไม่สามารถโหลดสถานะระบบได้');
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const params = new URLSearchParams({
        page: auditPage.toString(),
        limit: '20',
        ...(auditFilter.action && { action: auditFilter.action }),
        ...(auditFilter.userType && { userType: auditFilter.userType }),
        ...(auditFilter.search && { search: auditFilter.search }),
      });

      const response = await fetch(`/api/hr/reports/audit-log?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setAuditLogs(data.logs);
      setAuditTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('ไม่สามารถโหลด Audit log ได้');
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleAddUser = async () => {
    if (!userForm.username.trim() || !userForm.password.trim() ||
        !userForm.firstName.trim() || !userForm.lastName.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (userForm.password.length < 8) {
      toast.error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }

    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const response = await fetch('/api/hr/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      toast.success('เพิ่มบัญชีผู้ใช้สำเร็จ');
      setShowAddUserDialog(false);
      setUserForm({
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'hr',
      });
      await fetchUsers();
    } catch (error: any) {
      console.error('Add user error:', error);
      toast.error(error.message || 'ไม่สามารถเพิ่มบัญชีผู้ใช้ได้');
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<HrUser>) => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const response = await fetch(`/api/hr/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      toast.success('อัปเดตบัญชีผู้ใช้สำเร็จ');
      setEditingUser(null);
      await fetchUsers();
    } catch (error: any) {
      console.error('Update user error:', error);
      toast.error(error.message || 'ไม่สามารถอัปเดตบัญชีผู้ใช้ได้');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`ยืนยันการลบบัญชี "${username}"?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      return;
    }

    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const response = await fetch(`/api/hr/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      toast.success('ลบบัญชีผู้ใช้สำเร็จ');
      await fetchUsers();
    } catch (error: any) {
      console.error('Delete user error:', error);
      toast.error(error.message || 'ไม่สามารถลบบัญชีผู้ใช้ได้');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;

    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (resetPasswordForm.newPassword.length < 8) {
      toast.error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }

    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const response = await fetch(`/api/hr/admin/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPasswordForm.newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      toast.success('รีเซ็ตรหัสผ่านสำเร็จ');
      setShowResetPasswordDialog(false);
      setResetPasswordUser(null);
      setResetPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast.error(error.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
    }
  };

  const handleDangerAction = async () => {
    if (!showDangerDialog) return;

    try {
      setDangerProcessing(true);

      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      let response: Response;

      switch (showDangerDialog) {
        case 'clear-test':
          response = await fetch('/api/hr/admin/danger/clear-test-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmation: dangerConfirmation }),
          });
          break;

        case 'reset-counter':
          response = await fetch('/api/hr/admin/danger/reset-fiscal-counter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fiscalYear: fiscalYearInput,
              confirmation: dangerConfirmation,
            }),
          });
          break;

        case 'revert-status':
          response = await fetch('/api/hr/admin/danger/revert-leave-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leaveId: leaveIdInput,
              confirmation: dangerConfirmation,
            }),
          });
          break;

        case 'export-db':
          response = await fetch('/api/hr/admin/danger/export-full-database');
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().split('T')[0];
            a.download = `ระบบลา_สำรองข้อมูล_${timestamp}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('ดาวน์โหลดข้อมูลสำเร็จ');
            setShowDangerDialog(null);
            return;
          }
          break;

        case 'delete-all-leaves':
          response = await fetch('/api/hr/admin/danger/delete-all-leaves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmation: dangerConfirmation }),
          });
          break;

        default:
          return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Operation failed');
      }

      toast.success('ดำเนินการสำเร็จ');
      setShowDangerDialog(null);
      setDangerConfirmation('');
      setFiscalYearInput('');
      setLeaveIdInput('');
    } catch (error: any) {
      console.error('Danger action error:', error);
      toast.error(error.message || 'ไม่สามารถดำเนินการได้');
    } finally {
      setDangerProcessing(false);
    }
  };

  const exportAuditLog = async () => {
    try {
      const params = new URLSearchParams({
        format: 'excel',
        ...(auditFilter.action && { action: auditFilter.action }),
        ...(auditFilter.userType && { userType: auditFilter.userType }),
        ...(auditFilter.search && { search: auditFilter.search }),
      });

      const response = await fetch(`/api/hr/reports/audit-log?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `audit-log_${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export สำเร็จ');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('ไม่สามารถ Export ได้');
    }
  };

  return (
    <HrLayoutWrapper
      hrUser={{
        id: hrUser.id,
        firstName: hrUser.firstName,
        lastName: hrUser.lastName,
        role: hrUser.role,
      }}
      pendingCount={pendingCount}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="กลับ"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Super Admin
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  จัดการระบบและบัญชีผู้ใช้
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'users'
                    ? 'bg-orange-600 dark:bg-orange-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                จัดการบัญชี
              </button>
              <button
                onClick={() => setActiveTab('status')}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'status'
                    ? 'bg-orange-600 dark:bg-orange-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                สถานะระบบ
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'audit'
                    ? 'bg-orange-600 dark:bg-orange-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Audit Log
              </button>
              <button
                onClick={() => setActiveTab('danger')}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'danger'
                    ? 'bg-red-600 dark:bg-red-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                โซนอันตราย
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Tab: Users */}
          {activeTab === 'users' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Add User Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAddUserDialog(true)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่มบัญชีผู้ใช้
                </button>
              </div>

              {/* Users List */}
              {loadingUsers ? (
                <div className="grid grid-cols-1 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={`user-skeleton-${i}`}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-6 h-32 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                              {user.firstName} {user.lastName}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                user.role === 'super_admin'
                                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              {user.role === 'super_admin' ? 'Super Admin' : 'HR'}
                            </span>
                            {!user.isActive && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                ปิดใช้งาน
                              </span>
                            )}
                            {user.id === hrUser.id && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                คุณ
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Username: <span className="font-mono">{user.username}</span>
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>เข้าสู่ระบบล่าสุด: {user.lastLoginAt ? formatThaiDateShort(new Date(user.lastLoginAt)) : 'ยังไม่เคย'}</span>
                            <span>สร้างเมื่อ: {formatThaiDateShort(new Date(user.createdAt))}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        {user.id !== hrUser.id && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setResetPasswordUser(user);
                                setShowResetPasswordDialog(true);
                              }}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="รีเซ็ตรหัสผ่าน"
                            >
                              <Key className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </button>
                            <button
                              onClick={() => setEditingUser(user)}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="แก้ไข"
                            >
                              <Edit className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Tab: System Status */}
          {activeTab === 'status' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-end">
                <button
                  onClick={fetchSystemStatus}
                  disabled={loadingStatus}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
                  รีเฟรช
                </button>
              </div>

              {loadingStatus ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={`status-skeleton-${i}`}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-6 h-40 animate-pulse"
                    />
                  ))}
                </div>
              ) : systemStatus ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Database */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${systemStatus.database.connected ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          <Database className={`w-5 h-5 ${systemStatus.database.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          ฐานข้อมูล
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {systemStatus.database.connected ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                        <span className={`text-sm font-medium ${systemStatus.database.connected ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                          {systemStatus.database.connected ? 'เชื่อมต่อสำเร็จ' : 'เชื่อมต่อล้มเหลว'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {systemStatus.database.message}
                      </p>
                    </div>

                    {/* Blob Storage */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${
                          systemStatus.blob.percentage > 90
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : systemStatus.blob.percentage > 70
                            ? 'bg-amber-100 dark:bg-amber-900/30'
                            : 'bg-sky-100 dark:bg-sky-900/30'
                        }`}>
                          <HardDrive className={`w-5 h-5 ${
                            systemStatus.blob.percentage > 90
                              ? 'text-red-600 dark:text-red-400'
                              : systemStatus.blob.percentage > 70
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-sky-600 dark:text-sky-400'
                          }`} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Blob Storage
                        </h3>
                      </div>
                      <div className="mb-2">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {systemStatus.blob.usedMB.toFixed(1)}
                          </span>
                          <span className="text-sm text-slate-500">
                            / {systemStatus.blob.totalMB} MB
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              systemStatus.blob.percentage > 90
                                ? 'bg-red-500'
                                : systemStatus.blob.percentage > 70
                                ? 'bg-amber-500'
                                : 'bg-orange-500'
                            }`}
                            style={{ width: `${systemStatus.blob.percentage}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        ใช้ไป {systemStatus.blob.percentage.toFixed(1)}%
                      </p>
                      {systemStatus.blob.percentage > 70 && (
                        <div className={`mt-3 p-2 rounded-lg ${
                          systemStatus.blob.percentage > 90
                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                        }`}>
                          <p className={`text-xs ${
                            systemStatus.blob.percentage > 90
                              ? 'text-red-900 dark:text-red-100'
                              : 'text-amber-900 dark:text-amber-100'
                          }`}>
                            {systemStatus.blob.percentage > 90
                              ? '⚠️ เกิน 90% - ใกล้หมดโควตา'
                              : '⚠️ เกิน 70% - ควรจัดการพื้นที่'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Telegram */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${systemStatus.telegram.configured ? 'bg-sky-100 dark:bg-sky-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <Send className={`w-5 h-5 ${systemStatus.telegram.configured ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Telegram
                        </h3>
                      </div>
                      {systemStatus.telegram.configured ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                              ตั้งค่าเรียบร้อย
                            </span>
                          </div>
                          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                            <p>Bot Token: {systemStatus.telegram.botToken ? '••••••••' : '-'}</p>
                            <p>Chat ID: {systemStatus.telegram.chatId || '-'}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                              ยังไม่ได้ตั้งค่า
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            ไปที่หน้าตั้งค่าเพื่อกำหนดค่า Telegram
                          </p>
                        </>
                      )}
                    </div>

                    {/* Cron */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Cron Jobs
                        </h3>
                      </div>
                      {systemStatus.cron.lastRun ? (
                        <>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            รันล่าสุด: {formatThaiDateShort(new Date(systemStatus.cron.lastRun))}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {systemStatus.cron.status}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          ยังไม่มีการรัน cron
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                      สถิติระบบ
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ครู</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {systemStatus.stats.teachersCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ใบลา</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {systemStatus.stats.leavesCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ไฟล์แนบ</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {systemStatus.stats.attachmentsCount}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          )}

          {/* Tab: Audit Log */}
          {activeTab === 'audit' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Filters & Export */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={auditFilter.action}
                      onChange={(e) => setAuditFilter({ ...auditFilter, action: e.target.value })}
                      className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">ทุก Action</option>
                      <option value="login">Login</option>
                      <option value="logout">Logout</option>
                      <option value="create">Create</option>
                      <option value="update">Update</option>
                      <option value="delete">Delete</option>
                      <option value="approve">Approve</option>
                      <option value="reject">Reject</option>
                    </select>
                    <select
                      value={auditFilter.userType}
                      onChange={(e) => setAuditFilter({ ...auditFilter, userType: e.target.value })}
                      className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">ทุก User Type</option>
                      <option value="hr">HR</option>
                      <option value="teacher">Teacher</option>
                    </select>
                    <input
                      type="text"
                      placeholder="ค้นหา..."
                      value={auditFilter.search}
                      onChange={(e) => setAuditFilter({ ...auditFilter, search: e.target.value })}
                      className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={fetchAuditLogs}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium transition-colors text-sm"
                    >
                      <Search className="w-4 h-4 inline mr-2" />
                      ค้นหา
                    </button>
                    <button
                      onClick={exportAuditLog}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors text-sm"
                    >
                      <Download className="w-4 h-4 inline mr-2" />
                      Export
                    </button>
                  </div>
                </div>
              </div>

              {/* Audit Logs List */}
              {loadingAudit ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={`audit-skeleton-${i}`}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-4 h-24 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                              {log.action}
                            </span>
                            <span className="text-xs text-slate-500">•</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {log.resource}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            {formatFullThaiDate(new Date(log.createdAt))}
                          </p>
                          {log.details && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-sky-600 dark:text-sky-400 hover:underline">
                                ดูรายละเอียด
                              </summary>
                              <pre className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {auditLogs.length === 0 && (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      ไม่พบ Audit log
                    </div>
                  )}
                </div>
              )}

              {/* Pagination */}
              {auditTotal > 20 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={auditPage === 1}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors text-sm"
                  >
                    ก่อนหน้า
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    หน้า {auditPage} / {Math.ceil(auditTotal / 20)}
                  </span>
                  <button
                    onClick={() => setAuditPage((p) => p + 1)}
                    disabled={auditPage >= Math.ceil(auditTotal / 20)}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors text-sm"
                  >
                    ถัดไป
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Tab: Danger Zone */}
          {activeTab === 'danger' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Warning Banner */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-red-900 dark:text-red-100 mb-1">
                      โซนอันตราย
                    </h3>
                    <p className="text-sm text-red-800 dark:text-red-200">
                      การกระทำในโซนนี้มีผลกระทบรุนแรงและไม่สามารถย้อนกลับได้ กรุณาใช้ความระมัดระวัง
                    </p>
                  </div>
                </div>
              </div>

              {/* Danger Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Clear Test Data */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border-2 border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <Eraser className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      ล้างข้อมูลทดสอบ
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    ลบใบลา ไฟล์แนบ และข้อมูลทดสอบทั้งหมด
                  </p>
                  <button
                    onClick={() => setShowDangerDialog('clear-test')}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    ล้างข้อมูลทดสอบ
                  </button>
                </div>

                {/* Reset Fiscal Counter */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border-2 border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      รีเซ็ตเลขรันนิ่ง
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    รีเซ็ตเลขรันนิ่งของปีงบประมาณที่ระบุ
                  </p>
                  <button
                    onClick={() => setShowDangerDialog('reset-counter')}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    รีเซ็ตเลขรันนิ่ง
                  </button>
                </div>

                {/* Revert Leave Status */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border-2 border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      ย้อนสถานะใบลา
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    เปลี่ยนสถานะจาก "อนุมัติแล้ว" เป็น "รออนุมัติ"
                  </p>
                  <button
                    onClick={() => setShowDangerDialog('revert-status')}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    ย้อนสถานะใบลา
                  </button>
                </div>

                {/* Export Full Database */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border-2 border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <FileDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Export ฐานข้อมูลทั้งหมด
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    ส่งออกข้อมูลทั้งระบบเป็น Excel (สำรองข้อมูล)
                  </p>
                  <button
                    onClick={() => setShowDangerDialog('export-db')}
                    className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    Export ฐานข้อมูล
                  </button>
                </div>

                {/* Delete All Leaves */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border-2 border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      ลบใบลาทั้งหมด
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    ลบใบลาทั้งหมดออกจากระบบถาวร (ไม่สามารถกู้คืนได้)
                  </p>
                  <button
                    onClick={() => setShowDangerDialog('delete-all-leaves')}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    ลบใบลาทั้งหมด
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </main>

        {/* CONTINUATION MARKER - Dialogs follow */}

        {/* Add User Dialog */}
        {showAddUserDialog && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowAddUserDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddUser();
                  }}
                  className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      เพิ่มบัญชีผู้ใช้
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowAddUserDialog(false)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="john_doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      ชื่อ *
                    </label>
                    <input
                      type="text"
                      value={userForm.firstName}
                      onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      นามสกุล *
                    </label>
                    <input
                      type="text"
                      value={userForm.lastName}
                      onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      รหัสผ่าน *
                    </label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="ขั้นต่ำ 8 ตัวอักษร"
                      required
                      minLength={8}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      บทบาท *
                    </label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'hr' | 'super_admin' })}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    >
                      <option value="hr">HR</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddUserDialog(false)}
                      className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors"
                    >
                      เพิ่มผู้ใช้
                    </button>
                  </div>
                </form>
              </motion.div>
          </AnimatePresence>
        )}

        {/* Edit User Dialog */}
        {editingUser && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setEditingUser(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editingUser) return;
                    handleUpdateUser(editingUser.id, {
                      firstName: editingUser.firstName,
                      lastName: editingUser.lastName,
                      role: editingUser.role,
                      isActive: editingUser.isActive,
                    });
                  }}
                  className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      แก้ไขผู้ใช้
                    </h2>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={editingUser.username}
                      disabled
                      className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      ชื่อ *
                    </label>
                    <input
                      type="text"
                      value={editingUser.firstName}
                      onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      นามสกุล *
                    </label>
                    <input
                      type="text"
                      value={editingUser.lastName}
                      onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      บทบาท *
                    </label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'hr' | 'super_admin' })}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    >
                      <option value="hr">HR</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.isActive}
                        onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        เปิดใช้งาน
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors"
                    >
                      บันทึก
                    </button>
                  </div>
                </form>
              </motion.div>
          </AnimatePresence>
        )}

        {/* Reset Password Dialog */}
        {showResetPasswordDialog && resetPasswordUser && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => {
                setShowResetPasswordDialog(false);
                setResetPasswordUser(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <div
                  className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      รีเซ็ตรหัสผ่าน
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetPasswordDialog(false);
                        setResetPasswordUser(null);
                      }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    รีเซ็ตรหัสผ่านสำหรับ: <span className="font-medium text-slate-900 dark:text-slate-100">{resetPasswordUser.firstName} {resetPasswordUser.lastName}</span>
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      รหัสผ่านใหม่ *
                    </label>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        value={resetPasswordForm.newPassword}
                        onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                        className="w-full px-4 py-2 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="ขั้นต่ำ 8 ตัวอักษร"
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showResetPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetPasswordDialog(false);
                        setResetPasswordUser(null);
                      }}
                      className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetPassword()}
                      className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors"
                    >
                      รีเซ็ตรหัสผ่าน
                    </button>
                  </div>
                  </div>
                </div>
              </motion.div>
          </AnimatePresence>
        )}

        {/* Danger Confirmation Dialogs */}
        {showDangerDialog && (
          <AnimatePresence>
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => {
                  setShowDangerDialog(null);
                  setDangerConfirmation('');
                }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              >
                <div
                  className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                      <h2 className="text-xl font-bold text-red-900 dark:text-red-100">
                        ยืนยันการกระทำ
                      </h2>
                    </div>
                    <button
                      onClick={() => {
                        setShowDangerDialog(null);
                        setDangerConfirmation('');
                      }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                  {/* Warning Message */}
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <p className="text-sm text-red-900 dark:text-red-100">
                      {showDangerDialog === 'clear-test' && 'การกระทำนี้จะลบใบลา ไฟล์แนบ และข้อมูลทดสอบทั้งหมด ไม่สามารถย้อนกลับได้'}
                      {showDangerDialog === 'reset-counter' && 'การรีเซ็ตเลขรันนิ่งจะทำให้เลขที่ใบลาในปีงบประมาณที่ระบุเริ่มต้นใหม่ ไม่สามารถย้อนกลับได้'}
                      {showDangerDialog === 'revert-status' && 'การย้อนสถานะใบลาจะเปลี่ยนสถานะจาก "อนุมัติแล้ว" เป็น "รออนุมัติ" โดยรักษาข้อมูลผู้ลงนามไว้'}
                      {showDangerDialog === 'export-db' && 'การ Export จะสร้างไฟล์ Excel ที่มีข้อมูลทั้งระบบ ไฟล์จะมีขนาดใหญ่และอาจใช้เวลาสักครู่'}
                      {showDangerDialog === 'delete-all-leaves' && 'การกระทำนี้จะลบใบลาทั้งหมดออกจากระบบถาวร รวมถึงไฟล์แนบและข้อมูลที่เกี่ยวข้องทั้งหมด ไม่สามารถกู้คืนได้เด็ดขาด'}
                    </p>
                  </div>

                  {/* Confirmation Input */}
                  {showDangerDialog !== 'export-db' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        พิมพ์ข้อความยืนยัน: <span className="font-bold text-red-600 dark:text-red-400">
                          {showDangerDialog === 'clear-test' && 'ยืนยันล้างข้อมูล'}
                          {showDangerDialog === 'reset-counter' && 'ยืนยันรีเซ็ต'}
                          {showDangerDialog === 'revert-status' && 'เลขที่ใบลา'}
                          {showDangerDialog === 'delete-all-leaves' && 'ยืนยันลบใบลาทั้งหมด'}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={dangerConfirmation}
                        onChange={(e) => setDangerConfirmation(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder={
                          showDangerDialog === 'clear-test' ? 'ยืนยันล้างข้อมูล' :
                          showDangerDialog === 'reset-counter' ? 'ยืนยันรีเซ็ต' :
                          showDangerDialog === 'delete-all-leaves' ? 'ยืนยันลบใบลาทั้งหมด' :
                          'เช่น LEAVE-69/1-0001'
                        }
                      />
                    </div>
                  )}

                  {/* Additional fields for specific actions */}
                  {showDangerDialog === 'reset-counter' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        ปีงบประมาณ พ.ศ. *
                      </label>
                      <input
                        type="number"
                        value={fiscalYearInput}
                        onChange={(e) => setFiscalYearInput(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="2570"
                        min={2560}
                        max={2600}
                      />
                    </div>
                  )}

                  {showDangerDialog === 'revert-status' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        เลขที่ใบลา *
                      </label>
                      <input
                        type="text"
                        value={leaveIdInput}
                        onChange={(e) => setLeaveIdInput(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="เช่น LV-69/1-0001"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDangerDialog(null);
                        setDangerConfirmation('');
                        setFiscalYearInput('');
                        setLeaveIdInput('');
                      }}
                      className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDangerAction()}
                      disabled={
                        dangerProcessing ||
                        (showDangerDialog !== 'export-db' && (
                          !dangerConfirmation ||
                          (showDangerDialog === 'clear-test' && dangerConfirmation !== 'ยืนยันล้างข้อมูล') ||
                          (showDangerDialog === 'reset-counter' && (dangerConfirmation !== 'ยืนยันรีเซ็ต' || !fiscalYearInput)) ||
                          (showDangerDialog === 'revert-status' && !dangerConfirmation.startsWith('LV-')) ||
                          (showDangerDialog === 'delete-all-leaves' && dangerConfirmation !== 'ยืนยันลบใบลาทั้งหมด')
                        ))
                      }
                      className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white disabled:text-slate-500 rounded-xl font-medium transition-colors"
                    >
                      {dangerProcessing ? 'กำลังดำเนินการ...' : (showDangerDialog === 'export-db' ? 'Export ทันที' : 'ยืนยัน')}
                    </button>
                  </div>
                  </div>
                </div>
              </motion.div>
            </>
          </AnimatePresence>
        )}
      </div>
    </HrLayoutWrapper>
  );
}
