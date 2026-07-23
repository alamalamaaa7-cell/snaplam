import { getServerSession } from "next-auth"
import { authOptions, isAdminEmail } from "../../../../lib/auth"
import { store } from "../../../../lib/store"

export async function POST(req) {
  const session = await getServerSession(authOptions)
  
  if (!session || !isAdminEmail(session.user.email)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, banned } = await req.json()

  if (!email) {
    return Response.json({ error: "Email required" }, { status: 400 })
  }

  await store.setBan(email, banned)

  return Response.json({ success: true, email, banned })
}
