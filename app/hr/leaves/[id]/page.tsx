import { validateHrSession } from '@/lib/validateSession';
import { redirect } from 'next/navigation';
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
  const validation = await validateHrSession();

  if (!validation.valid) {
    redirect('/hr/login');
  }

  const { session } = validation;
  const { id } = await params;

  return (
    <LeaveDetailClient
      leaveId={id}
      hrUser={{
        id: session.id!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
