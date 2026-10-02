-- Optimize dashboard queries
-- Add composite indexes for frequently used query patterns

-- Optimize leaves query by status + date range
CREATE INDEX IF NOT EXISTS "leaves_status_start_date_end_date_idx" ON "leaves"("status", "start_date", "end_date");

-- Optimize leaves query by type + status + created_at for exceeding quota calculations
CREATE INDEX IF NOT EXISTS "leaves_type_status_created_at_idx" ON "leaves"("type", "status", "created_at");

-- Optimize leave_days query for heatmap (date range + leave status)
CREATE INDEX IF NOT EXISTS "leave_days_date_leave_id_idx" ON "leave_days"("date", "leave_id");
