# Deployment Guide - Leave-NPW System

## Prerequisites

- Node.js 18+ installed locally
- Git installed
- Vercel account (free Hobby plan)
- Neon account (free tier)
- (Optional) Telegram Bot for notifications
- (Optional) Vercel Blob for file attachments

## 1. Database Setup (Neon)

### Create Neon Project

1. Sign up at https://neon.tech
2. Create new project: "leave-npw-production"
3. Select region closest to your users (Bangkok/Singapore recommended)
4. Create database: `leave_npw`

### Configure Neon Settings

```
Compute Settings:
- Autoscaling: Min 0.25 CU, Max 0.5 CU (to stay within free tier)
- Autosuspend: 5 minutes (default)
- Compute lifecycle: Scale to zero

Connection Pooling:
- Enable connection pooling (PgBouncer)
```

### Create Branches

```bash
# Development branch (for testing)
# In Neon console: Create branch "dev" from main

# Get connection strings:
# 1. Pooled URL (for API routes): postgres://...?pgbouncer=true&connect_timeout=15
# 2. Direct URL (for migrations): postgres://... (no query params)
```

### Run Migrations

```bash
# Set environment variables
export DATABASE_URL="postgresql://...?pgbouncer=true&connect_timeout=15"
export DIRECT_URL="postgresql://..."

# Generate Prisma Client
npm install
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

The seed script creates:
- 1 super admin account (username: `admin`, password: from `BOOTSTRAP_ADMIN_PASSWORD` env var)
- System settings with default values
- Sample holidays for current year

**⚠️ IMPORTANT**: Change the admin password immediately after first login!

## 2. Vercel Blob Setup (Optional)

### Enable Vercel Blob

1. Go to Vercel Dashboard → Storage
2. Create new Blob store: "leave-npw-attachments"
3. Connect to your project
4. Copy `BLOB_READ_WRITE_TOKEN`

**Free Tier Limits:**
- 1 GB storage (total across all projects)
- 100 GB bandwidth/month

**Configuration:**
- Automatic URL signing (15-minute expiry)
- No public access
- Files deleted when: leave cancelled, super admin delete, clear test data

## 3. Telegram Bot Setup (Optional)

### Create Bot

```bash
# 1. Message @BotFather on Telegram
# 2. Send: /newbot
# 3. Follow prompts to create bot
# 4. Save the token: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# 5. Create a group for HR notifications
# 6. Add the bot to the group
# 7. Get chat ID:

# Send a message to the group, then visit:
# https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates

# Look for "chat":{"id":-1001234567890,...}
# The ID is: -1001234567890
```

**Bot Settings:**
```
Name: ระบบแจ้งลาโรงเรียน (or your school name)
Description: แจ้งเตือนการยื่นใบลาและสรุปประจำวัน
Privacy: Enabled (bot sees all messages in group)
```

## 4. Environment Variables

### Required Variables

```bash
# Database (from Neon)
DATABASE_URL="postgresql://user:password@host.neon.tech/leave_npw?pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://user:password@host.neon.tech/leave_npw"

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET="your-randomly-generated-32-byte-string"

# Bootstrap Admin Password (for first-time setup)
BOOTSTRAP_ADMIN_PASSWORD="ChangeMe12345!"

# Cron Secret (generate with: openssl rand -base64 32)
CRON_SECRET="your-cron-secret-here"

# Node Environment
NODE_ENV="production"
```

### Optional Variables

```bash
# Vercel Blob (for file attachments)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# Telegram (for notifications)
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_CHAT_ID="-1001234567890"
```

## 5. Deploy to Vercel

### Method 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project (first time only)
vercel link

# Set environment variables
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
vercel env add SESSION_SECRET production
vercel env add BOOTSTRAP_ADMIN_PASSWORD production
vercel env add CRON_SECRET production

# Optional: Add Blob and Telegram
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_CHAT_ID production

# Deploy
vercel --prod
```

### Method 2: GitHub Integration

```bash
# 1. Push code to GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/leave-npw.git
git push -u origin main

# 2. Import project in Vercel Dashboard
# - Connect GitHub account
# - Select repository
# - Configure environment variables
# - Deploy
```

### Vercel Project Settings

```
Framework Preset: Next.js
Root Directory: ./
Build Command: npm run build (default)
Output Directory: .next (default)
Install Command: npm install (default)
Development Command: npm run dev (default)

Build & Development Settings:
- Node.js Version: 18.x
```

