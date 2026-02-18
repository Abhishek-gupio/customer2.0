/**
 * Application error with HTTP status and optional code for clients.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code?: string) {
    return new AppError(message, 400, code ?? "BAD_REQUEST");
  }

  static unauthorized(message: string = "Unauthorized", code?: string) {
    return new AppError(message, 401, code ?? "UNAUTHORIZED");
  }

  static forbidden(message: string = "Forbidden", code?: string) {
    return new AppError(message, 403, code ?? "FORBIDDEN");
  }

  static notFound(message: string = "Not found", code?: string) {
    return new AppError(message, 404, code ?? "NOT_FOUND");
  }

  static conflict(message: string, code?: string) {
    return new AppError(message, 409, code ?? "CONFLICT");
  }

  static tooManyRequests(message: string = "Too many requests", code?: string) {
    return new AppError(message, 429, code ?? "RATE_LIMIT");
  }

  static internal(message: string = "Internal server error", code?: string) {
    return new AppError(message, 500, code ?? "INTERNAL_ERROR");
  }
}
