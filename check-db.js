const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('📊 Database Check:\n');

    const counts = {
      teachers: await prisma.teacher.count(),
      hrUsers: await prisma.hrUser.count(),
      settings: await prisma.settings.count(),
      signatories: await prisma.signatory.count(),
      holidays: await prisma.holiday.count(),
      leaves: await prisma.leave.count(),
    };

    console.log('Counts:');
    console.log(JSON.stringify(counts, null, 2));

    console.log('\n👤 HR Users:');
    const hrUsers = await prisma.hrUser.findMany({
      select: { username: true, firstName: true, lastName: true, role: true, isActive: true }
    });
    console.log(JSON.stringify(hrUsers, null, 2));

    console.log('\n👥 Teachers:');
    const teachers = await prisma.teacher.findMany({
      select: { code: true, firstName: true, lastName: true, isActive: true }
    });
    console.log(JSON.stringify(teachers, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
