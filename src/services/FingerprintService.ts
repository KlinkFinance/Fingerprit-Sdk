import type { ApiClient } from '../client/ApiClient';
import type { RequestOptions, ApiSuccessResponse, PaginatedData } from '../types/common';
import type {
  GenerateFingerprintRequest,
  GenerateFingerprintData,
  GetFingerprintData,
  VisitorStats,
  ListFingerprintsParams,
  FingerprintRecord,
} from '../types/fingerprint';
import { BrowserCollector } from '../collectors/BrowserCollector';
import type { FraudDetector } from '../collectors/FraudDetector';
import { FingerprintBlockedError } from '../errors';

export class FingerprintService {
  private readonly basePath = '/api/fingerprint';

  constructor(
    private readonly client: ApiClient,
    private readonly defaultPublisherId?: string,
    private readonly fraudDetector?: FraudDetector,
  ) {}

  /**
   * Generate (or retrieve) a device fingerprint.
   *
   * For `platform: 'web'` in a browser environment the SDK automatically
   * collects all available device signals (userAgent, screen, WebGL, canvas,
   * timezone, storage flags, plugins, connection, etc.).
   *
   * Any field you pass explicitly overrides the auto-collected value, so you
   * can supplement or correct individual signals without losing the rest.
   *
   * For `platform: 'android' | 'ios'` you must supply `mobileInfo` manually
   * — those signals come from native device APIs unavailable in JavaScript.
   */
  async generate(
    request: GenerateFingerprintRequest,
    opts?: RequestOptions,
  ): Promise<GenerateFingerprintData> {
    // Auto-collect browser signals for web requests running in a browser.
    // Explicit fields in `request` take precedence over auto-collected values.
    const autoSignals =
      request.platform === 'web' && BrowserCollector.isAvailable()
        ? await BrowserCollector.collect()
        : {};

    const body: GenerateFingerprintRequest = {
      clickTimestamp: Date.now(), // auto-set; caller can override
      ...autoSignals,       // 1. auto-collected browser signals (lowest priority)
      ...request,           // 2. caller-supplied fields override auto-collected ones
      publisherId: request.publisherId ?? this.defaultPublisherId,
    };

    // Collect fraud signals and attach to request; hard-block before hitting the network
    if (this.fraudDetector) {
      try {
        const fraudSignals = await this.fraudDetector.collect();
        if (fraudSignals.hardBlock) {
          throw new FingerprintBlockedError(fraudSignals.flags, fraudSignals.riskScore);
        }
        body.fraudSignals = fraudSignals;
      } catch (err) {
        if (err instanceof FingerprintBlockedError) throw err;
        // FraudDetector failures are non-fatal — proceed without signals
      }
    }

    const headers: Record<string, string> = { ...opts?.headers };
    if (request.userId) {
      headers['X-User-Id'] = request.userId;
    }

    const response = await this.client.post<ApiSuccessResponse<GenerateFingerprintData>>(
      `${this.basePath}/generate`,
      body,
      { ...opts, headers },
    );

    return response.data;
  }

  /**
   * Retrieve a paginated list of all fingerprints.
   */
  async list(
    params: ListFingerprintsParams = {},
    opts?: RequestOptions,
  ): Promise<PaginatedData<FingerprintRecord>> {
    const response = await this.client.get<ApiSuccessResponse<PaginatedData<FingerprintRecord>>>(
      this.basePath,
      params as Record<string, unknown>,
      opts,
    );
    return response.data;
  }

  /**
   * Retrieve a single fingerprint record with its security summary.
   */
  async getOne(
    visitorId: string,
    opts?: RequestOptions,
  ): Promise<GetFingerprintData> {
    const response = await this.client.get<ApiSuccessResponse<GetFingerprintData>>(
      `${this.basePath}/${encodeURIComponent(visitorId)}`,
      undefined,
      opts,
    );
    return response.data;
  }

  /**
   * Retrieve aggregated visit statistics for a visitor.
   */
  async getStats(
    visitorId: string,
    opts?: RequestOptions,
  ): Promise<VisitorStats> {
    const response = await this.client.get<ApiSuccessResponse<VisitorStats>>(
      `${this.basePath}/${encodeURIComponent(visitorId)}/stats`,
      undefined,
      opts,
    );
    return response.data;
  }
}
