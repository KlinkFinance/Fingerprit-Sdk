export class FingerprintSDKError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'FingerprintSDKError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** API returned a non-2xx response */
export class FingerprintAPIError extends FingerprintSDKError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: unknown,
  ) {
    super(message, 'API_ERROR');
    this.name = 'FingerprintAPIError';
  }
}

/** Network connectivity failure */
export class FingerprintNetworkError extends FingerprintSDKError {
  constructor(message: string, public readonly cause?: Error) {
    super(message, 'NETWORK_ERROR');
    this.name = 'FingerprintNetworkError';
  }
}

/** Request exceeded the configured timeout */
export class FingerprintTimeoutError extends FingerprintSDKError {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR');
    this.name = 'FingerprintTimeoutError';
  }
}

/** Authentication/authorization failure (401 / 403) */
export class FingerprintAuthError extends FingerprintSDKError {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403,
    public readonly responseBody?: unknown,
  ) {
    super(message, 'AUTH_ERROR');
    this.name = 'FingerprintAuthError';
  }
}

/** Invalid SDK configuration */
export class FingerprintConfigError extends FingerprintSDKError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'FingerprintConfigError';
  }
}

/** Client-side fraud detection hard-blocked the request before it was sent */
export class FingerprintBlockedError extends FingerprintSDKError {
  constructor(
    public readonly flags: string[],
    public readonly riskScore: number,
  ) {
    super('Request blocked by client-side fraud detection', 'BLOCKED_ERROR');
    this.name = 'FingerprintBlockedError';
  }
}

/** Request payload failed validation */
export class FingerprintValidationError extends FingerprintSDKError {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly responseBody?: unknown,
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'FingerprintValidationError';
  }
}
