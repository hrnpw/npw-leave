-- CreateIndex
CREATE INDEX IF NOT EXISTS "teachers_department_idx" ON "teachers"("department");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "teachers_teacher_code_is_active_idx" ON "teachers"("teacher_code", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leaves_fiscal_year_status_idx" ON "leaves"("fiscal_year", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leaves_fiscal_year_round_idx" ON "leaves"("fiscal_year", "round");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leaves_teacher_id_status_created_at_idx" ON "leaves"("teacher_id", "status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leaves_status_printed_at_idx" ON "leaves"("status", "printed_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leaves_type_idx" ON "leaves"("type");