## 6. Configure Vercel Cron Jobs

Cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 1 * * *"
    }
  ]
}
```

**Schedule:** `0 1 * * *` = 01:00 UTC = 08:00 Thailand time

**⚠️ Hobby Plan Limit:** 1 cron job per day only

### Verify Cron Setup

```bash
# After deployment, trigger manually to test:
curl -X POST https://your-app.vercel.app/api/cron/daily-summary \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Check Telegram group for summary message
```

## 7. Post-Deployment Setup

### 7.1 First Login

1. Visit: `https://your-app.vercel.app/hr/login`
2. Login with:
   - Username: `admin`
   - Password: (value of `BOOTSTRAP_ADMIN_PASSWORD`)
3. **Immediately go to Settings → Change Password**

### 7.2 Configure Settings

Navigate to `/hr/settings`:

```
General Settings:
- School Name: โรงเรียนบ้านเนินพลับหวาน
- Backdate Limit (Teacher): 14 days
- Backdate Limit (HR): 30 days

Quotas (Super Admin Only):
- Sick/Personal: 23 days
- Maternity: 90 days
- Religious: 120 days

Signatories:
- Add Director (name, position, optional signature image)
- Add HR Head (name, position, optional signature image)
- Select current signatories

Telegram (Super Admin Only):
- Bot Token: (from step 3)
- Chat ID: (from step 3)
- Test Send: Click to verify
```

### 7.3 Add Holidays

Navigate to `/hr/holidays`:

1. Add holidays for current year (2569/2026)
2. Add holidays for next year (2570/2027)
3. Use "Copy from Previous Year" button to speed up

### 7.4 Import Teachers

Navigate to `/hr/teachers`:

1. Download template Excel file
2. Fill in teacher data:
   - Teacher Code (optional - auto-generated if empty)
   - Title, First Name, Last Name
   - Citizen ID (13 digits)
   - Birth Date
   - Position
   - Department (optional)
   - Phone (optional)
3. Import → Validate → Review → Confirm

### 7.5 Test Complete Flow

**Test as Teacher:**
1. Go to `/verify`
2. Enter citizen ID + birth date
3. Submit a leave request
4. Check Telegram notification

**Test as HR:**
1. Login to `/hr/login`
2. Approve the leave
3. Print PDF
4. Verify PDF displays correctly with Thai fonts

## 8. Monitoring & Maintenance

### 8.1 Vercel Dashboard

Monitor:
- Function invocations
- Error rate
- Response times
- Bandwidth usage

**Hobby Plan Limits:**
- 100 GB bandwidth/month
- Serverless function invocations: unlimited (but watch CPU time)

### 8.2 Neon Dashboard

Monitor:
- Compute usage (target: < 100 CU-hours/month)
- Storage usage (target: < 512 MB)
- Active connections
- Query performance

### 8.3 Vercel Blob Dashboard

Monitor:
- Storage usage (target: < 700 MB, critical: 900 MB)
- Bandwidth usage

### 8.4 Check System Status

Super Admin → `/hr/admin` → System Status:
- Database connection
- Blob storage usage
- Telegram configuration
- Last cron run
- System statistics

## 9. Backup Strategy

### 9.1 Database Backups

**Automatic (Neon):**
- Point-in-time recovery: 7 days (free tier)
- Branch snapshots: manual

**Manual Backup:**
```bash
# Export full database
curl https://your-app.vercel.app/api/hr/admin/danger/export-full-database \
  -H "Cookie: hr_session=..." \
  -o backup-$(date +%Y%m%d).xlsx

# Or use Neon branching:
# Create branch "backup-YYYYMMDD" from main
```

### 9.2 File Attachments Backup

Vercel Blob does not provide automatic backups. Consider:
- Periodic export via `/hr/storage` page
- Download large attachments manually
- Use separate backup storage if critical

## 10. Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql "postgresql://...?pgbouncer=true&connect_timeout=15"

# Check Prisma Client
npx prisma db pull
npx prisma generate

# View connection pool status (Neon dashboard)
```

### Vercel Build Failures

```bash
# Common issues:
# 1. Missing environment variables
vercel env ls

# 2. Prisma Client not generated
# Add to package.json:
"scripts": {
  "postinstall": "prisma generate"
}

