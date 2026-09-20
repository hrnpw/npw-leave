// Leave quotas (from settings, these are defaults)
export const DEFAULT_QUOTA_SICK_PERSONAL = 23;
export const DEFAULT_QUOTA_MATERNITY = 90;
export const DEFAULT_QUOTA_RELIGIOUS = 120;

// Backdate limits (days)
export const DEFAULT_BACKDATE_LIMIT_DAYS = 14;
export const DEFAULT_HR_BACKDATE_LIMIT_DAYS = 30;

// Session
export const SESSION_TTL_SECONDS = 60 * 60; // 1 hour
export const SESSION_WARNING_SECONDS = 5 * 60; // 5 minutes before expiry

// Rate limiting
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_DURATION_MINUTES = 15;

// File upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_LEAVE = 5;
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const TARGET_COMPRESSED_SIZE = 2 * 1024 * 1024; // 2 MB (target after compression)

// Vercel Blob storage
export const BLOB_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GB
export const BLOB_WARNING_THRESHOLD = 0.7; // 70% (700 MB)

// Leave days
export const MAX_LEAVE_DURATION_DAYS = 120;

// Fiscal year (Thai government)
export const FISCAL_YEAR_START_MONTH = 10; // October (0-indexed: 9)
export const FISCAL_YEAR_START_DAY = 1;

// Leave period (semester)
export const LEAVE_PERIOD_1_START = { month: 4, day: 1 }; // April 1
export const LEAVE_PERIOD_1_END = { month: 9, day: 30 }; // September 30
export const LEAVE_PERIOD_2_START = { month: 10, day: 1 }; // October 1
export const LEAVE_PERIOD_2_END = { month: 3, day: 31 }; // March 31

// Cron job timezone
export const THAILAND_TIMEZONE = 'Asia/Bangkok';

// API cache
export const PUBLIC_API_CACHE_SECONDS = 60;

// PWA
export const PWA_INSTALL_PROMPT_AFTER_VISITS = 2;

// Proxy reasons (for HR submitting on behalf of teachers)
export const PROXY_REASONS = [
  'ครูไม่สะดวกใช้งานระบบออนไลน์',
  'ครูยื่นเอกสารกระดาษ',
  'ครูลาป่วยกะทันหันแจ้งทางโทรศัพท์',
  'อื่นๆ (ระบุ)',
] as const;
