import type { ApiClient } from '../client/ApiClient';
import type { RequestOptions } from '../types/common';
import type { HealthData, StatusData, ReadinessData, LivenessData } from '../types/status';

export class StatusService {
  constructor(private readonly client: ApiClient) {}

  /** Basic health check – fast, no DB dependency */
  async health(opts?: RequestOptions): Promise<HealthData> {
    return this.client.get<HealthData>('/health', undefined, opts);
  }

  /** Detailed status including DB connectivity and memory usage */
  async status(opts?: RequestOptions): Promise<StatusData> {
    return this.client.get<StatusData>('/status', undefined, opts);
  }

  /** Returns 200 when the service is ready to handle traffic (DB connected) */
  async ready(opts?: RequestOptions): Promise<ReadinessData> {
    return this.client.get<ReadinessData>('/ready', undefined, opts);
  }

  /** Kubernetes liveness probe – always returns 200 if the process is alive */
  async live(opts?: RequestOptions): Promise<LivenessData> {
    return this.client.get<LivenessData>('/live', undefined, opts);
  }

  /**
   * Returns true if the API is reachable and the database is connected.
   * Suitable for pre-flight checks in application startup.
   */
  async isReady(): Promise<boolean> {
    try {
      const result = await this.ready({ noRetry: true });
      return result.success;
    } catch {
      return false;
    }
  }
}
