
import Redis from "ioredis";
import { SessionData } from "../types/session";

const redisUrl = process.env.REDIS_URL;
let redis: any = null;

if (redisUrl) {
  redis = new (Redis as any)(redisUrl);
  console.log("ℹ️ [redis] connected");
} else {
  console.warn("⚠️ [redis] REDIS_URL not provided. Using in-memory fallback (dev only).");
}

const memoryStore: Record<string, SessionData> = {};
const ttl = parseInt(process.env.SESSION_TTL || "3600", 10);

export async function getSession(userId: string): Promise<SessionData> {
  if (!redis) return memoryStore[userId] || {};
  const raw = await redis.get(`session:${userId}`);
  return raw ? (JSON.parse(raw) as SessionData) : {};
}

export async function setSession(userId: string, session: SessionData): Promise<void> {
  if (!redis) { memoryStore[userId] = session; return; }
  await redis.set(`session:${userId}`, JSON.stringify(session), "EX", ttl);
}
