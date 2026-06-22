import type { ApiClient } from '../client/ApiClient';
import type { RequestOptions, ApiSuccessResponse } from '../types/common';
import type { ValidateOfferRequest, ValidateOfferData } from '../types/offer';

export class OfferService {
  private readonly basePath = '/api/fingerprint';

  constructor(
    private readonly client: ApiClient,
    private readonly defaultPublisherId?: string,
  ) {}

  /**
   * Run the full 8-check offer fraud validation for a known visitor.
   *
   * Call this immediately before redirecting to an offer URL.
   * If `allowed` is false, do not redirect — display an error instead.
   */
  async validate(
    request: ValidateOfferRequest,
    opts?: RequestOptions,
  ): Promise<ValidateOfferData> {
    const body: ValidateOfferRequest = {
      publisherId: this.defaultPublisherId,
      clickTimestamp: Date.now(), // default to call time; caller can override
      ...request,
    };

    const response = await this.client.post<ApiSuccessResponse<ValidateOfferData>>(
      `${this.basePath}/validate-offer`,
      body,
      opts,
    );

    return response.data;
  }
}
