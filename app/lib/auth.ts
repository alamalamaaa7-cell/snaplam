import GoogleProvider from 'next-auth/providers/google';
import { store } from './store';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user?.email) return false;
      const banned = await store.isBanned(user.email);
      if (banned) return false;
      await store.upsertUser(user.email, user.name, user.image);
      return true;
    },
    async session({ session }) {
      if (session?.user?.email) {
        session.user.isAdmin = session.user.email === process.env.ADMIN_EMAIL;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};

export function isAdminEmail(email) {
  return email && email === process.env.ADMIN_EMAIL;
}

