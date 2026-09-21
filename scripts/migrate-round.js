import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('Starting migration...');

    // Add round column to leaves table
    await prisma.$executeRawUnsafe(`ALTER TABLE "leaves" ADD COLUMN "round" INTEGER`);
    console.log('✓ Added round column to leaves');

    await prisma.$executeRawUnsafe(`UPDATE "leaves" SET "round" = 1 WHERE "round" IS NULL`);
    console.log('✓ Set default round = 1 for existing leaves');

    await prisma.$executeRawUnsafe(`ALTER TABLE "leaves" ALTER COLUMN "round" SET NOT NULL`);
    console.log('✓ Made round NOT NULL in leaves');

    // Add round column to fiscal_counter table
    await prisma.$executeRawUnsafe(`ALTER TABLE "fiscal_counter" ADD COLUMN "round" INTEGER`);
    console.log('✓ Added round column to fiscal_counter');

    await prisma.$executeRawUnsafe(`UPDATE "fiscal_counter" SET "round" = 1 WHERE "round" IS NULL`);
    console.log('✓ Set default round = 1 for existing fiscal_counter');

    await prisma.$executeRawUnsafe(`ALTER TABLE "fiscal_counter" ALTER COLUMN "round" SET NOT NULL`);
    console.log('✓ Made round NOT NULL in fiscal_counter');

    // Update primary key
    await prisma.$executeRawUnsafe(`ALTER TABLE "fiscal_counter" DROP CONSTRAINT "fiscal_counter_pkey"`);
    console.log('✓ Dropped old primary key');

    await prisma.$executeRawUnsafe(`ALTER TABLE "fiscal_counter" ADD CONSTRAINT "fiscal_counter_pkey" PRIMARY KEY ("fiscal_year", "round")`);
    console.log('✓ Added new composite primary key');

    // Add unique constraint
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "leaves_fiscal_year_round_running_no_key" ON "leaves"("fiscal_year", "round", "running_no")`);
    console.log('✓ Added unique constraint on leaves');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
