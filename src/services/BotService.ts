import type { ApiClient } from '../client/ApiClient';
import type { RequestOptions, ApiSuccessResponse } from '../types/common';
import type { AnalyzeBotData } from '../types/bot';

export class BotService {
  private readonly basePath = '/api/fingerprint';

  constructor(private readonly client: ApiClient) {}

  /**
   * Perform a standalone bot/automation analysis of the current request.
   *
   * Useful when you want bot signals without generating a full fingerprint.
   * The server inspects the forwarded request headers for automation indicators.
   */
  async analyze(
    opts?: RequestOptions,
  ): Promise<AnalyzeBotData> {
    const response = await this.client.post<ApiSuccessResponse<AnalyzeBotData>>(
      `${this.basePath}/analyze-bot`,
      {},
      opts,
    );

    return response.data;
  }
}
