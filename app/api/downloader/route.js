import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { store } from '../../../lib/store';

export const dynamic = 'force-dynamic';

const JEREXD_KEY = process.env.JEREXD_APIKEY || 'jere_37GRMq_6Z9Nb';

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return null;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, cache: 'no-store' });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: false, status: res.status, data: { raw: text } }; }
}

async function handleTikTok(url) {
  // v2 works, v1 fallback
  const v2 = await fetchJson(`https://api-nanzz.my.id/docs/api/downloader/tiktokv2.php?url=${encodeURIComponent(url)}`);
  if (v2.ok && v2.data?.status && v2.data?.result?.video_tanpa_watermark) {
    const r = v2.data.result;
    return {
      title: r.caption || 'TikTok Video',
      author: r.author || '',
      thumbnail: r.thumbnail || '',
      files: [
        { label: 'Video (No Watermark)', type: 'video', url: r.video_tanpa_watermark },
        r.audio_mp3 ? { label: 'Audio MP3', type: 'audio', url: r.audio_mp3 } : null,
      ].filter(Boolean),
    };
  }
  const v1 = await fetchJson(`https://api-nanzz.my.id/docs/api/downloader/tiktok.php?url=${encodeURIComponent(url)}`);
  if (v1.ok && v1.data?.status && v1.data?.result?.downloads?.length) {
    const r = v1.data.result;
    return {
      title: r.title || 'TikTok Video',
      thumbnail: r.thumbnail || '',
      files: r.downloads.map((d) => ({ label: d.quality || d.type || 'Download', type: 'video', url: d.url })),
    };
  }
  throw new Error('TikTok API returned no results');
}

async function handleInstagram(url) {
  const res = await fetchJson(`https://api.jerexd.my.id/api/downloader/instagram?apikey=${JEREXD_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok || !res.data?.status) throw new Error(res.data?.error || 'Instagram API error');
  const urls = res.data.result?.urls || [];
  return {
    title: 'Instagram Media',
    files: urls.map((u, i) => ({ label: `Media ${i + 1}`, type: u.includes('.mp4') ? 'video' : 'image', url: u })),
  };
}

async function handleYouTube(url) {
  // v2 first then v1
  for (const ep of ['ytmp4v2', 'ytmp4']) {
    const res = await fetchJson(`https://api.jerexd.my.id/api/downloader/${ep}?apikey=${JEREXD_KEY}&url=${encodeURIComponent(url)}`);
    if (res.ok && res.data?.status) {
      const r = res.data.result || {};
      const files = [];
      if (r.download || r.url) files.push({ label: r.quality || 'MP4', type: 'video', url: r.download || r.url });
      if (Array.isArray(r.urls)) r.urls.forEach((u, i) => files.push({ label: `MP4 ${i + 1}`, type: 'video', url: u }));
      if (Array.isArray(r.formats)) r.formats.forEach((f) => files.push({ label: f.quality || f.label || 'MP4', type: 'video', url: f.url }));
      if (files.length === 0 && typeof r === 'string') files.push({ label: 'MP4', type: 'video', url: r });
      return {
        title: r.title || 'YouTube Video',
        thumbnail: r.thumbnail || r.thumb || '',
        files,
      };
    }
  }
  throw new Error('YouTube API is currently unreachable (upstream 500). Try again later.');
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ status: false, error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }
  const email = session.user.email;
  if (await store.isBanned(email)) {
    return Response.json({ status: false, error: 'Your account is banned.' }, { status: 403 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ status: false, error: 'Invalid JSON' }, { status: 400 }); }
  const url = (body?.url || '').trim();
  if (!url) return Response.json({ status: false, error: 'URL is required' }, { status: 400 });

  const platform = detectPlatform(url);
  if (!platform) {
    await store.recordDownload({ email, platform: 'unknown', success: false, url, error: 'Unsupported URL' });
    return Response.json({ status: false, error: 'Unsupported URL. Use TikTok, Instagram, or YouTube.' }, { status: 400 });
  }

  try {
    const result =
      platform === 'tiktok' ? await handleTikTok(url) :
      platform === 'instagram' ? await handleInstagram(url) :
      await handleYouTube(url);
    await store.recordDownload({ email, platform, success: true, url });
    return Response.json({ status: true, platform, result });
  } catch (e) {
    await store.recordDownload({ email, platform, success: false, url, error: String(e.message || e) });
    return Response.json({ status: false, platform, error: String(e.message || e) }, { status: 502 });
  }
                 }
                         
