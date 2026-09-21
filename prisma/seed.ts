import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}.${hash}`;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Create settings
  const settings = await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      schoolName: 'โรงเรียนบ้านเนินพลับหวาน',
      systemStartDate: new Date(2026, 0, 1), // Jan 1, 2026
      backdateLimitDays: 14,
      hrBackdateLimitDays: 30,
      quotaSickPersonal: 23,
      quotaMaternity: 90,
      quotaReligious: 120,
      requireTeacherSignature: false, // Default: off
    },
  });
  console.log('✅ Created settings');

  // Create super admin (password: change-me-on-first-login)
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'admin123';
  const admin = await prisma.hrUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashPassword(adminPassword),
      firstName: 'ผู้ดูแล',
      lastName: 'ระบบ',
      role: 'super_admin',
      isActive: true,
    },
  });
  console.log('✅ Created super admin:', admin.username);

  // Create HR user
  const hr = await prisma.hrUser.upsert({
    where: { username: 'hr001' },
    update: {},
    create: {
      username: 'hr001',
      passwordHash: hashPassword('hr123'),
      firstName: 'สมหญิง',
      lastName: 'ใจดี',
      role: 'hr',
      isActive: true,
    },
  });
  console.log('✅ Created HR user:', hr.username);

  // Create sample teachers
  const teachers = await Promise.all([
    prisma.teacher.upsert({
      where: { citizenId: '1101700207951' },
      update: {},
      create: {
        teacherCode: 'T-0001',
        citizenId: '1101700207951',
        title: 'นาย',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        birthDate: new Date('1985-01-15T00:00:00.000Z'),
        position: 'ครู',
        department: 'คณิตศาสตร์',
        phone: '0812345678',
        isActive: true,
      },
    }),
    prisma.teacher.upsert({
      where: { citizenId: '1234567890120' },
      update: {},
      create: {
        teacherCode: 'T-0002',
        citizenId: '1234567890120',
        title: 'นาง',
        firstName: 'สมหญิง',
        lastName: 'รักเรียน',
        birthDate: new Date('1980-06-20T00:00:00.000Z'),
        position: 'ครู',
        department: 'ภาษาไทย',
        phone: '0823456789',
        isActive: true,
      },
    }),
    prisma.teacher.upsert({
      where: { citizenId: '9876543210987' },
      update: {},
      create: {
        teacherCode: 'T-0003',
        citizenId: '9876543210987',
        title: 'นางสาว',
        firstName: 'มาลี',
        lastName: 'สดใส',
        birthDate: new Date('1990-09-10T00:00:00.000Z'),
        position: 'ครู',
        department: 'วิทยาศาสตร์',
        phone: '0834567890',
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ Created ${teachers.length} teachers`);

  // Create holidays for 2026
  const holidays = await Promise.all([
    prisma.holiday.upsert({
      where: { date: new Date(2026, 0, 1) },
      update: {},
      create: {
        date: new Date(2026, 0, 1),
        name: 'วันขึ้นปีใหม่',
        year: 2026,
      },
    }),
    prisma.holiday.upsert({
      where: { date: new Date(2026, 3, 6) },
      update: {},
      create: {
        date: new Date(2026, 3, 6),
        name: 'วันจักรี',
        year: 2026,
      },
    }),
  ]);
  console.log(`✅ Created ${holidays.length} holidays`);

  // Create signatories
  const director = await prisma.signatory.upsert({
    where: { id: 'director-1' },
    update: {},
    create: {
      id: 'director-1',
      role: 'director',
      title: 'นาย',
      firstName: 'สมศักดิ์',
      lastName: 'ผู้นำ',
      position: 'ผู้อำนวยการโรงเรียนบ้านเนินพลับหวาน',
      isActive: true,
    },
  });

  const hrHead = await prisma.signatory.upsert({
    where: { id: 'hr-head-1' },
    update: {},
    create: {
      id: 'hr-head-1',
      role: 'hr_head',
      title: 'นาง',
      firstName: 'สมศรี',
      lastName: 'จัดการ',
      position: 'หัวหน้าฝ่ายบุคคล',
      isActive: true,
    },
  });

  // Set current signatories
  await prisma.settings.update({
    where: { id: 'singleton' },
    data: {
      currentDirectorId: director.id,
      currentHrHeadId: hrHead.id,
    },
  });
  console.log('✅ Created signatories');

  console.log('🎉 Seed completed!');
  console.log('\n📝 Login credentials:');
  console.log('Super Admin - username: admin, password:', adminPassword);
  console.log('HR - username: hr001, password: hr123');
  console.log('\nTeacher login (citizen ID + birthdate):');
  console.log('- 1101700207951 / 15/01/2528');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
