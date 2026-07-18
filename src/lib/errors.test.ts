import { describe, expect, it } from "vitest";
import { AppError, toAppError } from "./errors";

describe("toAppError", () => {
  it.each(["AbortError", "TimeoutError"])("maps %s to the timeout contract", (name) => {
    const error = new Error("aborted");
    error.name = name;
    expect(toAppError(error)).toMatchObject({
      status: 504,
      code: "CONVERSION_TIMEOUT",
    });
  });

  it("preserves an existing application error", () => {
    const error = new AppError(422, "NO_CONTENT", "没有正文");
    expect(toAppError(error)).toBe(error);
  });
});
