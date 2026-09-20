'use client';

import { motion } from 'framer-motion';
import { Heart, Briefcase, Baby, Book, MoreHorizontal } from 'lucide-react';
import type { LeaveType } from '@/types/leave';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS } from '@/types/leave';
import type { LeaveFormData } from '../LeaveFormClient';

interface LeaveTypeStepProps {
  formData: LeaveFormData;
  updateFormData: (updates: Partial<LeaveFormData>) => void;
  onNext: () => void;
}

const leaveTypes: Array<{ type: LeaveType; icon: React.ReactNode; description: string }> = [
  {
    type: 'sick',
    icon: <Heart className="w-8 h-8" />,
    description: 'ลาเพราะเจ็บป่วย',
  },
  {
    type: 'personal',
    icon: <Briefcase className="w-8 h-8" />,
    description: 'ลากิจส่วนตัว ธุระต่างๆ',
  },
  {
    type: 'maternity',
    icon: <Baby className="w-8 h-8" />,
    description: 'ลาคลอดบุตร',
  },
  {
    type: 'religious',
    icon: <Book className="w-8 h-8" />,
    description: 'ลาเพื่อประกอบพิธีทางศาสนา',
  },
  {
    type: 'other',
    icon: <MoreHorizontal className="w-8 h-8" />,
    description: 'ประเภทอื่นๆ',
  },
];

export default function LeaveTypeStep({ formData, updateFormData, onNext }: LeaveTypeStepProps) {
  const handleSelectType = (type: LeaveType) => {
    updateFormData({ type });

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // Auto-advance to next step after short delay
    setTimeout(() => {
      onNext();
    }, 300);
  };

  const handleCustomTypeNameChange = (value: string) => {
    updateFormData({ customTypeName: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          เลือกประเภทการลา
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          เลือกประเภทที่ตรงกับเหตุผลการลาของคุณ
        </p>
      </div>

      <div className="grid gap-3">
        {leaveTypes.map((item, idx) => {
          if (!item || !item.type) return null;

          const colors = LEAVE_TYPE_COLORS[item.type];
          const isSelected = formData.type === item.type;

          return (
            <motion.button
              key={item.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleSelectType(item.type)}
              className={`
                p-6 rounded-2xl border-2 transition-all text-left
                ${
                  isSelected
                    ? `${colors.light} ${colors.dark} border-orange-500 dark:border-orange-400 shadow-md scale-[1.02]`
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm active:scale-[0.98]'
                }
              `}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`
                    p-3 rounded-xl
                    ${isSelected ? 'bg-white/50 dark:bg-slate-800/50' : 'bg-slate-100 dark:bg-slate-800'}
                  `}
                >
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {LEAVE_TYPE_LABELS[item.type]}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center"
                  >
                    <span className="text-white text-sm">✓</span>
                  </motion.div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Custom type name input (for "other") */}
      {formData.type === 'other' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4"
        >
          <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
            ระบุประเภทการลา *
          </label>
          <input
            type="text"
            value={formData.customTypeName || ''}
            onChange={(e) => handleCustomTypeNameChange(e.target.value)}
            placeholder="เช่น ลาไปศาล, ลาอบรม"
            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
            maxLength={50}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {(formData.customTypeName || '').length}/50 ตัวอักษร
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
