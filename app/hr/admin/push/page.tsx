import { redirect } from 'next/navigation';
import { validateHrSession } from '@/lib/validateSession';
import { prisma } from '@/lib/prisma';
import { deviceLabel } from '@/lib/push/deviceLabel';
import PushSubscribersClient, { type TeacherPushRow } from './PushSubscribersClient';

export const metadata = {
  title: 'การแจ้งเตือนของครู | ระบบลาออนไลน์',
  description: 'ครูที่เปิดการแจ้งเตือน push และเวลาเข้าแอปล่าสุด',
};

export default async function AdminPushPage() {
  const validation = await validateHrSession();

  if (!validation.valid) {
    redirect('/hr/login');
  }

  const { session } = validation;

  if (session.role !== 'super_admin') {
    redirect('/hr/dashboard');
  }

  const teachers = await prisma.teacher.findMany({
    where: { isActive: true },
    select: {
      id: true,
      teacherCode: true,
      title: true,
      firstName: true,
      lastName: true,
      department: true,
      pushSubscriptions: {
        select: { id: true, userAgent: true, createdAt: true, lastUsedAt: true },
        orderBy: { lastUsedAt: 'desc' },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  // ส่งเฉพาะข้อมูลที่หน้าใช้ ไม่ส่ง endpoint/keys ไปฝั่ง browser
  const rows: TeacherPushRow[] = teachers.map((t) => ({
    id: t.id,
    teacherCode: t.teacherCode,
    name: `${t.title}${t.firstName} ${t.lastName}`,
    department: t.department,
    // subscriptions เรียงตาม lastUsedAt ล่าสุดก่อน
    lastSeenAt: t.pushSubscriptions[0]?.lastUsedAt.toISOString() ?? null,
    devices: t.pushSubscriptions.map((s) => ({
      id: s.id,
      label: deviceLabel(s.userAgent),
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
    })),
  }));

  return (
    <PushSubscribersClient
      hrUser={{
        id: session.id!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
      rows={rows}
      now={new Date().toISOString()}
    />
  );
}
