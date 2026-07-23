'use client';
import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState('');

  const load = async () => {
    setErr(null);
    const r = await fetch('/api/admin/stats');
    const j = await r.json();
    if (!j.status) setErr(j.error || 'Failed');
    else setData(j);
  };

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isAdmin) load();
  }, [status, session]);

  const toggleBan = async (email, banned) => {
    setBusy(email);
    await fetch('/api/admin/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, banned }),
    });
    await load();
    setBusy('');
  };

  if (status === 'loading') return <div className="container"><div className="card">Loading...</div></div>;
  if (!session) return (
    <div className="container"><div className="card pink">
      <h2>Admin login</h2><p>You need to sign in first.</p>
      <button className="btn" onClick={() => signIn('google', { callbackUrl: '/admin' })}>Sign in with Google</button>
    </div></div>
  );
  if (!session.user.isAdmin) return (
    <div className="container"><div className="card"><h2>Not authorized</h2><p>You are not the admin.</p><Link className="btn" href="/">Home</Link></div></div>
  );

  const s = data?.stats || { total: 0, success: 0, fail: 0, byPlatform: {} };
  const totalUsers = data?.totalUsers || 0;

  return (
    <div className="container">
      <nav className="nav">
        <div className="brand"><span className="logo">A</span> SnapLam Admin</div>
        <div className="nav-actions">
          <Link className="btn ghost" href="/">Home</Link>
          <span className="chip">{session.user.email}</span>
        </div>
      </nav>

      {err && <div className="notice err">{err}</div>}

      <div className="grid stats">
        <div className="stat" style={{ background: 'var(--pink)' }}>
          <div className="label">Total Users</div>
          <div className="value">{totalUsers}</div>
        </div>
        <div className="stat" style={{ background: 'var(--sky)' }}>
          <div className="label">Total Downloads</div>
          <div className="value">{s.total}</div>
        </div>
        <div className="stat" style={{ background: 'var(--mint)' }}>
          <div className="label">Success</div>
          <div className="value">{s.success}</div>
        </div>
        <div className="stat" style={{ background: '#ff9a9a' }}>
          <div className="label">Failed</div>
          <div className="value">{s.fail}</div>
        </div>
      </div>

      <div className="card lav">
        <h2>By Platform</h2>
        {['tiktok', 'instagram', 'youtube'].map((p) => (
          <span className="chip" key={p}>
            {p}: {Number(s.byPlatform?.[`${p}:success`] || 0)} ok / {Number(s.byPlatform?.[`${p}:fail`] || 0)} fail
          </span>
        ))}
      </div>

      <div className="card">
        <h2>Users</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Email</th><th>Name</th><th>Downloads</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {(data?.users || []).map((u) => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{u.name || '-'}</td>
                  <td>{u.downloads}</td>
                  <td>{u.banned ? <span className="badge banned">BANNED</span> : <span className="badge">Active</span>}</td>
                  <td>
                    {u.email === session.user.email ? <em>you</em> : (
                      <button
                        className={`btn ${u.banned ? 'mint' : 'danger'}`}
                        disabled={busy === u.email}
                        onClick={() => toggleBan(u.email, !u.banned)}
                      >
                        {u.banned ? 'Unban' : 'Ban'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!data?.users || data.users.length === 0) && (
                <tr><td colSpan={5}><em>No users yet.</em></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card sky">
        <h2>Recent Downloads</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Time</th><th>User</th><th>Platform</th><th>Status</th><th>URL</th></tr></thead>
            <tbody>
              {(data?.recent || []).map((r, i) => (
                <tr key={i}>
                  <td>{new Date(r.ts).toLocaleString()}</td>
                  <td>{r.email}</td>
                  <td>{r.platform}</td>
                  <td>{r.success ? <span className="badge">OK</span> : <span className="badge fail">FAIL</span>}</td>
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.url}>{r.url}</td>
                </tr>
              ))}
              {(!data?.recent || data.recent.length === 0) && (
                <tr><td colSpan={5}><em>No downloads yet.</em></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
    }
  
