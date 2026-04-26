import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AppShell } from '../_components/AppShell';

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/');
  if (session.role !== 'client') redirect('/distributor');
  return <AppShell role="client" email={session.email}>{children}</AppShell>;
}
