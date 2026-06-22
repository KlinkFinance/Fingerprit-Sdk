import type { ApiClient } from '../client/ApiClient';
import type { RequestOptions, ApiSuccessResponse } from '../types/common';
import type { FraudSignalBundle } from '../types/fraud';
import type { FraudDetector } from '../collectors/FraudDetector';

export class FraudService {
  constructor(
    private readonly client: ApiClient,
    private readonly detector?: FraudDetector,
  ) {}

  /** Collect signals and POST them to /api/fraud/signals. Returns the bundle sent. */
  async report(opts?: RequestOptions): Promise<FraudSignalBundle | null> {
    if (!this.detector) return null;
    const bundle = await this.detector.collect();
    await this.client.post<ApiSuccessResponse<void>>('/api/fraud/signals', bundle, opts);
    return bundle;
  }

  /** Collect and return the current signal bundle without sending to server. */
  async getSignals(): Promise<FraudSignalBundle | null> {
    if (!this.detector) return null;
    return this.detector.collect();
  }

  /** Remove all event listeners attached by the fraud detector. */
  destroy(): void {
    this.detector?.destroy();
  }
}
