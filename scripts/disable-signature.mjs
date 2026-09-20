import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // First, check if settings record exists
  const existing = await prisma.settings.findFirst();

  if (!existing) {
    console.log('⚠️ No settings record found. Creating default settings...');
    const result = await prisma.settings.create({
      data: {
        schoolName: 'โรงเรียนบ้านเนินพลับหวาน',
        schoolAddress: '',
        sickPersonalQuotaDays: 23,
        maternityQuotaDays: 90,
        religiousQuotaDays: 120,
        backdateLimitDays: 14,
        hrBackdateLimitDays: 30,
        systemStartDate: new Date('2024-09-01'),
        requireTeacherSignature: false
      }
    });
    console.log('✅ Created settings with requireTeacherSignature:', result.requireTeacherSignature);
  } else {
    const result = await prisma.settings.update({
      where: { id: existing.id },
      data: { requireTeacherSignature: false }
    });
    console.log('✅ Updated settings:', result.requireTeacherSignature);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
