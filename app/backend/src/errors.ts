export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly retryable = false) {
    super(message);
  }
}
export function invariant(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new ApiError(code, 409, message);
}
