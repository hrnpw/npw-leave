-- CreateEnum
CREATE TYPE "HrRole" AS ENUM ('hr', 'super_admin');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('sick', 'personal', 'maternity', 'religious', 'other');

-- CreateEnum
CREATE TYPE "HalfDayPeriod" AS ENUM ('morning', 'afternoon');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "SubmitType" AS ENUM ('teacher', 'hr');

-- CreateEnum
CREATE TYPE "SignatoryRole" AS ENUM ('director', 'hr_head');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'processing', 'success', 'failed');

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "teacher_code" TEXT NOT NULL,
    "citizen_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "HrRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" TEXT NOT NULL,
    "leave_no" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "running_no" INTEGER NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "custom_type_name" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "half_day_period" "HalfDayPeriod",
    "reason" TEXT NOT NULL,
    "contact_address" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "days_working" DOUBLE PRECISION NOT NULL,
    "days_calendar" DOUBLE PRECISION NOT NULL,
    "submitted_by_type" "SubmitType" NOT NULL DEFAULT 'teacher',
    "submitted_by_hr_id" TEXT,
    "proxy_reason" TEXT,
    "proxy_note" TEXT,
    "teacher_signature_url" TEXT,
    "pdf_url" TEXT,
    "approver_name_snapshot" TEXT,
    "approver_position_snapshot" TEXT,
    "director_name_snapshot" TEXT,
    "director_position_snapshot" TEXT,
    "approved_at" TIMESTAMP(3),
    "printed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_days" (
    "id" TEXT NOT NULL,
    "leave_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "is_working_day" BOOLEAN NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "half_day_period" "HalfDayPeriod",

    CONSTRAINT "leave_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "leave_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "blob_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatories" (
    "id" TEXT NOT NULL,
    "role" "SignatoryRole" NOT NULL,
    "title" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "signature_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "school_name" TEXT NOT NULL DEFAULT 'โรงเรียนบ้านเนินพลับหวาน',
    "system_start_date" DATE NOT NULL,
    "backdate_limit_days" INTEGER NOT NULL DEFAULT 14,
    "hr_backdate_limit_days" INTEGER NOT NULL DEFAULT 30,
    "quota_sick_personal" INTEGER NOT NULL DEFAULT 23,
    "quota_maternity" INTEGER NOT NULL DEFAULT 90,
    "quota_religious" INTEGER NOT NULL DEFAULT 120,
    "require_teacher_signature" BOOLEAN NOT NULL DEFAULT false,
    "current_director_id" TEXT,
    "current_hr_head_id" TEXT,
    "telegram_bot_token" TEXT,
    "telegram_chat_id" TEXT,
    "storage_warning_threshold" INTEGER NOT NULL DEFAULT 70,
    "storage_critical_threshold" INTEGER NOT NULL DEFAULT 90,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_queue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_counter" (
    "fiscal_year" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_counter_pkey" PRIMARY KEY ("fiscal_year","round")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "teachers_teacher_code_key" ON "teachers"("teacher_code");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_citizen_id_key" ON "teachers"("citizen_id");

-- CreateIndex
CREATE INDEX "teachers_citizen_id_idx" ON "teachers"("citizen_id");

-- CreateIndex
CREATE INDEX "teachers_is_active_idx" ON "teachers"("is_active");

-- CreateIndex
CREATE INDEX "teachers_department_idx" ON "teachers"("department");

-- CreateIndex
CREATE INDEX "teachers_teacher_code_is_active_idx" ON "teachers"("teacher_code", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_teacher_id_idx" ON "push_subscriptions"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_users_username_key" ON "hr_users"("username");

-- CreateIndex
CREATE INDEX "hr_users_username_idx" ON "hr_users"("username");

-- CreateIndex
CREATE INDEX "hr_users_is_active_idx" ON "hr_users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "leaves_leave_no_key" ON "leaves"("leave_no");

-- CreateIndex
CREATE INDEX "leaves_teacher_id_idx" ON "leaves"("teacher_id");

-- CreateIndex
CREATE INDEX "leaves_status_idx" ON "leaves"("status");

-- CreateIndex
CREATE INDEX "leaves_start_date_end_date_idx" ON "leaves"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "leaves_created_at_idx" ON "leaves"("created_at");

-- CreateIndex
CREATE INDEX "leaves_submitted_by_hr_id_idx" ON "leaves"("submitted_by_hr_id");

-- CreateIndex
CREATE INDEX "leaves_fiscal_year_status_idx" ON "leaves"("fiscal_year", "status");

-- CreateIndex
CREATE INDEX "leaves_fiscal_year_round_idx" ON "leaves"("fiscal_year", "round");

-- CreateIndex
CREATE INDEX "leaves_teacher_id_status_created_at_idx" ON "leaves"("teacher_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "leaves_status_printed_at_idx" ON "leaves"("status", "printed_at");

-- CreateIndex
CREATE INDEX "leaves_type_idx" ON "leaves"("type");

-- CreateIndex
CREATE INDEX "leaves_status_start_date_end_date_idx" ON "leaves"("status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "leaves_teacher_id_type_status_created_at_idx" ON "leaves"("teacher_id", "type", "status", "created_at");

-- CreateIndex
CREATE INDEX "leaves_type_status_idx" ON "leaves"("type", "status");

-- CreateIndex
CREATE INDEX "leaves_type_status_created_at_idx" ON "leaves"("type", "status", "created_at");

-- CreateIndex
CREATE INDEX "leaves_status_type_created_at_teacher_id_days_calendar_idx" ON "leaves"("status", "type", "created_at", "teacher_id", "days_calendar");

-- CreateIndex
CREATE INDEX "leaves_teacher_id_status_start_date_idx" ON "leaves"("teacher_id", "status", "start_date");

-- CreateIndex
CREATE INDEX "leaves_teacher_id_created_at_idx" ON "leaves"("teacher_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "leaves_fiscal_year_round_running_no_key" ON "leaves"("fiscal_year", "round", "running_no");

-- CreateIndex
CREATE INDEX "leave_days_leave_id_idx" ON "leave_days"("leave_id");

-- CreateIndex
CREATE INDEX "leave_days_date_idx" ON "leave_days"("date");

-- CreateIndex
CREATE INDEX "leave_days_date_is_working_day_idx" ON "leave_days"("date", "is_working_day");

-- CreateIndex
CREATE INDEX "leave_days_date_leave_id_idx" ON "leave_days"("date", "leave_id");

-- CreateIndex
CREATE INDEX "attachments_leave_id_idx" ON "attachments"("leave_id");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "holidays_year_idx" ON "holidays"("year");

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "signatories_role_is_active_idx" ON "signatories"("role", "is_active");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_queue_idempotency_key_key" ON "notification_queue"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_queue_status_idx" ON "notification_queue"("status");

-- CreateIndex
CREATE INDEX "notification_queue_created_at_idx" ON "notification_queue"("created_at");

-- CreateIndex
CREATE INDEX "rate_limits_locked_until_idx" ON "rate_limits"("locked_until");

-- CreateIndex
CREATE INDEX "rate_limits_updated_at_idx" ON "rate_limits"("updated_at");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_submitted_by_hr_id_fkey" FOREIGN KEY ("submitted_by_hr_id") REFERENCES "hr_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_days" ADD CONSTRAINT "leave_days_leave_id_fkey" FOREIGN KEY ("leave_id") REFERENCES "leaves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_leave_id_fkey" FOREIGN KEY ("leave_id") REFERENCES "leaves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "hr_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

