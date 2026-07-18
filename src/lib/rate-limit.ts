import { AppError } from "@/lib/errors";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_ACTIVE_PER_IP = 2;
const MAX_ACTIVE_GLOBAL = 4;

type ClientState = {
  timestamps: number[];
  active: number;
};

const clients = new Map<string, ClientState>();
let globalActive = 0;

export function acquireConversionSlot(ip: string): () => void {
  const now = Date.now();
  const state = clients.get(ip) ?? { timestamps: [], active: 0 };
  state.timestamps = state.timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (state.timestamps.length >= MAX_REQUESTS_PER_WINDOW || state.active >= MAX_ACTIVE_PER_IP) {
    throw new AppError(429, "RATE_LIMITED", "请求过于频繁，请稍后再试。");
  }
  if (globalActive >= MAX_ACTIVE_GLOBAL) {
    throw new AppError(429, "SERVER_BUSY", "当前转换任务较多，请稍后再试。");
  }

  state.timestamps.push(now);
  state.active += 1;
  globalActive += 1;
  clients.set(ip, state);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    state.active = Math.max(0, state.active - 1);
    globalActive = Math.max(0, globalActive - 1);
    if (state.active === 0 && state.timestamps.every((timestamp) => Date.now() - timestamp >= WINDOW_MS)) {
      clients.delete(ip);
    }
  };
}

export function clientIpFromHeaders(headers: Headers): string {
  if (process.env.TRUST_PROXY === "1") {
    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
    const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
    if (forwarded) return forwarded;
  }
  return "direct-client";
}
