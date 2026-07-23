import { kv } from "@vercel/kv"

export const store = {
  async get(key: string) {
    return await kv.get(key)
  },
  async set(key: string, value: any) {
    return await kv.set(key, value)
  }
}
