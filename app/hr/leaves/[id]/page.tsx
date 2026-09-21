import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import { Metadata } from 'next';
import LeaveDetailClient from './LeaveDetailClient';

export const metadata: Metadata = {
  title: 'รายละเอียดใบลา | ระบบลาออนไลน์',
  description: 'รายละเอียดใบลา',
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LeaveDetailPage({ params }: PageProps) {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  const { id } = await params;

  return (
    <LeaveDetailClient
      leaveId={id}
      hrUser={{
        id: session.id,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
