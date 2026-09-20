import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import ipaddr from "ipaddr.js";
import { AppError } from "@/lib/errors";

/**
 * Provider endpoint policy — deliberately independent from the public-web scrape
 * policy in `src/lib/security/url.ts`:
 *
 * - Web scraping must reach public unicast hosts only (`isPublicIpAddress`).
 * - A Provider endpoint is configured by the user and legitimately lives on the
 *   same machine or on the local network (Ollama, LM Studio, LiteLLM, an
 *   enterprise gateway), so loopback, private, unique-local and carrier-grade
 *   NAT addresses stay reachable.
 *
 * The two implementations must not be merged nor relaxed: sharing the scrape
 * policy would break local Providers, and reusing this permissive policy for
 * scraping would open SSRF holes. Cloud metadata endpoints and unusable
 * addresses stay blocked on both sides.
 */

const MAX_PROVIDER_URL_LENGTH = 2048;
export const MAX_PROVIDER_REDIRECTS = 3;

const ALLOWED_PROVIDER_RANGES = new Set(["unicast", "loopback", "private", "uniqueLocal", "carrierGradeNat"]);

/**
 * Metadata services that stay blocked even though their range would be allowed
 * (CGNAT and unique-local are legitimate for local Providers, but these exact
 * addresses serve credentials).
 */
const BLOCKED_PROVIDER_ADDRESSES = new Set(
  ["169.254.169.254", "fd00:ec2::254", "100.100.100.200"].map((address) =>
    ipaddr.parse(address).toNormalizedString(),
  ),
);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type ProviderLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<LookupAddress[]>;

export type ProviderFetch = (input: URL, init: RequestInit) => Promise<Response>;

export type ProviderEndpointDeps = {
  lookup?: ProviderLookup;
  fetch?: ProviderFetch;
};

export function isAllowedProviderAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }
    if (BLOCKED_PROVIDER_ADDRESSES.has(parsed.toNormalizedString())) {
      return false;
    }
    return ALLOWED_PROVIDER_RANGES.has(parsed.range());
  } catch {
    return false;
  }
}

export function parseProviderUrl(input: string): URL {
  const value = input?.trim() ?? "";
  if (!value || value.length > MAX_PROVIDER_URL_LENGTH) {
    throw new AppError(400, "INVALID_PROVIDER_URL", "请输入长度合理的 Provider 地址。");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, "INVALID_PROVIDER_URL", "请输入完整的 http(s) Provider 地址。");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(400, "INVALID_PROVIDER_URL", "Provider 地址只支持 http 或 https。");
  }

  if (url.username || url.password) {
    throw new AppError(400, "PROVIDER_URL_CREDENTIALS", "Provider 地址不能包含用户名或密码。");
  }

  return url;
}

export async function resolveProviderTarget(
  input: string | URL,
  deps: ProviderEndpointDeps = {},
): Promise<{ url: URL; address: string; family: 4 | 6 }> {
  const url = typeof input === "string" ? parseProviderUrl(input) : input;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (ipaddr.isValid(hostname)) {
    if (!isAllowedProviderAddress(hostname)) {
      throw blockedTarget(url.hostname);
    }
    return { url, address: hostname, family: ipaddr.parse(hostname).kind() === "ipv4" ? 4 : 6 };
  }

  const lookup: ProviderLookup = deps.lookup ?? (dnsLookup as ProviderLookup);
  let addresses: LookupAddress[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", `无法解析 Provider 主机 ${url.hostname}。`);
  }

  if (addresses.length === 0 || addresses.some((entry) => !isAllowedProviderAddress(entry.address))) {
    throw blockedTarget(url.hostname);
  }

  return { url, address: addresses[0].address, family: addresses[0].family as 4 | 6 };
}

/** Fetches a Provider endpoint, following same-host, same-scheme redirects only. */
export async function fetchProviderEndpoint(
  url: URL,
  init: RequestInit = {},
  deps: ProviderEndpointDeps = {},
): Promise<Response> {
  const fetchImpl = deps.fetch ?? fetch;
  let current = url;

  for (let hop = 0; ; hop += 1) {
    await resolveProviderTarget(current, deps);
    const response = await fetchImpl(current, { ...init, redirect: "manual" });
    const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get("location") : null;
    if (!location) {
      return response;
    }
    if (hop >= MAX_PROVIDER_REDIRECTS) {
      throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", "Provider 重定向次数过多。");
    }

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", "Provider 返回了无效的重定向地址。");
    }
    if (next.protocol !== current.protocol || next.host !== current.host) {
      throw new AppError(
        502,
        "TRANSLATE_PROVIDER_ERROR",
        `Provider 不允许跨主机重定向（${current.host} → ${next.host}）。`,
      );
    }
    current = next;
  }
}

function blockedTarget(hostname: string): AppError {
  return new AppError(403, "PROVIDER_TARGET_BLOCKED", `出于安全原因，Provider 不能指向 ${hostname}。`);
}
