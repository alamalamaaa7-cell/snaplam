import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '../../../../lib/auth';
import { store } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    return Response.json({ status: false, error: 'Admin only' }, { status: 403 });
  }
  const { email, banned } = await req.json();
  if (!email) return Response.json({ status: false, error: 'email required' }, { status: 400 });
  if (email === process.env.ADMIN_EMAIL) {
    return Response.json({ status: false, error: 'Cannot ban admin' }, { status: 400 });
  }
  await store.setBan(email, !!banned);
  return Response.json({ status: true });
}
  
