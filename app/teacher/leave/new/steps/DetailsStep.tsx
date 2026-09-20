'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, X, AlertTriangle, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import type { LeaveFormData } from '../LeaveFormClient';
import { LEAVE_TYPE_LABELS } from '@/types/leave';
import { formatThaiDateShort } from '@/lib/thaiDate';

interface DetailsStepProps {
  formData: LeaveFormData;
  updateFormData: (updates: Partial<LeaveFormData>) => void;
  onNext?: () => void;
  onSubmit: () => void;
  submitting: boolean;
  requireSignature: boolean;
  isHrMode?: boolean;
}

export default function DetailsStep({ formData, updateFormData, onNext, onSubmit, submitting, requireSignature, isHrMode = false }: DetailsStepProps) {
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    if (!isHrMode) {
      checkQuota();
      prefillContactAddress();
    }
  }, []);

  const checkQuota = async () => {
    if (isHrMode) return; // Skip quota check in HR mode

    try {
      setLoadingQuota(true);
      const res = await fetch('/api/teacher/leaves/quota');
      if (res.ok) {
        const data = await res.json();

        // Check if adding this leave would exceed quota
        // This is approximate - server will do final check
        if (formData.type === 'sick' || formData.type === 'personal') {
          if (data.warnings.sickPersonal) {
            setQuotaWarning('การลาครั้งนี้อาจทำให้วันลาสะสมในรอบนี้เกินเกณฑ์ที่กำหนด');
          }
        } else if (formData.type === 'maternity') {
          if (data.warnings.maternity) {
            setQuotaWarning('การลาครั้งนี้อาจทำให้วันลาสะสมในรอบนี้เกินเกณฑ์ที่กำหนด');
          }
        } else if (formData.type === 'religious') {
          if (data.warnings.religious) {
            setQuotaWarning('การลาครั้งนี้อาจทำให้วันลาสะสมในรอบนี้เกินเกณฑ์ที่กำหนด');
          }
        }
      }
    } catch (error) {
      console.error('Failed to check quota:', error);
    } finally {
      setLoadingQuota(false);
    }
  };

  const prefillContactAddress = async () => {
    if (formData.contactAddress || isHrMode) return; // Skip prefill in HR mode

    try {
      const res = await fetch('/api/teacher/leaves/recent?limit=1');
      if (res.ok) {
        const data = await res.json();
        if (data.leaves && data.leaves.length > 0) {
          const lastLeave = data.leaves[0];
          if (lastLeave.contactAddress) {
            updateFormData({ contactAddress: lastLeave.contactAddress });
          }
        }
      }
    } catch (error) {
      console.error('Failed to prefill contact address:', error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (formData.files.length + files.length > 5) {
      toast.error('สามารถแนบไฟล์ได้สูงสุด 5 ไฟล์');
      return;
    }

    setCompressing(true);

    try {
      const processedFiles: File[] = [];

      for (const file of files) {
        // Check file type
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`ไม่รองรับไฟล์ ${file.name} - ใช้ได้เฉพาะ JPG, PNG, PDF`);
          continue;
        }

        // Check size
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} มีขนาดเกิน 10 MB`);
          continue;
        }

        // Compress images
        if (file.type.startsWith('image/')) {
          try {
            const compressed = await imageCompression(file, {
              maxSizeMB: 2,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            });

            processedFiles.push(new File([compressed], file.name, { type: file.type }));
            toast.success(`บีบอัด ${file.name} สำเร็จ`);
          } catch (error) {
            console.error('Compression error:', error);
            processedFiles.push(file);
          }
        } else {
          processedFiles.push(file);
        }
      }

      updateFormData({
        files: [...formData.files, ...processedFiles],
      });
    } finally {
      setCompressing(false);
      event.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = formData.files.filter((_, i) => i !== index);
    updateFormData({ files: newFiles });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const canSubmit =
    formData.reason.trim().length >= 10 &&
    formData.contactAddress.trim().length > 0 &&
    (formData.contactPhone?.trim().length ?? 0) >= 9;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 pb-24"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          รายละเอียด
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          กรอกเหตุผลและที่อยู่ติดต่อระหว่างลา
        </p>
      </div>

      {/* Quota warning */}
      {quotaWarning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {quotaWarning}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              คุณยังสามารถยื่นใบลาได้ แต่ควรตรวจสอบกับฝ่ายบุคคล
            </p>
          </div>
        </motion.div>
      )}

      {/* Summary card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
          สรุปการลา
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">ประเภท:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formData.type === 'other' && formData.customTypeName
                ? formData.customTypeName
                : LEAVE_TYPE_LABELS[formData.type!]}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">ช่วงเวลา:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formData.startDate && formatThaiDateShort(formData.startDate)}
              {formData.endDate && formData.endDate.getTime() !== formData.startDate?.getTime() && (
                <> - {formatThaiDateShort(formData.endDate)}</>
              )}
              {formData.isHalfDay && (
                <span className="ml-2 text-orange-600 dark:text-orange-400">
                  ({formData.halfDayPeriod === 'morning' ? 'ครึ่งเช้า' : 'ครึ่งบ่าย'})
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          เหตุผลการลา <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.reason}
          onChange={(e) => updateFormData({ reason: e.target.value })}
          placeholder="กรุณาระบุเหตุผลการลาอย่างละเอียด (อย่างน้อย 10 ตัวอักษร)"
          rows={4}
          minLength={10}
          maxLength={500}
          required
          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all resize-none"
        />
        <div className="flex justify-between mt-1">
          <p className={`text-xs ${formData.reason.length < 10 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
            {formData.reason.length < 10 ? `ต้องการอีก ${10 - formData.reason.length} ตัวอักษร` : '✓ เหตุผลครบถ้วน'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formData.reason.length}/500
          </p>
        </div>
      </div>

      {/* Contact address */}
      <div>
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          ที่อยู่ที่สามารถติดต่อได้ระหว่างลา <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.contactAddress}
          onChange={(e) => updateFormData({ contactAddress: e.target.value })}
          placeholder="เลขที่บ้าน ถนน ตำบล อำเภอ จังหวัด"
          rows={3}
          minLength={10}
          maxLength={300}
          required
          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all resize-none"
        />
      </div>

      {/* Contact phone */}
      <div>
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          เบอร์โทรศัพท์ที่สามารถติดต่อได้ระหว่างลา <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={formData.contactPhone || ''}
          onChange={(e) => updateFormData({ contactPhone: e.target.value })}
          placeholder="เช่น 0812345678 หรือ 081-234-5678"
          required
          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          กรอกเบอร์โทรศัพท์ที่สามารถติดต่อได้ระหว่างวันลา
        </p>
      </div>

      {/* File attachments */}
      <div>
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          แนบไฟล์ (ไม่บังคับ)
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          JPG, PNG, PDF • สูงสุด 5 ไฟล์ • ไฟล์ละไม่เกิน 10 MB • รูปจะถูกบีบอัดอัตโนมัติ
        </p>

        {/* File list */}
        {formData.files.length > 0 && (
          <div className="space-y-2 mb-3">
            {formData.files.map((file, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
              >
                <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  {file.type.startsWith('image/') ? (
                    <ImageIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveFile(index)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {formData.files.length < 5 && (
          <label className={`
            flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors
            ${compressing
              ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-wait'
              : 'border-slate-300 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/10'
            }
          `}>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileSelect}
              disabled={compressing}
              className="hidden"
            />
            {compressing ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-400 border-t-sky-500 rounded-full animate-spin" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  กำลังบีบอัด...
                </span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  เลือกไฟล์หรือถ่ายรูป
                </span>
              </>
            )}
          </label>
        )}
      </div>


      {/* Submit button (desktop) */}
      <div className="hidden md:block">
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>กำลังส่ง...</span>
            </>
          ) : (
            <>
              <ArrowRight className="w-5 h-5" />
              <span>{requireSignature ? 'ถัดไป' : 'ยืนยันและส่งใบลา'}</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
