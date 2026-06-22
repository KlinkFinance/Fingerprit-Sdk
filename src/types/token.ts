export interface VerifyTokenRequest {
  visitorId: string;
  /** HMAC-SHA256 hex signature (from visitorToken.sig) */
  sig: string;
  /** Unix timestamp in ms (from visitorToken.ts) */
  ts: number;
  userId?: string;
}

export interface VerifyTokenData {
  valid: boolean;
  visitorId?: string;
  reason?: string;
}
