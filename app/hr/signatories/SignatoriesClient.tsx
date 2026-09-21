'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import Tooltip from '@/components/ui/Tooltip';

interface SignatoriesClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
}

interface Signatory {
  id: string;
  role: 'director' | 'hr_head';
  title: string;
  firstName: string;
  lastName: string;
  position: string;
  signatureUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Settings {
  currentDirectorId: string | null;
  currentHrHeadId: string | null;
}

export default function SignatoriesClient({ hrUser }: SignatoriesClientProps) {
  const router = useRouter();
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [settings, setSettings] = useState<Settings>({
    currentDirectorId: null,
    currentHrHeadId: null,
  });
  const [loading, setLoading] = useState(true);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSignatory, setEditingSignatory] = useState<Signatory | null>(null);

  const [formData, setFormData] = useState({
    role: 'director' as 'director' | 'hr_head',
    title: '',
    firstName: '',
    lastName: '',
    position: '',
    signatureUrl: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [signatoriesRes, settingsRes] = await Promise.all([
        fetch('/api/hr/signatories'),
        fetch('/api/hr/settings'),
      ]);

      if (signatoriesRes.ok) {
        const data = await signatoriesRes.json();
        setSignatories(data.signatories);
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings({
          currentDirectorId: data.currentDirectorId,
          currentHrHeadId: data.currentHrHeadId,
        });
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.title.trim() || !formData.firstName.trim() || !formData.lastName.trim() || !formData.position.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const res = await fetch('/api/hr/signatories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('เพิ่มผู้ลงนามสำเร็จ');
      setShowAddDialog(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถเพิ่มผู้ลงนามได้');
    }
  };

  const handleEdit = async () => {
    if (!editingSignatory) return;

    if (!formData.title.trim() || !formData.firstName.trim() || !formData.lastName.trim() || !formData.position.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const res = await fetch(`/api/hr/signatories/${editingSignatory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('แก้ไขผู้ลงนามสำเร็จ');
      setEditingSignatory(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถแก้ไขผู้ลงนามได้');
    }
  };

  const handleToggleActive = async (signatory: Signatory) => {
    try {
      const res = await fetch(`/api/hr/signatories/${signatory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !signatory.isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success(signatory.isActive ? 'ปิดใช้งานสำเร็จ' : 'เปิดใช้งานสำเร็จ');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (signatory: Signatory) => {
    if (hrUser.role !== 'super_admin') {
      toast.error('เฉพาะผู้ดูแลระบบเท่านั้นที่ลบได้');
      return;
    }

    const confirmed = confirm(
      `ต้องการลบ ${signatory.title}${signatory.firstName} ${signatory.lastName} หรือไม่?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/hr/signatories/${signatory.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('ลบผู้ลงนามสำเร็จ');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถลบผู้ลงนามได้');
    }
  };

  const handleSetCurrent = async (role: 'director' | 'hr_head', signatoryId: string | null) => {
    try {
      const res = await fetch('/api/hr/settings/signatories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [role === 'director' ? 'currentDirectorId' : 'currentHrHeadId']: signatoryId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('อัปเดตผู้ลงนามปัจจุบันสำเร็จ');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถอัปเดตได้');
    }
  };

  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (signatory: Signatory) => {
    setFormData({
      role: signatory.role,
      title: signatory.title,
      firstName: signatory.firstName,
      lastName: signatory.lastName,
      position: signatory.position,
      signatureUrl: signatory.signatureUrl || '',
    });
    setEditingSignatory(signatory);
  };

  const resetForm = () => {
    setFormData({
      role: 'director',
      title: '',
      firstName: '',
      lastName: '',
      position: '',
      signatureUrl: '',
    });
  };

  const directors = signatories.filter((s) => s.role === 'director');
  const hrHeads = signatories.filter((s) => s.role === 'hr_head');

  const renderSignatoryCard = (signatory: Signatory) => {
    const isCurrent =
      signatory.role === 'director'
        ? signatory.id === settings.currentDirectorId
        : signatory.id === settings.currentHrHeadId;

    return (
      <div
        key={signatory.id}
        className={`bg-white dark:bg-slate-900 rounded-2xl border-2 transition-all ${
          isCurrent
            ? 'border-sky-500 shadow-lg'
            : 'border-slate-200 dark:border-slate-800 shadow-sm'
        }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-slate-900 dark:text-slate-100">
                  {signatory.title}
                  {signatory.firstName} {signatory.lastName}
                </h3>
                {isCurrent && (
                  <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-xs font-medium rounded-full">
                    ปัจจุบัน
                  </span>
                )}
                {!signatory.isActive && (
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-full">
                    ปิดใช้งาน
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {signatory.position}
              </p>
              {signatory.signatureUrl && (
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  มีไฟล์ลายเซ็น
                </p>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Tooltip content="แก้ไขข้อมูลผู้ลงนาม">
                <button
                  onClick={() => openEditDialog(signatory)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>
              </Tooltip>
              <Tooltip content={signatory.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                <button
                  onClick={() => handleToggleActive(signatory)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {signatory.isActive ? (
                    <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  )}
                </button>
              </Tooltip>
              {hrUser.role === 'super_admin' && (
                <Tooltip content="ลบผู้ลงนาม">
                  <button
                    onClick={() => handleDelete(signatory)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>

          {signatory.isActive && !isCurrent && (
            <button
              onClick={() => handleSetCurrent(signatory.role, signatory.id)}
              className="mt-3 w-full py-2 bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-sm font-medium rounded-lg transition-colors"
            >
              ตั้งเป็นผู้ลงนามปัจจุบัน
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <HrLayoutWrapper hrUser={hrUser}>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  ผู้ลงนาม
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  จัดการผู้ลงนามในใบลา
                </p>
              </div>
            </div>
            <button
              onClick={openAddDialog}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่ม</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 bg-white dark:bg-slate-900 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Directors */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                ผู้อำนวยการ
              </h2>
              {directors.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <p className="text-slate-600 dark:text-slate-400">
                    ยังไม่มีผู้อำนวยการ
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {directors.map(renderSignatoryCard)}
                </div>
              )}
            </section>

            {/* HR Heads */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                หัวหน้าฝ่ายบุคคล
              </h2>
              {hrHeads.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <p className="text-slate-600 dark:text-slate-400">
                    ยังไม่มีหัวหน้าฝ่ายบุคคล
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {hrHeads.map(renderSignatoryCard)}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <AnimatePresence>
        {(showAddDialog || editingSignatory) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowAddDialog(false);
                setEditingSignatory(null);
                resetForm();
              }}
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
                  {editingSignatory ? 'แก้ไขผู้ลงนาม' : 'เพิ่มผู้ลงนาม'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setEditingSignatory(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    บทบาท
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as 'director' | 'hr_head',
                      })
                    }
                    disabled={!!editingSignatory}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none disabled:opacity-50"
                  >
                    <option value="director">ผู้อำนวยการ</option>
                    <option value="hr_head">หัวหน้าฝ่ายบุคคล</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    คำนำหน้า
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="เช่น นาย, นาง, นางสาว"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      ชื่อ
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      นามสกุล
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    ตำแหน่ง
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    placeholder="เช่น ผู้อำนวยการโรงเรียน"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    ไฟล์ลายเซ็น (URL)
                  </label>
                  <input
                    type="text"
                    value={formData.signatureUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, signatureUrl: e.target.value })
                    }
                    placeholder="ไม่บังคับ - URL ของรูปลายเซ็น PNG พื้นหลังโปร่ง"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                    อัปโหลดผ่าน Vercel Blob ใน Phase 5
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setEditingSignatory(null);
                    resetForm();
                  }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={editingSignatory ? handleEdit : handleAdd}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
                >
                  {editingSignatory ? 'บันทึก' : 'เพิ่ม'}
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
