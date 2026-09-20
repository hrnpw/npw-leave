'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { th } from 'date-fns/locale';
import { getThaiMonthName, toBuddhistYear } from '@/lib/thaiDate';

interface HeatmapCalendarProps {
  data?: Record<string, number>; // { 'YYYY-MM-DD': count }
  currentDate?: Date;
  onDayClick?: (dateString: string) => void;
  onMonthChange?: (date: Date) => void;
  clickable?: boolean;
  className?: string;
  holidays?: Array<{ date: string; name: string }>; // วันหยุดราชการ
}

export function HeatmapCalendar({
  data = {},
  currentDate,
  onDayClick,
  onMonthChange,
  clickable = true,
  className = '',
  holidays = []
}: HeatmapCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(currentDate || new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Start on Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Create holiday map for quick lookup
  const holidayMap = new Map(holidays.map(h => [h.date.split('T')[0], h.name]));

  const getIntensity = (count: number): string => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    if (count <= 2) return 'bg-sky-200 dark:bg-sky-900/50';
    if (count <= 4) return 'bg-sky-400 dark:bg-sky-700';
    if (count <= 6) return 'bg-sky-600 dark:bg-sky-500';
    return 'bg-sky-800 dark:bg-sky-400';
  };

  const handlePrevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="เดือนก่อนหน้า"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>

        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {getThaiMonthName(currentMonth)} {toBuddhistYear(currentMonth.getFullYear())}
        </h3>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="เดือนถัดไป"
        >
          <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((day, idx) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const count = data[dateKey] || 0;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const holidayName = holidayMap.get(dateKey);
          const isHoliday = !!holidayName;

          return (
            <motion.div
              key={dateKey}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.01 }}
              className="relative group"
            >
              <button
                onClick={() => clickable && isCurrentMonth && count > 0 && onDayClick?.(dateKey)}
                disabled={!isCurrentMonth || !clickable || count === 0}
                className={`
                  w-full aspect-square rounded-lg transition-all relative flex items-center justify-center
                  ${getIntensity(count)}
                  ${isCurrentMonth && clickable && count > 0 ? 'hover:ring-2 hover:ring-sky-500 hover:scale-110 cursor-pointer' : ''}
                  ${isCurrentMonth && (!clickable || count === 0) ? 'cursor-default' : ''}
                  ${!isCurrentMonth ? 'opacity-30 cursor-default' : ''}
                  ${isToday ? 'ring-2 ring-amber-500' : ''}
                `}
              >
                <span
                  className={`
                    text-sm md:text-base font-semibold
                    ${!isCurrentMonth ? 'opacity-0' : isWeekend ? 'text-red-600 dark:text-red-400' : count > 4 ? 'text-white' : 'text-slate-700 dark:text-slate-300'}
                    ${isHoliday ? 'line-through decoration-red-600 dark:decoration-red-400 decoration-2' : ''}
                  `}
                >
                  {format(day, 'd')}
                </span>

                {count > 0 && isCurrentMonth && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-orange-500 dark:bg-orange-600 text-white text-[10px] md:text-xs font-bold rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900">
                    {count}
                  </span>
                )}
              </button>

              {/* Leave Tooltip */}
              {isCurrentMonth && count > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-100 dark:to-white text-white dark:text-slate-900 text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                    <div className="font-bold mb-0.5">{format(day, 'd MMMM', { locale: th })}</div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${count <= 2 ? 'bg-sky-400' : count <= 4 ? 'bg-sky-500' : 'bg-sky-600'}`} />
                      <span>{count} คนลา</span>
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                      <div className="border-4 border-transparent border-t-slate-800 dark:border-t-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* Holiday Tooltip */}
              {isCurrentMonth && isHoliday && count === 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div className="bg-gradient-to-br from-red-900 to-red-800 dark:from-red-100 dark:to-red-50 text-white dark:text-red-900 text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                    <div className="font-bold">{holidayName}</div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                      <div className="border-4 border-transparent border-t-red-800 dark:border-t-red-50" />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-600 dark:text-slate-400">
        <span>น้อย</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="w-4 h-4 rounded bg-sky-200 dark:bg-sky-900/50" />
          <div className="w-4 h-4 rounded bg-sky-400 dark:bg-sky-700" />
          <div className="w-4 h-4 rounded bg-sky-600 dark:bg-sky-500" />
          <div className="w-4 h-4 rounded bg-sky-800 dark:bg-sky-400" />
        </div>
        <span>มาก</span>
      </div>
    </div>
  );
}
