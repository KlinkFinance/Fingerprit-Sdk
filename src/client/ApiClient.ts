import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  isAxiosError,
} from 'axios';
import {
  FingerprintAPIError,
  FingerprintAuthError,
  FingerprintNetworkError,
  FingerprintTimeoutError,
  FingerprintValidationError,
} from '../errors';
import type { FingerprintSDKConfig, RequestOptions } from '../types/common';

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoff(attempt: number, baseDelay: number): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  // Add ±20% jitter to prevent thundering-herd on rate-limit windows
  const jitter = exponential * 0.2 * (Math.random() * 2 - 1);
  return Math.min(exponential + jitter, 30_000);
}

export class ApiClient {
  private readonly http: AxiosInstance;
  private readonly config: Required<
    Pick<FingerprintSDKConfig, 'timeout' | 'retries' | 'retryDelay' | 'debug'>
  > &
    FingerprintSDKConfig;

  constructor(sdkConfig: FingerprintSDKConfig) {
    this.config = {
      timeout: DEFAULT_TIMEOUT,
      retries: DEFAULT_RETRIES,
      retryDelay: DEFAULT_RETRY_DELAY,
      debug: false,
      ...sdkConfig,
    };

    this.http = axios.create({
      baseURL: sdkConfig.baseUrl.replace(/\/$/, ''),
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': `@klinkfinance/fingerprint-sdk/1.0.0`,
        ...(sdkConfig.apiKey ? { 'X-API-Key': sdkConfig.apiKey } : {}),
        ...sdkConfig.defaultHeaders,
      },
    });

    this.attachRequestInterceptor();
    this.attachResponseInterceptor();
  }

  private attachRequestInterceptor(): void {
    this.http.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.config.debug) {
          console.debug(
            `[FingerprintSDK] → ${config.method?.toUpperCase()} ${config.url}`,
            config.data ? JSON.stringify(config.data).slice(0, 200) : '',
          );
        }
        return config;
      },
      (error: unknown) => Promise.reject(error),
    );
  }

  private attachResponseInterceptor(): void {
    this.http.interceptors.response.use(
      (response: AxiosResponse) => {
        if (this.config.debug) {
          console.debug(
            `[FingerprintSDK] ← ${response.status} ${response.config.url}`,
          );
        }
        return response;
      },
      (error: unknown) => Promise.reject(error),
    );
  }

  private normalizeError(error: unknown): never {
    if (isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new FingerprintTimeoutError(this.config.timeout);
      }
      if (!error.response) {
        throw new FingerprintNetworkError(
          error.message || 'Network request failed',
          error as Error,
        );
      }

      const { status, data } = error.response;
      const message: string =
        (data as { error?: string; message?: string })?.error ||
        (data as { error?: string; message?: string })?.message ||
        error.message ||
        `Request failed with status ${status}`;

      if (status === 401 || status === 403) {
        throw new FingerprintAuthError(message, status);
      }
      if (status === 400) {
        throw new FingerprintValidationError(message, data);
      }
      throw new FingerprintAPIError(message, status, data);
    }

    throw new FingerprintNetworkError(
      error instanceof Error ? error.message : 'Unknown error',
    );
  }

  private shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.config.retries) return false;
    if (isAxiosError(error)) {
      if (!error.response) return true; // network error
      return RETRYABLE_STATUS_CODES.has(error.response.status);
    }
    return false;
  }

  private async executeWithRetry<T>(
    fn: () => Promise<AxiosResponse<T>>,
    opts: RequestOptions = {},
  ): Promise<T> {
    const maxAttempts = opts.noRetry ? 1 : this.config.retries + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fn();
        return response.data;
      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error, attempt)) break;

        const delay = computeBackoff(attempt, this.config.retryDelay);
        if (this.config.debug) {
          console.debug(
            `[FingerprintSDK] Retry ${attempt + 1}/${this.config.retries} in ${Math.round(delay)}ms`,
          );
        }
        await sleep(delay);
      }
    }

    this.normalizeError(lastError);
  }

  private buildConfig(opts: RequestOptions = {}): AxiosRequestConfig {
    return {
      timeout: opts.timeout ?? this.config.timeout,
      headers: opts.headers,
    };
  }

  async get<T>(path: string, params?: Record<string, unknown>, opts: RequestOptions = {}): Promise<T> {
    return this.executeWithRetry<T>(
      () => this.http.get<T>(path, { ...this.buildConfig(opts), params }),
      opts,
    );
  }

  async post<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.executeWithRetry<T>(
      () => this.http.post<T>(path, body, this.buildConfig(opts)),
      opts,
    );
  }

  async put<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.executeWithRetry<T>(
      () => this.http.put<T>(path, body, this.buildConfig(opts)),
      opts,
    );
  }

  async delete<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.executeWithRetry<T>(
      () => this.http.delete<T>(path, this.buildConfig(opts)),
      opts,
    );
  }
}
