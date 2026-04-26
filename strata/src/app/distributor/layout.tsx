import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AppShell } from '../_components/AppShell';

export default async function DistributorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/');
  if (session.role !== 'distributor') redirect('/client');
  return <AppShell role="distributor" email={session.email}>{children}</AppShell>;
}
