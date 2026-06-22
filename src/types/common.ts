export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  statusCode?: number;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  fingerprints: T[];
  pagination: PaginationMeta;
}

export interface FingerprintSDKConfig {
  /** Base URL of the Fingerprint API (e.g. https://fingerprint.klinkfinance.com) */
  baseUrl: string;
  /** Optional API key sent as X-API-Key header for authenticated requests */
  apiKey?: string;
  /** Request timeout in milliseconds. Default: 10000 */
  timeout?: number;
  /** Number of retry attempts on transient failures. Default: 3 */
  retries?: number;
  /** Base delay in ms between retries (doubles each attempt). Default: 500 */
  retryDelay?: number;
  /** Enable verbose debug logging. Default: false */
  debug?: boolean;
  /** Default publisher ID auto-attached to all requests */
  defaultPublisherId?: string;
  /** Custom headers applied to every request */
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions {
  /** Override timeout for this specific request */
  timeout?: number;
  /** Additional headers for this request */
  headers?: Record<string, string>;
  /** Disable retry for this specific request */
  noRetry?: boolean;
}
