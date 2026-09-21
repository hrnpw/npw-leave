import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verifyIndexes() {
  console.log('🔍 Verifying database indexes...\n');

  try {
    // Query to get indexes from PostgreSQL
    const teacherIndexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'teachers'
      AND schemaname = 'public'
      ORDER BY indexname;
    `;

    const leaveIndexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'leaves'
      AND schemaname = 'public'
      ORDER BY indexname;
    `;

    console.log('📊 Teachers Table Indexes:');
    console.log('─'.repeat(80));
    teacherIndexes.forEach(idx => {
      console.log(`✓ ${idx.indexname}`);
      console.log(`  ${idx.indexdef}\n`);
    });

    console.log('\n📊 Leaves Table Indexes:');
    console.log('─'.repeat(80));
    leaveIndexes.forEach(idx => {
      console.log(`✓ ${idx.indexname}`);
      console.log(`  ${idx.indexdef}\n`);
    });

    // Check for our new indexes
    const expectedIndexes = {
      teachers: [
        'teachers_department_idx',
        'teachers_teacher_code_is_active_idx'
      ],
      leaves: [
        'leaves_fiscal_year_status_idx',
        'leaves_fiscal_year_round_idx',
        'leaves_teacher_id_status_created_at_idx',
        'leaves_status_printed_at_idx',
        'leaves_type_idx'
      ]
    };

    console.log('\n✅ Verification Summary:');
    console.log('─'.repeat(80));

    const teacherIndexNames = teacherIndexes.map(i => i.indexname);
    const leaveIndexNames = leaveIndexes.map(i => i.indexname);

    let allFound = true;

    expectedIndexes.teachers.forEach(name => {
      const found = teacherIndexNames.includes(name);
      console.log(`${found ? '✓' : '✗'} ${name}`);
      if (!found) allFound = false;
    });

    expectedIndexes.leaves.forEach(name => {
      const found = leaveIndexNames.includes(name);
      console.log(`${found ? '✓' : '✗'} ${name}`);
      if (!found) allFound = false;
    });

    if (allFound) {
      console.log('\n🎉 All performance indexes created successfully!');
    } else {
      console.log('\n⚠️  Some indexes are missing. Please check the migration.');
    }

  } catch (error) {
    console.error('❌ Error verifying indexes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyIndexes();
