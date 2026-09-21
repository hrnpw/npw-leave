# Security Checklist - Leave-NPW System

## ✅ Authentication & Authorization

### Session Management
- [x] iron-session with secure configuration (httpOnly, secure, sameSite: 'lax')
- [x] Separate sessions for teacher and HR (no cross-contamination)
- [x] Session TTL: 1 hour sliding window
- [x] Session warning at 5 minutes before expiry
- [x] Auto-save form data to localStorage on session timeout
- [x] Validate return URL to prevent open redirect attacks

### Password Security
- [x] Password hashing with scrypt (Node.js built-in, OWASP-recommended)
- [x] Minimum 8 characters, max 128 characters
- [x] Timing-safe comparison (timingSafeEqual)
- [x] No password in logs or responses

### Rate Limiting
- [x] Login attempts: 5 max, 15-minute lockout
- [x] Key format: type:identifier:ip (prevents shared IP lockout)
- [x] Countdown display for locked accounts
- [x] Reset on successful login

### Citizen ID Validation
- [x] Thai citizen ID checksum validation (MOD 11)
- [x] Normalized before comparison (remove dashes/spaces)
- [x] Masked display in lists (1-2345-xxxxx-xx-3)
- [x] Full ID visible only to super admin in edit forms
- [x] Generic error messages (prevent enumeration)

## ✅ Role-Based Access Control (RBAC)

### Middleware Guards
- [x] `/teacher/*` requires teacher session
- [x] `/hr/*` requires HR session
- [x] Separate middleware for each role

### API-Level Authorization
- [x] Every API checks session and role
- [x] HR vs Super Admin distinction enforced
- [x] Teacher can only access own leave records
- [x] HR cannot see citizen ID in API responses (masked)
- [x] Super admin-only endpoints block HR users (403)

### Ownership Validation
- [x] Teacher leave history: server-side ownership check
- [x] Teacher leave cancellation: verify leave belongs to teacher
- [x] HR cannot modify super admin users
- [x] Super admin cannot delete self
- [x] Must maintain ≥1 super admin

## ✅ Input Validation

### Zod Schemas
- [x] All API endpoints validate input with Zod
- [x] Citizen ID: 13 digits + checksum
- [x] Username: 3-50 chars, alphanumeric + underscore
- [x] Password: 8-128 chars
- [x] Date format: YYYY-MM-DD
- [x] Leave number format: LV-YYYY-NNNN
- [x] Fiscal year: 2560-2600
- [x] Quota days: 1-365
- [x] Backdate limit: 0-90

