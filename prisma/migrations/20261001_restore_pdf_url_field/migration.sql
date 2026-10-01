-- Restore pdf_url column on leaves table
-- A previous migration (20260916000712_remove_pdf_url_field) dropped this
-- column, but the application still relies on it (schema.prisma keeps
-- `pdfUrl String?`) and the column was re-added directly on the database
-- out-of-band. This migration brings migration history back in sync with
-- the actual database state. IF NOT EXISTS makes it a no-op on databases
-- where the column is already present.
ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT;
