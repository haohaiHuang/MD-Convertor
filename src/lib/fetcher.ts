import { Agent, fetch as undiciFetch } from "undici";
import type { LookupFunction } from "node:net";
import { AppError } from "@/lib/errors";
import { resolvePublicTarget } from "@/lib/security/url";
import { DESKTOP_USER_AGENT } from "@/lib/user-agent";

const MAX_REDIRECTS = 5;

type FetchResult = {
  buffer: Buffer;
  contentType: string;
  finalUrl: URL;
};

export function createPinnedLookup(address: string, family: 4 | 6): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };
}

function createPinnedAgent(address: string, family: 4 | 6): Agent {
  return new Agent({
    connect: {
      lookup: createPinnedLookup(address, family),
    },
  });
}

export async function readLimitedBody(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new AppError(413, "SOURCE_TOO_LARGE", "网页或图片超过允许的大小。");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function fetchPublicResource(
  input: string | URL,
  options: { signal: AbortSignal; maxBytes: number; accept: string },
): Promise<FetchResult> {
  let current = typeof input === "string" ? new URL(input) : input;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const target = await resolvePublicTarget(current);
    const dispatcher = createPinnedAgent(target.address, target.family);

    try {
      const response = await undiciFetch(target.url, {
        dispatcher,
        redirect: "manual",
        signal: options.signal,
        headers: {
          accept: options.accept,
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
          "user-agent": DESKTOP_USER_AGENT,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) {
          throw new AppError(502, "BAD_REDIRECT", "目标网页返回了无效的重定向。");
        }
        if (redirectCount === MAX_REDIRECTS) {
          throw new AppError(502, "TOO_MANY_REDIRECTS", "目标网页重定向次数过多。");
        }
        current = new URL(location, target.url);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new AppError(502, "UPSTREAM_STATUS", `目标网页返回了 HTTP ${response.status}。`);
      }

      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > options.maxBytes) {
        await response.body?.cancel();
        throw new AppError(413, "SOURCE_TOO_LARGE", "网页或图片超过允许的大小。");
      }

      return {
        buffer: await readLimitedBody(
          response.body as unknown as ReadableStream<Uint8Array> | null,
          options.maxBytes,
        ),
        contentType: response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "",
        finalUrl: target.url,
      };
    } finally {
      await dispatcher.close();
    }
  }

  throw new AppError(502, "TOO_MANY_REDIRECTS", "目标网页重定向次数过多。");
}

export async function fetchHtml(url: string, signal: AbortSignal): Promise<{ html: string; finalUrl: URL }> {
  const result = await fetchPublicResource(url, {
    signal,
    maxBytes: 5 * 1024 * 1024,
    accept: "text/html,application/xhtml+xml;q=0.9",
  });
  if (result.contentType && result.contentType !== "text/html" && result.contentType !== "application/xhtml+xml") {
    throw new AppError(422, "NON_HTML", "该链接不是可转换的 HTML 网页。");
  }
  return { html: result.buffer.toString("utf8"), finalUrl: result.finalUrl };
}
