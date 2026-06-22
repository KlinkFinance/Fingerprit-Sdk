import { ApiClient } from './client/ApiClient';
import { BotService } from './services/BotService';
import { FingerprintService } from './services/FingerprintService';
import { FraudService } from './services/FraudService';
import { OfferService } from './services/OfferService';
import { StatusService } from './services/StatusService';
import { TokenService } from './services/TokenService';
import { FingerprintConfigError } from './errors';
import { FraudDetector } from './collectors/FraudDetector';
import type { FingerprintSDKConfig } from './types/common';

/**
 * Klink Finance Fingerprint SDK
 *
 * Single integration point for device fingerprinting, bot detection,
 * VPN detection, and offer fraud validation.
 *
 * @example
 * ```ts
 * const sdk = new FingerprintSDK({
 *   baseUrl: 'https://fingerprint.klinkfinance.com',
 *   apiKey: process.env.KLINK_API_KEY,
 *   defaultPublisherId: 'pub-123',
 * });
 *
 * const result = await sdk.fingerprint.generate({ platform: 'web', ...deviceSignals });
 * const { visitorId, visitorToken, botDetection, offerValidation } = result;
 * ```
 */
export class FingerprintSDK {
  /** Fingerprint generation and retrieval */
  readonly fingerprint: FingerprintService;
  /** Client-side fraud detection and signal reporting */
  readonly fraud: FraudService;
  /** Offer fraud validation */
  readonly offers: OfferService;
  /** Standalone bot/automation analysis */
  readonly bot: BotService;
  /** Visitor token verification */
  readonly tokens: TokenService;
  /** API health and readiness checks */
  readonly status: StatusService;

  private readonly client: ApiClient;
  private readonly config: FingerprintSDKConfig;

  constructor(config: FingerprintSDKConfig) {
    this.validateConfig(config);
    this.config = config;

    this.client = new ApiClient(config);

    // FraudDetector starts collecting immediately in browser environments
    const fraudDetector = typeof window !== 'undefined' ? new FraudDetector() : undefined;

    this.fingerprint = new FingerprintService(this.client, config.defaultPublisherId, fraudDetector);
    this.fraud = new FraudService(this.client, fraudDetector);
    this.offers = new OfferService(this.client, config.defaultPublisherId);
    this.bot = new BotService(this.client);
    this.tokens = new TokenService(this.client);
    this.status = new StatusService(this.client);
  }

  private validateConfig(config: FingerprintSDKConfig): void {
    if (!config.baseUrl || typeof config.baseUrl !== 'string') {
      throw new FingerprintConfigError('baseUrl is required and must be a string');
    }
    try {
      new URL(config.baseUrl);
    } catch {
      throw new FingerprintConfigError(`baseUrl is not a valid URL: "${config.baseUrl}"`);
    }
    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      throw new FingerprintConfigError('timeout must be a positive number in milliseconds');
    }
    if (config.retries !== undefined && (typeof config.retries !== 'number' || config.retries < 0)) {
      throw new FingerprintConfigError('retries must be a non-negative integer');
    }
  }

  /**
   * Create an SDK instance and verify the API is reachable before returning.
   * Throws if the health check fails.
   *
   * Prefer this factory in server-side or startup code where you want an
   * early failure if the Fingerprint API is unavailable.
   */
  static async create(config: FingerprintSDKConfig): Promise<FingerprintSDK> {
    const sdk = new FingerprintSDK(config);
    const ready = await sdk.status.isReady();
    if (!ready) {
      throw new FingerprintConfigError(
        `Fingerprint API at "${config.baseUrl}" is not ready. Check the baseUrl and network connectivity.`,
      );
    }
    return sdk;
  }

  /** Returns the resolved configuration (useful for debugging) */
  getConfig(): Readonly<FingerprintSDKConfig> {
    return Object.freeze({ ...this.config });
  }
}
