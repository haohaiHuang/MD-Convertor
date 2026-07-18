export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return new AppError(504, "CONVERSION_TIMEOUT", "转换超时，请稍后重试。");
  }
  return new AppError(502, "UPSTREAM_ERROR", "无法读取该网页，请确认网页可以公开访问。");
}
