'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Trash2,
  Edit,
  Copy,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatThaiDate } from '@/lib/thaiDate';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import Tooltip from '@/components/ui/Tooltip';

interface HolidaysClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  createdAt: string;
}

export default function HolidaysClient({ hrUser }: HolidaysClientProps) {
  const router = useRouter();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [copyFromYear, setCopyFromYear] = useState(selectedYear - 1);

  useEffect(() => {
    fetchHolidays();
  }, [selectedYear]);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hr/holidays?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setHolidays(data.holidays);
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
      toast.error('ไม่สามารถโหลดวันหยุดได้');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newDate || !newName.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const res = await fetch('/api/hr/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate,
          name: newName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('เพิ่มวันหยุดสำเร็จ');
      setShowAddDialog(false);
      setNewDate('');
      setNewName('');
      fetchHolidays();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถเพิ่มวันหยุดได้');
    }
  };

  const handleEdit = async () => {
    if (!editingHoliday || !newName.trim()) {
      toast.error('กรุณากรอกชื่อวันหยุด');
      return;
    }

    try {
      const res = await fetch(`/api/hr/holidays/${editingHoliday.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('แก้ไขวันหยุดสำเร็จ');
      setEditingHoliday(null);
      setNewName('');
      fetchHolidays();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถแก้ไขวันหยุดได้');
    }
  };

  const handleDelete = async (holiday: Holiday) => {
    const confirmed = confirm(`ต้องการลบวันหยุด "${holiday.name}" หรือไม่?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/hr/holidays/${holiday.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('ลบวันหยุดสำเร็จ');
      fetchHolidays();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถลบวันหยุดได้');
    }
  };

  const handleCopy = async () => {
    const confirmed = confirm(
      `คัดลอกวันหยุดจากปี ${copyFromYear} ไปยังปี ${selectedYear} หรือไม่?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/hr/holidays/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromYear: copyFromYear,
          toYear: selectedYear,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success(data.message);
      setShowCopyDialog(false);
      fetchHolidays();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถคัดลอกวันหยุดได้');
    }
  };

  const openEditDialog = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setNewName(holiday.name);
  };

  const groupByMonth = (holidays: Holiday[]) => {
    const groups: { [key: string]: Holiday[] } = {};
    holidays.forEach((h) => {
      const date = new Date(h.date);
      const month = date.toLocaleDateString('th-TH', { month: 'long' });
      if (!groups[month]) groups[month] = [];
      groups[month].push(h);
    });
    return groups;
  };

  const grouped = groupByMonth(holidays);

  // Check if we're near end of year and next year has no holidays
  const today = new Date();
  const showWarning =
    today.getMonth() >= 11 && // December
    selectedYear === today.getFullYear() &&
    holidays.length > 0;

  return (
    <HrLayoutWrapper hrUser={hrUser}>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                วันหยุดราชการ
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                จัดการวันหยุดราชการประจำปี
              </p>
            </div>
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 1 + i;
                return (
                  <option key={year} value={year}>
                    {year + 543} (พ.ศ.)
                  </option>
                );
              })}
            </select>
            <button
              onClick={() => setShowCopyDialog(true)}
              className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">คัดลอก</span>
            </button>
            <button
              onClick={() => setShowAddDialog(true)}
              className="px-3 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">เพิ่ม</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {/* Warning */}
        {showWarning && (
          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                ใกล้สิ้นปีแล้ว
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                อย่าลืมเพิ่มวันหยุดสำหรับปี {selectedYear + 1} หรือคัดลอกจากปีนี้
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 bg-white dark:bg-slate-900 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
              ยังไม่มีวันหยุดในปีนี้
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              เพิ่มวันหยุดใหม่หรือคัดลอกจากปีก่อน
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setShowCopyDialog(true)}
                className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg transition-colors"
              >
                คัดลอกจากปีก่อน
              </button>
              <button
                onClick={() => setShowAddDialog(true)}
                className="px-3 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                เพิ่มวันหยุดใหม่
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([month, monthHolidays], idx) => (
              <motion.div
                key={month}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {month}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {monthHolidays.length} วัน
                  </p>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {monthHolidays.map((holiday) => {
                    return (
                      <div
                        key={holiday.id}
                        className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="w-11 h-11 bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-base font-bold text-red-600 dark:text-red-400">
                            {new Date(holiday.date).getDate()}
                          </span>
                          <span className="text-[9px] text-red-600 dark:text-red-400">
                            {formatThaiDate(new Date(holiday.date), 'MMM')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {holiday.name}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {formatThaiDate(new Date(holiday.date), 'EEE d MMMM yyyy')}
                          </p>
                        </div>
                        <Tooltip content="แก้ไขวันหยุด">
                          <button
                            onClick={() => openEditDialog(holiday)}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                          </button>
                        </Tooltip>
                        <Tooltip content="ลบวันหยุด">
                          <button
                            onClick={() => handleDelete(holiday)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          </button>
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Add Dialog */}
      <AnimatePresence>
        {showAddDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddDialog(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
                เพิ่มวันหยุด
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-1.5">
                    วันที่
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-1.5">
                    ชื่อวันหยุด
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="เช่น วันปีใหม่"
                    minLength={3}
                    maxLength={100}
                    required
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => setShowAddDialog(false)}
                  className="flex-1 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 py-2.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  เพิ่ม
                </button>
              </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Dialog */}
      <AnimatePresence>
        {editingHoliday && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setEditingHoliday(null);
                setNewName('');
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
                แก้ไขวันหยุด
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-1.5">
                    วันที่
                  </label>
                  <input
                    type="text"
                    value={formatThaiDate(new Date(editingHoliday.date), 'd MMMM yyyy')}
                    disabled
                    className="w-full px-3 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-1.5">
                    ชื่อวันหยุด
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => {
                    setEditingHoliday(null);
                    setNewName('');
                  }}
                  className="flex-1 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleEdit}
                  className="flex-1 py-2.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  บันทึก
                </button>
              </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Copy Dialog */}
      <AnimatePresence>
        {showCopyDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCopyDialog(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
                คัดลอกวันหยุด
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-1.5">
                    จากปี
                  </label>
                  <select
                    value={copyFromYear}
                    onChange={(e) => setCopyFromYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={year} value={year}>
                          {year + 543} (พ.ศ.)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-1.5">
                    ไปยังปี
                  </label>
                  <input
                    type="text"
                    value={`${selectedYear + 543} (พ.ศ.)`}
                    disabled
                    className="w-full px-3 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400"
                  />
                </div>

                <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    วันหยุดจะถูกคัดลอกไปยังวันที่เดียวกันในปีใหม่
                    (เช่น 1 มกราคม {copyFromYear} → 1 มกราคม {selectedYear})
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => setShowCopyDialog(false)}
                  className="flex-1 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  คัดลอก
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
