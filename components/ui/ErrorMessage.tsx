import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
}

export function ErrorMessage({
  title = 'เกิดข้อผิดพลาด',
  message,
  onRetry,
  showHomeButton = false
}: ErrorMessageProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-heading-md mb-2 text-center">{title}</h3>
      <p className="text-body-sm text-secondary text-center mb-6 max-w-md">
        {message}
      </p>
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            ลองอีกครั้ง
          </button>
        )}
        {showHomeButton && (
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors flex items-center gap-2 active:scale-95"
          >
            <Home className="w-4 h-4" />
            กลับหน้าหลัก
          </button>
        )}
      </div>
    </div>
  );
}
