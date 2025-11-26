
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
const indexSet: Set<string> = new Set();
const ttl = parseInt(process.env.SESSION_TTL || "86400", 10);

function key(userId: string) { return `session:${userId}`; }
const INDEX_KEY = "sessions:index";

export async function listSessions(): Promise<string[]> {
  if (!redis) return Array.from(indexSet);
  const ids = await redis.smembers(INDEX_KEY);
  return ids || [];
}

export async function getSession(userId: string): Promise<SessionData> {
  if (!redis) return memoryStore[userId] || {};
  const raw = await redis.get(key(userId));
  return raw ? (JSON.parse(raw) as SessionData) : {};
}

export async function setSession(userId: string, session: SessionData): Promise<void> {
  if (!redis) {
    memoryStore[userId] = session;
    indexSet.add(userId);
    return;
  }
  await redis.set(key(userId), JSON.stringify(session), "EX", ttl);
  await redis.sadd(INDEX_KEY, userId);
}

export async function archiveSession(userId: string): Promise<void> {
  if (!redis) {
    delete memoryStore[userId];
    indexSet.delete(userId);
    return;
  }
  await redis.del(key(userId));
  await redis.srem(INDEX_KEY, userId);
}
