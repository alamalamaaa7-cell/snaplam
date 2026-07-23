import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '../../../../lib/auth';
import { store } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    return Response.json({ status: false, error: 'Admin only' }, { status: 403 });
  }
  const [stats, users, recent] = await Promise.all([
    store.getStats(),
    store.listUsers(),
    store.recent(50),
  ]);
  return Response.json({ status: true, stats, users, recent, totalUsers: users.length });
}
