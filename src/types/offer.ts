export type OfferAction = 'ALLOW' | 'REVIEW' | 'BLOCK';

export interface OfferCheck {
  score: number;
  passed: boolean;
  signals: string[];
}

export interface OfferChecks {
  velocityCheck: OfferCheck;
  deviceTrustCheck: OfferCheck;
  networkRiskCheck: OfferCheck;
  clickInjectionCheck: OfferCheck;
  geoSignalCheck: OfferCheck;
  behavioralCheck: OfferCheck;
  duplicateDeviceCheck: OfferCheck;
  installIntegrityCheck: OfferCheck;
}

export interface OfferValidationMeta {
  offerId?: string;
  publisherId?: string;
  evaluatedAt: string;
}

export interface OfferValidationResult {
  allowed: boolean;
  action: OfferAction;
  /** 0–100: higher = riskier */
  overallRiskScore: number;
  checks: OfferChecks;
  blockReasons: string[];
  riskFactors: string[];
  fraudScore?: number;
  botScore?: number;
  recommendation?: OfferAction;
  meta?: OfferValidationMeta;
}

export interface ValidateOfferRequest {
  visitorId: string;
  /** Unix timestamp (ms) of the click event */
  clickTimestamp?: number;
  offerId?: string;
  publisherId?: string;
}

export interface ValidateOfferData extends OfferValidationResult {}
