# Database Optimization Migration Guide

## 📋 Pre-Migration Checklist

- [ ] Backup database
- [ ] Check current database size
- [ ] Estimate migration time
- [ ] Schedule maintenance window (if needed)

## 🚀 Migration Steps

### Step 1: Backup Database

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Prisma (exports schema only)
npx prisma db pull
```

### Step 2: Apply Prisma Schema Changes

```bash
# Generate new Prisma Client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_performance_indexes
```

### Step 3: Verify Indexes Created

```sql
-- Check indexes on teachers table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'teachers';

-- Check indexes on leaves table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'leaves';
```

Expected indexes:
- `teachers_department_idx`
- `teachers_teacher_code_is_active_idx`
- `leaves_fiscal_year_status_idx`
- `leaves_fiscal_year_round_idx`
- `leaves_teacher_id_status_created_at_idx`
- `leaves_status_printed_at_idx`
- `leaves_type_idx`

### Step 4: Test Performance

```bash
# Run the app
npm run dev

# Test key endpoints:
# - GET /api/hr/leaves
# - GET /api/hr/dashboard/summary
# - GET /api/hr/approvals/pending
# - GET /api/teacher/leaves/history
```

### Step 5: Monitor Query Performance

```sql
-- Enable query logging (if not already enabled)
ALTER DATABASE your_db_name SET log_min_duration_statement = 1000;

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## 🔧 Rollback Plan

If issues occur, rollback using:

```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Or drop indexes manually
DROP INDEX IF EXISTS teachers_department_idx;
DROP INDEX IF EXISTS teachers_teacher_code_is_active_idx;
DROP INDEX IF EXISTS leaves_fiscal_year_status_idx;
DROP INDEX IF EXISTS leaves_fiscal_year_round_idx;
DROP INDEX IF EXISTS leaves_teacher_id_status_created_at_idx;
DROP INDEX IF EXISTS leaves_status_printed_at_idx;
DROP INDEX IF EXISTS leaves_type_idx;
```

## ⏱️ Estimated Migration Time

- **Small DB** (<10K records): ~5-10 seconds
- **Medium DB** (10K-100K records): ~30-60 seconds
- **Large DB** (>100K records): ~2-5 minutes

## ⚠️ Production Deployment

### For Zero-Downtime Deployment:

1. **Create indexes CONCURRENTLY** (won't lock table):
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "teachers_department_idx" ON "teachers"("department");
-- ... repeat for all indexes
```

2. **During deployment:**
```bash
# 1. Apply migration
npx prisma migrate deploy

# 2. Deploy new application code
# (indexes are already created, app can use them)
```

### Environment Variable Updates

Update `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/leave_npw?schema=public&pgbouncer=true&connection_limit=10"
DIRECT_URL="postgresql://user:password@localhost:5432/leave_npw?schema=public"
```

## 📊 Post-Migration Monitoring

### Monitor Index Usage

```sql
-- Check index usage stats
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Check Query Performance

```sql
-- Compare before/after execution plans
EXPLAIN ANALYZE 
SELECT * FROM leaves 
WHERE fiscal_year = 2567 AND status = 'approved';
```

## ✅ Success Criteria

- [ ] All indexes created successfully
- [ ] API response times improved 50%+
- [ ] No errors in application logs
- [ ] Database CPU usage stable or decreased
- [ ] Zero data loss

## 📞 Support

If issues occur:
1. Check application logs
2. Check database logs
3. Verify index creation
4. Run EXPLAIN ANALYZE on slow queries
5. Rollback if necessary

---

Migration created: $(date)
