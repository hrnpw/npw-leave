'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveType, HalfDayPeriod } from '@/types/leave';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  HALF_DAY_PERIOD_LABELS,
} from '@/types/leave';

interface EditLeaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leaveId: string;
  initialData: {
    type: LeaveType;
    customTypeName?: string;
    startDate: string;
    endDate: string;
    isHalfDay: boolean;
    halfDayPeriod?: HalfDayPeriod;
    reason: string;
    contactAddress: string;
    contactPhone?: string;
  };
}

const LEAVE_TYPES: LeaveType[] = ['sick', 'personal', 'maternity', 'religious', 'other'];

export default function EditLeaveDialog({
  isOpen,
  onClose,
  onSuccess,
  leaveId,
  initialData,
}: EditLeaveDialogProps) {
  const [formData, setFormData] = useState(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState<{
    working: number;
    calendar: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      calculateDays(initialData.startDate, initialData.endDate, initialData.isHalfDay);
    }
  }, [isOpen, initialData]);

  const calculateDays = async (start: string, end: string, halfDay: boolean) => {
    if (!start || !end) return;

    try {
      setIsCalculating(true);
      const res = await fetch('/api/teacher/leaves/calculate-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          isHalfDay: halfDay,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCalculatedDays({
          working: data.daysWorking,
          calendar: data.daysCalendar,
        });
      }
    } catch (error) {
      console.error('Failed to calculate days:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    calculateDays(newData.startDate, newData.endDate, newData.isHalfDay);
  };

  const handleHalfDayToggle = (checked: boolean) => {
    const newData = {
      ...formData,
      isHalfDay: checked,
      halfDayPeriod: checked ? ('morning' as HalfDayPeriod) : undefined,
    };
    setFormData(newData);
    calculateDays(newData.startDate, newData.endDate, checked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.reason.length < 10) {
      toast.error('เหตุผลการลาต้องมีอย่างน้อย 10 ตัวอักษร');
      return;
    }

    if (formData.type === 'other' && !formData.customTypeName?.trim()) {
      toast.error('กรุณาระบุชื่อประเภทการลา');
      return;
    }

    if (formData.isHalfDay && formData.startDate !== formData.endDate) {
      toast.error('การลาครึ่งวันต้องเป็นการลาวันเดียวเท่านั้น');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/hr/leaves/${leaveId}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถแก้ไขใบลาได้');
      }

      toast.success('แก้ไขใบลาสำเร็จ');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to edit leave:', error);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isSingleDay = formData.startDate === formData.endDate;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              แก้ไขใบลา
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Leave Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                ประเภทการลา
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {LEAVE_TYPES.map((type) => {
                  const colors = LEAVE_TYPE_COLORS[type];
                  const isSelected = formData.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          type,
                          customTypeName: type === 'other' ? formData.customTypeName : undefined,
                        })
                      }
                      className={`p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? `${colors.light} ${colors.dark} border-current`
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <p className="text-sm font-medium">{LEAVE_TYPE_LABELS[type]}</p>
                    </button>
                  );
                })}
              </div>

              {formData.type === 'other' && (
                <input
                  type="text"
                  value={formData.customTypeName || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, customTypeName: e.target.value })
                  }
                  placeholder="ระบุประเภทการลา"
                  className="mt-3 w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              )}
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                ช่วงเวลาลา
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    เริ่มวันที่
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    ถึงวันที่
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    min={formData.startDate}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
              </div>

              {/* Calculated Days */}
              {calculatedDays && (
                <div className="mt-3 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
                  <p className="text-sm text-sky-900 dark:text-sky-100">
                    <span className="font-semibold">{calculatedDays.working}</span> วันทำการ
                    {' • '}
                    <span className="font-semibold">{calculatedDays.calendar}</span> วันปฏิทิน
                  </p>
                </div>
              )}
            </div>

            {/* Half Day */}
            {isSingleDay && (
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isHalfDay}
                    onChange={(e) => handleHalfDayToggle(e.target.checked)}
                    className="w-5 h-5 text-sky-500 rounded focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ลาครึ่งวัน
                  </span>
                </label>

                {formData.isHalfDay && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {(['morning', 'afternoon'] as HalfDayPeriod[]).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setFormData({ ...formData, halfDayPeriod: period })}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          formData.halfDayPeriod === period
                            ? 'bg-sky-100 dark:bg-sky-900/30 border-sky-500 text-sky-700 dark:text-sky-300'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <p className="text-sm font-medium">
                          {HALF_DAY_PERIOD_LABELS[period]}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                เหตุผลการลา
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                placeholder="ระบุเหตุผลอย่างน้อย 10 ตัวอักษร"
                required
              />
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {formData.reason.length} / 10 ตัวอักษรขั้นต่ำ
              </p>
            </div>

            {/* Contact Address */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                ที่อยู่ที่สามารถติดต่อได้
              </label>
              <textarea
                value={formData.contactAddress}
                onChange={(e) => setFormData({ ...formData, contactAddress: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                placeholder="บ้านเลขที่ หมู่บ้าน ตำบล อำเภอ จังหวัด"
                required
              />
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                เบอร์โทรศัพท์ติดต่อ (ไม่บังคับ)
              </label>
              <input
                type="tel"
                value={formData.contactPhone || ''}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="08X-XXX-XXXX"
              />
            </div>

            {/* Warning */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>หมายเหตุ:</strong> การแก้ไขจะเปลี่ยนแปลงจำนวนวันลา แต่ชื่อผู้ลงนามจะยังคงเป็นชื่อเดิมตอนอนุมัติครั้งแรก
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-semibold transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCalculating}
                className="flex-1 py-3 px-4 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    บันทึกการแก้ไข
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
