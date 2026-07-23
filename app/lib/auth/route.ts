import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function isAdmin(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return false
  return session.user.email === process.env.ADMIN_EMAIL
    }