# 3. Out of memory (Puppeteer)
# Already configured: maxDuration: 60, runtime: 'nodejs'
```

### PDF Generation Fails

```bash
# Check Puppeteer setup:
# - @sparticuz/chromium installed
# - puppeteer-core installed
# - lib/pdf/chromium.ts configured correctly

# Test locally:
npm run dev
# Visit: http://localhost:3000/hr/leaves/[id]/pdf

# Check Vercel function logs
vercel logs
```

### Telegram Not Sending

```bash
# Test bot token
curl https://api.telegram.org/bot<TOKEN>/getMe

# Test send message
curl -X POST https://api.telegram.org/bot<TOKEN>/sendMessage \
  -d "chat_id=<CHAT_ID>&text=Test"

# Check notification queue
# HR Dashboard → "แจ้งเตือนที่ส่งไม่สำเร็จ"
# Click "ส่งซ้ำ" to retry
```

### Session Issues

```bash
# Symptoms: Logged out immediately, session expires too fast

# Check SESSION_SECRET is set correctly
vercel env ls

# Verify cookie settings in lib/session.ts:
# - secure: true (production only)
# - httpOnly: true
# - sameSite: 'lax'

# Clear browser cookies and retry
```

## 11. Security Checklist

Before going live:

- [ ] Changed default admin password
- [ ] SESSION_SECRET is random 32+ bytes
- [ ] CRON_SECRET is random 32+ bytes
- [ ] Database credentials are secure
- [ ] Telegram bot token is private (not in code)
- [ ] BLOB_READ_WRITE_TOKEN is private
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Security headers configured (next.config.ts)
- [ ] Rate limiting tested (5 failed logins → 15-min lock)
- [ ] Citizen ID checksum validation working
- [ ] File upload size limits enforced (10 MB)
- [ ] File type whitelist enforced (JPG/PNG/PDF only)
- [ ] Signed URLs expire after 15 minutes
- [ ] Super admin cannot delete self
- [ ] Must maintain ≥1 super admin

## 12. Scaling Considerations

### When to Upgrade from Free Tier

**Vercel Hobby → Pro ($20/month):**
- Monthly bandwidth > 80 GB consistently
- Need multiple cron jobs per day
- Need longer function duration (up to 5 minutes)
- Need priority support

**Neon Free → Pro ($19/month):**
- Compute hours > 80 CU-hours/month
- Storage > 400 MB
- Need faster autoscale (min 0.5 CU → 2 CU)
- Need longer data retention (30 days)

**Vercel Blob:**
- Storage > 700 MB consistently
- Consider external storage (AWS S3, Cloudflare R2)

### Performance Targets

With current free tier configuration:
- 100 active teachers
- ~400 leaves/year
- ~10 concurrent users (peak)
- API response time: < 500ms (p95)
- PDF generation: < 6s (cold start)

## 13. Rollback Procedure

### Rollback Vercel Deployment

```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>
```

### Rollback Database Migration

```bash
# Neon: Restore from branch
# 1. Create branch from production (before migration)
# 2. If migration fails, switch production to backup branch

# Prisma: Manual rollback
# 1. Write down migration SQL
# 2. Write reverse migration
# 3. Run: psql < rollback.sql
```

## 14. Support & Updates

### Getting Updates

```bash
# Pull latest version
git pull origin main

# Install dependencies
npm install

# Run new migrations
npx prisma migrate deploy

# Deploy
vercel --prod
```

### Reporting Issues

- GitHub Issues: (your repository URL)
- Email: (your support email)
- Emergency Contact: (phone number)

---

## Quick Reference

### Important URLs

```
Production App: https://your-app.vercel.app
Vercel Dashboard: https://vercel.com/dashboard
Neon Dashboard: https://console.neon.tech
Telegram Bot: https://t.me/your_bot_name
```

### Default Credentials (First Time Only)

```
Username: admin
Password: (BOOTSTRAP_ADMIN_PASSWORD value)

⚠️ CHANGE IMMEDIATELY AFTER FIRST LOGIN
```

### Support Commands

```bash
# Check deployment status
vercel ls

# View logs
vercel logs --follow

# Check environment
vercel env ls

# Test database connection
npx prisma db pull

# Generate Prisma Client
npx prisma generate
```

---

**Deployment Date:** ___________  
**Deployed By:** ___________  
**Production URL:** ___________  
**Admin Password Changed:** [ ] Yes [ ] No
