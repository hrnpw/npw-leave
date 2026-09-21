import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-6">
          <FileQuestion className="w-10 h-10 text-red-600" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          ไม่พบใบลา
        </h1>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          ไม่พบใบลาที่ท่านค้นหา กรุณาตรวจสอบเลขที่ใบลาอีกครั้ง
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-600 transition-colors"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    </div>
  );
}
