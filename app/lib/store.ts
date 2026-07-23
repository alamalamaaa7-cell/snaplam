// Thin wrapper over Vercel KV with a fallback in-memory store for local dev.
// In production (Vercel), Vercel KV env vars are set and @vercel/kv is used.
import { kv as vercelKv } from '@vercel/kv';

let mem = { users: {}, banned: new Set(), stats: { total: 0, success: 0, fail: 0 }, byPlatform: {}, recent: [] };

const HAS_KV = !!process.env.KV_REST_API_URL;

export const store = {
  async upsertUser(email, name, image) {
    const key = `user:${email}`;
    if (HAS_KV) {
      const existing = (await vercelKv.hgetall(key)) || {};
      const now = Date.now();
      const data = {
        email,
        name: name || existing.name || '',
        image: image || existing.image || '',
        firstSeen: existing.firstSeen || now,
        lastSeen: now,
        downloads: Number(existing.downloads || 0),
      };
      await vercelKv.hset(key, data);
      await vercelKv.sadd('users:index', email);
    } else {
      const u = mem.users[email] || { email, downloads: 0, firstSeen: Date.now() };
      u.name = name; u.image = image; u.lastSeen = Date.now();
      mem.users[email] = u;
    }
  },

  async isBanned(email) {
    if (HAS_KV) return !!(await vercelKv.sismember('users:banned', email));
    return mem.banned.has(email);
  },

  async setBan(email, banned) {
    if (HAS_KV) {
      if (banned) await vercelKv.sadd('users:banned', email);
      else await vercelKv.srem('users:banned', email);
    } else {
      if (banned) mem.banned.add(email); else mem.banned.delete(email);
    }
  },

  async recordDownload({ email, platform, success, url, error }) {
    const ts = Date.now();
    if (HAS_KV) {
      await vercelKv.incr('stats:total');
      await vercelKv.incr(success ? 'stats:success' : 'stats:fail');
      await vercelKv.hincrby('stats:byPlatform', `${platform}:${success ? 'success' : 'fail'}`, 1);
      await vercelKv.hincrby(`user:${email}`, 'downloads', 1);
      const entry = JSON.stringify({ ts, email, platform, success, url, error: error || null });
      await vercelKv.lpush('recent', entry);
      await vercelKv.ltrim('recent', 0, 199);
    } else {
      mem.stats.total++;
      if (success) mem.stats.success++; else mem.stats.fail++;
      const k = `${platform}:${success ? 'success' : 'fail'}`;
      mem.byPlatform[k] = (mem.byPlatform[k] || 0) + 1;
      if (mem.users[email]) mem.users[email].downloads++;
      mem.recent.unshift({ ts, email, platform, success, url, error });
      mem.recent = mem.recent.slice(0, 200);
    }
  },

  async getStats() {
    if (HAS_KV) {
      const [total, success, fail, byPlatform] = await Promise.all([
        vercelKv.get('stats:total'),
        vercelKv.get('stats:success'),
        vercelKv.get('stats:fail'),
        vercelKv.hgetall('stats:byPlatform'),
      ]);
      return {
        total: Number(total || 0),
        success: Number(success || 0),
        fail: Number(fail || 0),
        byPlatform: byPlatform || {},
      };
    }
    return { ...mem.stats, byPlatform: mem.byPlatform };
  },

  async listUsers() {
    if (HAS_KV) {
      const emails = await vercelKv.smembers('users:index');
      if (!emails || emails.length === 0) return [];
      const users = await Promise.all(emails.map(async (e) => {
        const u = (await vercelKv.hgetall(`user:${e}`)) || {};
        const banned = await vercelKv.sismember('users:banned', e);
        return { ...u, email: e, banned: !!banned, downloads: Number(u.downloads || 0) };
      }));
      return users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    }
    return Object.values(mem.users).map((u) => ({ ...u, banned: mem.banned.has(u.email) }));
  },

  async recent(limit = 50) {
    if (HAS_KV) {
      const items = await vercelKv.lrange('recent', 0, limit - 1);
      return (items || []).map((s) => (typeof s === 'string' ? JSON.parse(s) : s));
    }
    return mem.recent.slice(0, limit);
  },
};
                        
