'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
}

interface ImportRow {
  row: number;
  teacherCode?: string;
  title: string;
  firstName: string;
  lastName: string;
  citizenId: string;
  birthDate: string;
  position: string;
  department?: string;
  phone?: string;
}

interface ValidationResult {
  valid: ImportRow[];
  errors: Array<{ row: number; message: string; rows?: number[] }>;
  warnings: Array<{
    row: number;
    type: 'duplicate_in_system' | 'inactive_teacher';
    message: string;
    existingTeacher?: any;
  }>;
}

export default function ImportClient({ hrUser }: ImportClientProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [onDuplicateAction, setOnDuplicateAction] = useState<'skip' | 'update' | 'reactivate'>('skip');
  const [skipErrors, setSkipErrors] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('กรุณาเลือกไฟล์ .csv เท่านั้น');
        return;
      }
      setFile(selectedFile);
      setValidationResult(null);
    }
  };

  const parseCSV = (text: string): ImportRow[] => {
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error('ไฟล์ไม่มีข้อมูล');
    }

    // Skip header
    const dataLines = lines.slice(1);
    const rows: ImportRow[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      // Parse CSV (handle quoted fields)
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.trim());

      // Map to ImportRow
      rows.push({
        row: i + 2, // +2 because row 1 is header and we're 0-indexed
        teacherCode: fields[0] || undefined,
        title: fields[1] || '',
        firstName: fields[2] || '',
        lastName: fields[3] || '',
        citizenId: fields[4] || '',
        birthDate: fields[5] || '',
        position: fields[6] || '',
        department: fields[7] || undefined,
        phone: fields[8] || undefined,
      });
    }

    return rows;
  };

  const handleValidate = async () => {
    if (!file) return;

    try {
      setValidating(true);

      // Read file
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error('ไฟล์ไม่มีข้อมูล');
        return;
      }

      if (rows.length > 500) {
        toast.error('จำกัดไม่เกิน 500 แถวต่อครั้ง');
        return;
      }

      // Validate
      const res = await fetch('/api/hr/teachers/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      setValidationResult(data);
      toast.success('ตรวจสอบเสร็จสิ้น');
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถตรวจสอบไฟล์ได้');
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult) return;

    const confirmed = confirm(
      `ยืนยันการ import ครู ${validationResult.valid.length + validationResult.warnings.length} คน?`
    );
    if (!confirmed) return;

    try {
      setImporting(true);

      // Prepare rows (valid + warnings with selected action)
      const rowsToImport = [
        ...validationResult.valid,
        ...validationResult.warnings.map((w) => {
          const original = [...validationResult.valid, ...validationResult.warnings].find(
            (r) => r.row === w.row
          );
          return original;
        }).filter(Boolean),
      ];

      const res = await fetch('/api/hr/teachers/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rowsToImport,
          options: {
            skipErrors,
            onDuplicateAction,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success(
        `Import สำเร็จ: เพิ่มใหม่ ${data.results.success} คน, อัปเดต ${data.results.updated} คน`
      );

      // Navigate back to teachers list
      router.push('/hr/teachers');
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถ import ได้');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      'รหัสครู,คำนำหน้า,ชื่อ,นามสกุล,เลขบัตรประชาชน,วันเกิด,ตำแหน่ง,กลุ่มสาระ/ฝ่าย,เบอร์โทร',
      ',นาย,สมชาย,ใจดี,1234567890123,1990-01-15,ครูผู้สอน,คณิตศาสตร์,0812345678',
      'T-0050,นางสาว,สมหญิง,รักเรียน,9876543210987,1985-05-20,ครูผู้สอน,ภาษาไทย,0898765432',
    ].join('\n');

    const blob = new Blob(['﻿' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template-import-teachers.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasErrors = validationResult && validationResult.errors.length > 0;
  const hasWarnings = validationResult && validationResult.warnings.length > 0;
  const canImport = validationResult && (validationResult.valid.length > 0 || hasWarnings);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Import ครูจาก Excel
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                นำเข้าข้อมูลครูจากไฟล์ CSV
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Template</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Instructions */}
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 mb-6">
          <h3 className="font-semibold text-sky-900 dark:text-sky-100 mb-2">
            วิธีการ Import
          </h3>
          <ol className="text-sm text-sky-700 dark:text-sky-300 space-y-1 list-decimal list-inside">
            <li>ดาวน์โหลด Template CSV</li>
            <li>กรอกข้อมูลครู (รหัสครูไม่บังคับ - ระบบจะสร้างให้)</li>
            <li>บันทึกเป็น CSV (UTF-8 with BOM)</li>
            <li>เลือกไฟล์และกดตรวจสอบ</li>
            <li>ตรวจสอบผลและยืนยันการ import</li>
          </ol>
        </div>

        {/* Upload Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
          <div className="flex flex-col items-center justify-center gap-4">
            {!file ? (
              <label className="w-full cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 hover:border-sky-500 dark:hover:border-sky-500 transition-colors">
                  <div className="flex flex-col items-center gap-4">
                    <Upload className="w-12 h-12 text-slate-400" />
                    <div className="text-center">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        เลือกไฟล์ CSV
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        หรือลากไฟล์มาวางที่นี่
                      </p>
                    </div>
                  </div>
                </div>
              </label>
            ) : (
              <div className="w-full">
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                  <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {file.name}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setValidationResult(null);
                    }}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {!validationResult && (
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className="w-full mt-4 px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-all transform active:scale-[0.97]"
                  >
                    {validating ? 'กำลังตรวจสอบ...' : 'ตรวจสอบไฟล์'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Validation Results */}
        <AnimatePresence>
          {validationResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                      ถูกต้อง
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {validationResult.valid.length}
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      เตือน
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">
                    {validationResult.warnings.length}
                  </p>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-900 dark:text-red-100">
                      ผิดพลาด
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {validationResult.errors.length}
                  </p>
                </div>
              </div>

              {/* Errors */}
              {hasErrors && (
                <details open className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-800">
                  <summary className="px-6 py-4 cursor-pointer font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    รายการผิดพลาด ({validationResult.errors.length})
                  </summary>
                  <div className="px-6 pb-4 space-y-2 max-h-64 overflow-y-auto">
                    {validationResult.errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm"
                      >
                        <p className="font-semibold text-red-900 dark:text-red-100">
                          แถว {error.row}
                        </p>
                        <p className="text-red-700 dark:text-red-300 mt-1">{error.message}</p>
                        {error.rows && error.rows.length > 0 && (
                          <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                            ซ้ำกับแถว: {error.rows.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Warnings */}
              {hasWarnings && (
                <details className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-800">
                  <summary className="px-6 py-4 cursor-pointer font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    รายการเตือน ({validationResult.warnings.length})
                  </summary>
                  <div className="px-6 pb-4 space-y-2 max-h-64 overflow-y-auto">
                    {validationResult.warnings.map((warning, idx) => (
                      <div
                        key={idx}
                        className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm"
                      >
                        <p className="font-semibold text-amber-900 dark:text-amber-100">
                          แถว {warning.row}
                        </p>
                        <p className="text-amber-700 dark:text-amber-300 mt-1">
                          {warning.message}
                        </p>
                        {warning.existingTeacher && (
                          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                            <p>
                              ข้อมูลเดิม: {warning.existingTeacher.title}
                              {warning.existingTeacher.firstName}{' '}
                              {warning.existingTeacher.lastName}
                            </p>
                            <p>ตำแหน่ง: {warning.existingTeacher.position}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Options */}
              {canImport && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    ตัวเลือกการ Import
                  </h3>

                  {hasWarnings && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        เมื่อเจอข้อมูลซ้ำในระบบ
                      </label>
                      <select
                        value={onDuplicateAction}
                        onChange={(e) =>
                          setOnDuplicateAction(e.target.value as 'skip' | 'update' | 'reactivate')
                        }
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="skip">ข้าม (ไม่แก้ไข)</option>
                        <option value="update">อัปเดตข้อมูลเดิม</option>
                        <option value="reactivate">เปิดใช้งานคืน + อัปเดต</option>
                      </select>
                    </div>
                  )}

                  {hasErrors && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={skipErrors}
                        onChange={(e) => setSkipErrors(e.target.checked)}
                        className="w-4 h-4 text-sky-600 rounded focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        ข้ามแถวที่ผิดพลาด
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Import Button */}
              {canImport && (
                <button
                  onClick={handleImport}
                  disabled={importing || (hasErrors && skipErrors === false) || undefined}
                  className="w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-all transform active:scale-[0.97]"
                >
                  {importing
                    ? 'กำลัง Import...'
                    : `ยืนยันการ Import (${
                        validationResult.valid.length +
                        (hasWarnings && onDuplicateAction !== 'skip'
                          ? validationResult.warnings.length
                          : 0)
                      } คน)`}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
