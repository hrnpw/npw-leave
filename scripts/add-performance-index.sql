-- Performance optimization index for exceeding quota query
-- This index speeds up the aggregation query in /api/hr/dashboard/summary

CREATE INDEX IF NOT EXISTS "idx_leaves_quota_check"
ON "leaves"("status", "type", "created_at", "teacher_id", "days_calendar")
WHERE "status" = 'approved' AND "type" IN ('sick', 'personal');

-- Verify index was created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'leaves' AND indexname = 'idx_leaves_quota_check';
