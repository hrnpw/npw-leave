'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateForAPI } from '@/lib/dateFormat';
import type { HalfDayPeriod } from '@/types/leave';
import type { LeaveFormData } from '../LeaveFormClient';
import { formatThaiDate } from '@/lib/thaiDate';

interface DateRangeStepProps {
  formData: LeaveFormData;
  updateFormData: (updates: Partial<LeaveFormData>) => void;
  onNext: () => void;
  isProxyMode?: boolean;
}

export default function DateRangeStep({ formData, updateFormData, onNext, isProxyMode = false }: DateRangeStepProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [workingDays, setWorkingDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [backdateLimit, setBackdateLimit] = useState<Date | null>(null);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBackdateLimit();
    fetchHolidays();
  }, []);

  useEffect(() => {
    // Fetch holidays when month changes
    fetchHolidays();
  }, [currentMonth]);

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      calculateWorkingDays();
    }
  }, [formData.startDate, formData.endDate, formData.isHalfDay, formData.halfDayPeriod]);

  const fetchBackdateLimit = async () => {
    try {
      const endpoint = isProxyMode
        ? '/api/hr/settings/backdate'
        : '/api/teacher/settings/backdate-limit';

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (isProxyMode) {
          // HR API returns hrBackdateLimitDays
          const now = new Date();
          const earliestDate = new Date(now);
          earliestDate.setDate(earliestDate.getDate() - data.hrBackdateLimitDays);
          earliestDate.setHours(0, 0, 0, 0);
          setBackdateLimit(earliestDate);
        } else {
          // Teacher API returns earliestDate directly
          setBackdateLimit(new Date(data.earliestDate));
        }
      }
    } catch (error) {
      console.error('Failed to fetch backdate limit:', error);
    }
  };

  const fetchHolidays = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const res = await fetch(`/api/public/holidays?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        const holidayDates = new Set<string>(
          data.holidays.map((h: { date: string }) => h.date.split('T')[0])
        );
        setHolidays(holidayDates);
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    }
  };

  const calculateWorkingDays = async () => {
    if (!formData.startDate || !formData.endDate) return;

    try {
      setLoading(true);
      const res = await fetch('/api/teacher/leaves/calculate-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: formatDateForAPI(formData.startDate),
          endDate: formatDateForAPI(formData.endDate),
          isHalfDay: formData.isHalfDay,
          halfDayPeriod: formData.halfDayPeriod,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setWorkingDays(data.daysWorking);
      }
    } catch (error) {
      console.error('Failed to calculate days:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (date: Date) => {
    // Check if date is disabled
    if (isDateDisabled(date)) {
      toast.error('ไม่สามารถเลือกวันที่นี้ได้');
      return;
    }

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    if (selectingStart) {
      updateFormData({
        startDate: date,
        endDate: null,
        isHalfDay: false,
        halfDayPeriod: null,
      });
      setSelectingStart(false);
    } else {
      if (formData.startDate && date < formData.startDate) {
        // If selected end date is before start, swap
        updateFormData({
          startDate: date,
          endDate: formData.startDate,
        });
      } else {
        updateFormData({ endDate: date });
      }
    }
  };

  const isDateDisabled = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Can't select dates before backdate limit
    if (backdateLimit && date < backdateLimit) {
      return true;
    }

    // Can't select holidays
    const dateStr = date.toISOString().split('T')[0];
    if (holidays.has(dateStr)) {
      return true;
    }

    return false;
  };

  const isDateInRange = (date: Date): boolean => {
    if (!formData.startDate || !formData.endDate) return false;
    return date >= formData.startDate && date <= formData.endDate;
  };

  const isDateSelected = (date: Date): boolean => {
    if (formData.startDate && date.getTime() === formData.startDate.getTime()) return true;
    if (formData.endDate && date.getTime() === formData.endDate.getTime()) return true;
    return false;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handlePrevMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const handleHalfDayToggle = (isHalf: boolean) => {
    updateFormData({ isHalfDay: isHalf, halfDayPeriod: isHalf ? 'morning' : null });
  };

  const handleHalfDayPeriodChange = (period: HalfDayPeriod) => {
    updateFormData({ halfDayPeriod: period });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the 1st
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const monthYear = currentMonth.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
  });

  const isSingleDay =
    formData.startDate &&
    formData.endDate &&
    formData.startDate.getTime() === formData.endDate.getTime();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            เลือกช่วงเวลา
          </h2>
          {formData.startDate && (
            <button
              onClick={() => {
                updateFormData({
                  startDate: null,
                  endDate: null,
                  isHalfDay: false,
                  halfDayPeriod: null,
                });
                setSelectingStart(true);
                setWorkingDays(null);
              }}
              className="text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium"
            >
              เลือกใหม่
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {selectingStart ? 'เลือกวันเริ่มต้น' : 'เลือกวันสิ้นสุด'}
        </p>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {monthYear}
          </h3>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-slate-600 dark:text-slate-400 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} />;
            }

            const disabled = isDateDisabled(date);
            const selected = isDateSelected(date);
            const inRange = isDateInRange(date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const today = isToday(date);
            const dateStr = date.toISOString().split('T')[0];
            const isHoliday = holidays.has(dateStr);

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                disabled={disabled}
                className={`
                  aspect-square rounded-lg text-sm md:text-base font-medium transition-all relative
                  ${disabled ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : ''}
                  ${isHoliday && !selected ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 line-through' : ''}
                  ${selected ? 'bg-orange-500 text-white shadow-sm scale-105' : ''}
                  ${inRange && !selected ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : ''}
                  ${!selected && !inRange && !disabled && !isHoliday ? 'hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95' : ''}
                  ${!selected && !inRange && !disabled && !isHoliday && isWeekend ? 'text-red-600 dark:text-red-400' : ''}
                  ${!selected && !inRange && !disabled && !isHoliday && !isWeekend ? 'text-slate-900 dark:text-slate-100' : ''}
                  ${today && !selected ? 'ring-2 ring-orange-500 ring-inset' : ''}
                `}
              >
                {isHoliday && (
                  <span className="absolute top-0.5 right-0.5 text-[10px] md:text-sm leading-none text-red-600 dark:text-red-400">
                    วันหยุด
                  </span>
                )}
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      {formData.startDate && formData.endDate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatThaiDate(formData.startDate, 'd MMMM yyyy')}
                {formData.endDate.getTime() !== formData.startDate.getTime() && (
                  <>
                    {' ถึง '}
                    {formatThaiDate(formData.endDate, 'd MMMM yyyy')}
                  </>
                )}
              </p>
              {workingDays !== null && (
                <p className="text-lg font-bold text-sky-600 dark:text-sky-400 mt-1">
                  รวม {workingDays} วันทำการ
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Half-day toggle (only for single day) */}
      {isSingleDay && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="halfDay"
              checked={formData.isHalfDay}
              onChange={(e) => handleHalfDayToggle(e.target.checked)}
              className="w-5 h-5 text-sky-500 rounded border-slate-300 focus:ring-sky-500"
            />
            <label htmlFor="halfDay" className="text-sm font-medium text-slate-900 dark:text-slate-100">
              ลาครึ่งวัน
            </label>
          </div>

          {formData.isHalfDay && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-2 gap-2 pl-8"
            >
              <button
                onClick={() => handleHalfDayPeriodChange('morning')}
                className={`
                  py-2 px-4 rounded-lg border-2 font-medium transition-all active:scale-95
                  ${
                    formData.halfDayPeriod === 'morning'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
                  }
                `}
              >
                ครึ่งเช้า
              </button>
              <button
                onClick={() => handleHalfDayPeriodChange('afternoon')}
                className={`
                  py-2 px-4 rounded-lg border-2 font-medium transition-all active:scale-95
                  ${
                    formData.halfDayPeriod === 'afternoon'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
                  }
                `}
              >
                ครึ่งบ่าย
              </button>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Backdate warning */}
      {formData.startDate && backdateLimit && formData.startDate < new Date() && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            คุณกำลังยื่นใบลาย้อนหลัง
          </p>
        </motion.div>
      )}

      {/* Next button - visible on desktop */}
      {formData.startDate && formData.endDate && (
        <div className="hidden md:block">
          <button
            onClick={onNext}
            className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span>ถัดไป</span>
            <Calendar className="w-5 h-5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
