-- AlterEnum
ALTER TYPE "HrRole" ADD VALUE 'director';

-- AlterEnum
ALTER TYPE "LeaveStatus" ADD VALUE 'reviewed';

-- AlterTable
ALTER TABLE "leaves" ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "hr_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "hr_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
