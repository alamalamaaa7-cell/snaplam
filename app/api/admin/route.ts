import { getServerSession } from "next-auth"
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isAdmin } from '@/lib/auth'
import { store } from '@/lib/store'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session || !await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, banned } = await req.json()
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  await store.set(`ban:${email}`, banned)
  return NextResponse.json({ success: true, email, banned })
}
