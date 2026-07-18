import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import ipaddr from "ipaddr.js";
import { AppError } from "@/lib/errors";

const MAX_URL_LENGTH = 2048;
const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

export type ResolvedTarget = {
  url: URL;
  address: string;
  family: 4 | 6;
};

export function isPublicIpAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

export function parsePublicHttpUrl(input: string): URL {
  if (!input || input.length > MAX_URL_LENGTH) {
    throw new AppError(400, "INVALID_URL", "请输入长度合理的网页链接。");
  }

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new AppError(400, "INVALID_URL", "请输入完整的 HTTP 或 HTTPS 网页链接。");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(400, "INVALID_PROTOCOL", "只支持 HTTP 或 HTTPS 网页链接。");
  }
  if (url.username || url.password) {
    throw new AppError(400, "URL_CREDENTIALS", "网页链接不能包含用户名或密码。");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new AppError(403, "PRIVATE_TARGET", "出于安全原因，不能访问本机或内网页面。");
  }

  return url;
}

export async function resolvePublicTarget(input: string | URL): Promise<ResolvedTarget> {
  const url = typeof input === "string" ? parsePublicHttpUrl(input) : parsePublicHttpUrl(input.toString());
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (ipaddr.isValid(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new AppError(403, "PRIVATE_TARGET", "出于安全原因，不能访问本机或内网页面。");
    }
    const parsed = ipaddr.parse(hostname);
    return { url, address: hostname, family: parsed.kind() === "ipv4" ? 4 : 6 };
  }

  let addresses: LookupAddress[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true }) as LookupAddress[];
  } catch {
    throw new AppError(502, "DNS_FAILED", "无法解析该网页的域名。");
  }

  if (addresses.length === 0 || addresses.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new AppError(403, "PRIVATE_TARGET", "出于安全原因，该域名不能解析到内网或保留地址。");
  }

  const selected = addresses[0];
  return { url, address: selected.address, family: selected.family as 4 | 6 };
}
