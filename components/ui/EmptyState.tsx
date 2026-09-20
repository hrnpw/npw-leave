import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'success' | 'info';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default'
}: EmptyStateProps) {
  const variantStyles = {
    default: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      icon: 'text-slate-600 dark:text-slate-400',
    },
    success: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      icon: 'text-emerald-600 dark:text-emerald-400',
    },
    info: {
      bg: 'bg-sky-100 dark:bg-sky-900/30',
      icon: 'text-sky-600 dark:text-sky-400',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className={`w-16 h-16 ${styles.bg} rounded-full flex items-center justify-center mb-4`}>
        <Icon className={`w-8 h-8 ${styles.icon}`} />
      </div>
      <h3 className="text-heading-md mb-2">{title}</h3>
      {description && (
        <p className="text-body-sm text-secondary mb-6 max-w-md">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
