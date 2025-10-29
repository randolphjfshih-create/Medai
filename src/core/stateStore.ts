import Redis from "ioredis";
import { SessionData } from "../types/session";
import { logInfo, logWarn } from "../utils/logger";

const redisUrl = process.env.REDIS_URL;
let redis: Redis | null = null;

if (redisUrl) {
  redis = new Redis(redisUrl);
  logInfo("redis", "connected");
} else {
  logWarn("redis", "REDIS_URL not provided. Using in-memory fallback (dev only).");
}

const memoryStore: Record<string, SessionData> = {};

export async function getSession(userId: string): Promise<SessionData> {
  if (!redis) {
    return memoryStore[userId] || {};
  }
  const raw = await redis.get(`session:${userId}`);
  return raw ? (JSON.parse(raw) as SessionData) : {};
}

export async function setSession(userId: string, session: SessionData): Promise<void> {
  if (!redis) {
    memoryStore[userId] = session;
    return;
  }
  await redis.set(`session:${userId}`, JSON.stringify(session), "EX", 3600);
}
