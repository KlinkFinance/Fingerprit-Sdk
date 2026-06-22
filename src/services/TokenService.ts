import type { ApiClient } from '../client/ApiClient';
import type { RequestOptions, ApiSuccessResponse } from '../types/common';
import type { VerifyTokenRequest, VerifyTokenData } from '../types/token';
import type { VisitorToken } from '../types/fingerprint';

export class TokenService {
  private readonly basePath = '/api/fingerprint';

  constructor(private readonly client: ApiClient) {}

  /**
   * Verify the HMAC-signed visitorToken returned by `fingerprint.generate()`.
   *
   * Use this on your server before processing conversion/redirect events.
   * Pass the fields from the `visitorToken` object directly.
   */
  async verify(
    request: VerifyTokenRequest,
    opts?: RequestOptions,
  ): Promise<VerifyTokenData> {
    const response = await this.client.post<
      ApiSuccessResponse<VerifyTokenData> & { valid: boolean; reason?: string }
    >(
      `${this.basePath}/verify-token`,
      request,
      opts,
    );

    // The backend returns `{ success, valid, visitorId?, reason? }` at the top level
    const raw = response as unknown as {
      success: boolean;
      valid: boolean;
      visitorId?: string;
      reason?: string;
      data?: VerifyTokenData;
    };

    return {
      valid: raw.valid ?? raw.data?.valid ?? false,
      visitorId: raw.visitorId ?? raw.data?.visitorId,
      reason: raw.reason ?? raw.data?.reason,
    };
  }

  /**
   * Convenience helper: verify a VisitorToken object directly.
   */
  async verifyToken(
    token: VisitorToken,
    opts?: RequestOptions,
  ): Promise<VerifyTokenData> {
    return this.verify(
      {
        visitorId: token.visitorId,
        sig: token.sig,
        ts: token.ts,
        userId: token.userId,
      },
      opts,
    );
  }
}