### SQL Injection Prevention
- [x] Prisma ORM (parameterized queries)
- [x] No raw SQL queries
- [x] Search inputs sanitized (remove ; ' " \)
- [x] Length limits on all text inputs

### XSS Prevention
- [x] React escapes output by default
- [x] No dangerouslySetInnerHTML
- [x] Content-Security-Policy headers (TODO: add to next.config.js)

## ✅ File Upload Security

### Vercel Blob
- [x] File type whitelist: JPG, PNG, PDF only
- [x] Max file size: 10 MB per file
- [x] Max files per leave: 5
- [x] Client-side image compression (≤2MB before upload)
- [x] Signed URLs with 15-minute expiry
- [x] Auto-regenerate signed URL if expired
- [x] Filename sanitization (prevent path traversal)
- [x] Quota monitoring (1GB total)
- [x] Delete files when: cancel leave, super admin delete, clear test data

### Upload Error Handling
- [x] Upload failure does not block leave submission
- [x] User can attach files later
- [x] 507 Insufficient Storage when quota exceeded

## ✅ CSRF Protection

- [x] SameSite: 'lax' on all cookies
- [x] State-changing operations use POST/PATCH/DELETE (not GET)
- [x] Cron endpoint requires Bearer token in Authorization header

## ✅ Data Exposure Prevention

### Public Dashboard (`/api/public/summary`)
- [x] Whitelist fields only (no sensitive data)
- [x] No rejection reasons
- [x] No contact addresses
- [x] No file attachments
- [x] No HR proxy information
- [x] "อื่นๆ" type shows "อื่นๆ" only (not custom name)
- [x] Cache 60 seconds

### Public Leave Check (`/check/[leave_no]`)
- [x] No reason, address, attachments
- [x] No HR proxy information
- [x] Status and dates only

### PDF Generation
- [x] HR proxy info not shown in PDF
- [x] Teacher name only in "ผู้ขออนุญาต" field

### Audit Log
- [x] HR sees 90 days only
- [x] Super admin sees all
- [x] Append-only (cannot delete/modify)
- [x] Before/after values for sensitive operations

### Telegram Token
- [x] Masked in Settings UI for HR users
- [x] Super admin sees full token with show/hide toggle
- [x] Not logged in audit log

## ✅ Database Security

### Prisma Configuration
- [x] Connection pooling (pgbouncer=true)
- [x] Connection timeout: 15 seconds
- [x] Separate directUrl for migrations
- [x] Singleton pattern (prevent connection leaks)

### Indexes
- [x] teachers: citizenId, isActive
- [x] hr_users: username, isActive
- [x] leaves: teacherId, status, startDate/endDate, createdAt, submittedByHrId
- [x] leave_days: leaveId, date
- [x] attachments: leaveId
- [x] holidays: year, date
- [x] audit_logs: userId, action, resource, createdAt
- [x] notification_queue: status, createdAt

### Transactions
- [x] Leave submission uses transaction
- [x] Import teachers uses transaction
- [x] Fiscal counter increment uses transaction (prevent race condition)

## ✅ Environment Variables

### Required Secrets
- [x] SESSION_SECRET (32+ bytes)
- [x] CRON_SECRET
- [x] DATABASE_URL (pooled)
- [x] DIRECT_URL (direct connection)

### Optional Secrets
- [x] BLOB_READ_WRITE_TOKEN
- [x] TELEGRAM_BOT_TOKEN
- [x] TELEGRAM_CHAT_ID

### Validation
- [x] SESSION_SECRET checked at startup (session.ts)
- [x] CRON_SECRET validated in cron endpoints
- [x] Error if DATABASE_URL missing

## ✅ Serverless Function Security

### Puppeteer Route (`/api/hr/leaves/[id]/pdf`)
- [x] maxDuration: 60
- [x] runtime: 'nodejs'
- [x] HR session required
- [x] Ownership validation (HR can only print leaves in system)
- [x] @sparticuz/chromium for serverless
- [x] No batch printing (one PDF per request)

### Cron Route (`/api/cron/daily-summary`)
- [x] CRON_SECRET validation
- [x] Returns 401 if secret missing/invalid
- [x] Idempotent (safe to retry)

## ⚠️ TODO: Additional Security Measures

### Headers (next.config.js)
- [ ] Content-Security-Policy
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy

### Monitoring
- [ ] Log failed login attempts with IP
- [ ] Alert on multiple failed logins from same IP
- [ ] Monitor unusual data access patterns

### Backup
- [ ] Automated database backups
- [ ] Backup encryption
- [ ] Backup retention policy (30 days minimum)

## 🔒 Security Testing

### Test Cases Covered
- T11: ครูแก้ URL ดูใบลาคนอื่น → 403 ✅
- T12: ครูที่มี teacher session เปิด /hr/dashboard → 403 ✅
- T25: HR ธรรมดายิง API super admin → 403 ✅
- T26: Super admin ลบครูที่มีใบลา → ปฏิเสธ ✅
- T27: Super admin ลบคนสุดท้าย → ปฏิเสธ ✅

### Manual Testing Required
- [ ] Try SQL injection in search fields
- [ ] Try XSS in text inputs (reason, address)
- [ ] Try uploading malicious files (EXE, PHP)
- [ ] Try accessing other users' signed URLs
- [ ] Try brute-force login (verify lockout)
- [ ] Try session hijacking (steal cookie)
- [ ] Try CSRF attack (external site POST)

## 📋 Security Audit History

| Date | Auditor | Findings | Status |
|------|---------|----------|--------|
| 2026-09-11 | Initial Security Review | Implemented core security measures | ✅ Complete |

## 🚨 Incident Response Plan

1. **Suspected Security Breach**
   - Immediately revoke all sessions (change SESSION_SECRET)
   - Review audit logs for suspicious activity
   - Check Vercel logs for unusual access patterns
   - Notify all users to change passwords

2. **Data Leak**
   - Identify scope of leak (what data, which users)
   - Notify affected users within 72 hours (PDPA)
   - Document incident in audit log
   - Implement additional controls to prevent recurrence

3. **Brute Force Attack**
   - IP-based rate limiting already in place
   - Consider adding Cloudflare or similar WAF
   - Review and tighten rate limits if needed

4. **File Upload Abuse**
   - Monitor Blob storage usage
   - Implement additional MIME type validation
   - Add virus scanning if budget allows (ClamAV)
