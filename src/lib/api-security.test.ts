import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_TOKEN_HEADER, validateConvertApiCaller } from "./api-security";

const localUrl = "http://127.0.0.1:3210/api/convert";

function request(headers: Record<string, string> = {}): Request {
  return new Request(localUrl, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("local conversion API caller validation", () => {
  it("accepts the application session token on a same-origin request", () => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "test-session-token");
    expect(() => validateConvertApiCaller(request({
      origin: "http://127.0.0.1:3210",
      "sec-fetch-site": "same-origin",
      [SESSION_TOKEN_HEADER]: "test-session-token",
    }))).not.toThrow();
  });

  it("accepts equivalent loopback hostnames on the same local port", () => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "test-session-token");
    expect(() => validateConvertApiCaller(request({
      host: "localhost:3210",
      origin: "http://localhost:3210",
      [SESSION_TOKEN_HEADER]: "test-session-token",
    }))).not.toThrow();
  });

  it.each([
    [{ origin: "https://attacker.example", [SESSION_TOKEN_HEADER]: "test-session-token" }, "INVALID_API_ORIGIN"],
    [{ origin: "http://127.0.0.1:3210" }, "INVALID_SESSION_TOKEN"],
    [{ origin: "http://127.0.0.1:3210", [SESSION_TOKEN_HEADER]: "wrong-token" }, "INVALID_SESSION_TOKEN"],
    [{ "content-type": "text/plain", [SESSION_TOKEN_HEADER]: "test-session-token" }, "INVALID_CONTENT_TYPE"],
    [{ host: "attacker.example", [SESSION_TOKEN_HEADER]: "test-session-token" }, "INVALID_API_HOST"],
  ])("rejects an invalid caller", (headers, code) => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "test-session-token");
    expect(() => validateConvertApiCaller(request(headers))).toThrowError(
      expect.objectContaining({ code }),
    );
  });

  it("fails closed without a session token in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "");
    expect(() => validateConvertApiCaller(request())).toThrowError(
      expect.objectContaining({ code: "API_SESSION_UNAVAILABLE" }),
    );
  });
});
