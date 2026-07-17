export class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL_ERROR", details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { status: 400, code: "INVALID_REQUEST", details });
  }
}

export class NotFoundError extends AppError {
  constructor(message, details) {
    super(message, { status: 404, code: "NOT_FOUND", details });
  }
}

export class UpstreamError extends AppError {
  constructor(message, details) {
    super(message, { status: 502, code: "UPSTREAM_ERROR", details });
  }
}

