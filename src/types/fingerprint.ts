import type { BotDetectionResult } from './bot';
import type { OfferValidationResult } from './offer';
import type { FraudSignalBundle } from './fraud';

export type Platform = 'web' | 'android' | 'ios';
export type InstallSource = 'play' | 'sideload' | 'testflight' | 'enterprise' | 'unknown';
export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';
export type AttestationProvider = 'play_integrity' | 'device_check' | 'app_attest' | 'unknown';

// ─── Screen ──────────────────────────────────────────────────────────────────

export interface ScreenInfo {
  width: number;
  height: number;
  colorDepth?: number;
  pixelRatio?: number;
  availWidth?: number;
  availHeight?: number;
}

// ─── Mobile-specific types ────────────────────────────────────────────────────

export interface MobileAppInfo {
  bundleId: string;
  version: string;
  buildNumber?: string;
  firstInstallTime?: number;
  lastUpdateTime?: number;
  installSource?: InstallSource;
}

export interface MobileOSInfo {
  name: 'Android' | 'iOS' | 'iPadOS';
  version: string;
  apiLevel?: number;
  securityPatch?: string;
}

export interface MobileDeviceInfo {
  model: string;
  manufacturer?: string;
  cpuAbis?: string[];
  isEmulator: boolean;
  isDebug?: boolean;
  isJailbrokenOrRooted: boolean;
}

export interface MobileScreenInfo {
  widthDp: number;
  heightDp: number;
  scale?: number;
  refreshRate?: number;
}

export interface MobileLocaleInfo {
  language: string;
  region?: string;
  timezone: string;
  timezoneOffset?: number;
  uses24HourClock?: boolean;
}

export interface MobileNetworkInfo {
  connectionType: ConnectionType;
  carrier?: string;
  mcc?: string;
  mnc?: string;
}

export interface MobilePowerInfo {
  batteryLevel?: number;
  charging?: boolean;
  lowPowerMode?: boolean;
}

export interface MobileIdsInfo {
  idfvHash?: string;
  ssaidHash?: string;
  adIdHash?: string;
}

export interface MobileAttestationInfo {
  provider: AttestationProvider;
  verdict: string;
  details?: Record<string, unknown>;
  timestamp?: number;
  nonceId?: string;
}

export interface MobileInfo {
  app: MobileAppInfo;
  os: MobileOSInfo;
  device: MobileDeviceInfo;
  screen?: MobileScreenInfo;
  locale?: MobileLocaleInfo;
  network?: MobileNetworkInfo;
  power?: MobilePowerInfo;
  ids?: MobileIdsInfo;
  attestation?: MobileAttestationInfo;
}

// ─── Web device info ──────────────────────────────────────────────────────────

export interface UserAgentData {
  brands?: Array<{ brand: string; version: string }>;
  mobile?: boolean;
  platform?: string;
}

export interface TouchCapability {
  isTouchDevice: boolean;
  maxTouchPoints?: number;
  touchEventSupported?: boolean;
  pointerEventSupported?: boolean;
}

export interface WebGLInfo {
  vendor?: string;
  renderer?: string;
  version?: string;
  shadingLanguageVersion?: string;
  extensions?: string[];
}

export interface ConnectionInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

// ─── Generate Request ─────────────────────────────────────────────────────────

export interface GenerateFingerprintRequest {
  platform: Platform;

  /** User identifier – auto-forwarded as X-User-Id header */
  userId?: string;

  /** Offer ID or a pre-signed JWT containing offer context */
  offerId?: string;

  publisherId?: string;

  /** Unix timestamp (ms) of the user action that triggered this call */
  clickTimestamp?: number;

  /** Client-side fraud signal bundle collected by FraudDetector */
  fraudSignals?: FraudSignalBundle;

  // ── Web device signals ───────────────────────────────────────────────────

  userAgent?: string;
  userAgentData?: UserAgentData;
  language?: string;
  languages?: string[];
  timezone?: string;
  timezoneOffset?: number;
  advertisingId?: string;
  advertisingIdType?: 'gaid' | 'idfa' | 'adid' | 'unknown';
  uniqueId?: string;
  screen?: ScreenInfo;
  isResponsiveMode?: boolean;
  cookieEnabled?: boolean;
  doNotTrack?: boolean | null;
  localStorage?: boolean;
  sessionStorage?: boolean;
  indexedDB?: boolean;
  touchCapability?: TouchCapability;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  platformInfo?: string;
  vendor?: string;
  webgl?: WebGLInfo;
  audio?: string;
  canvas?: string;
  connection?: ConnectionInfo;
  plugins?: string[];
  mimeTypes?: string[];
  fonts?: string[];
  battery?: {
    charging?: boolean;
    level?: number;
    chargingTime?: number;
    dischargingTime?: number;
  };

  // ── Mobile-specific ───────────────────────────────────────────────────────

  /** Required for platform=android|ios */
  mobileInfo?: MobileInfo;

  /** Android GAID (Google Advertising ID) */
  gaid?: string;

  /** iOS IDFA */
  idfa?: string;
}

// ─── Visitor Token ────────────────────────────────────────────────────────────

export interface VisitorToken {
  visitorId: string;
  /** HMAC-SHA256 hex signature */
  sig: string;
  /** Unix timestamp in milliseconds when token was signed */
  ts: number;
  userId?: string;
}

// ─── JWT Context ──────────────────────────────────────────────────────────────

export interface JWTContext {
  offerId?: string;
  userId?: string;
  publisherId?: string;
  idfa?: string;
  gaid?: string;
}

// ─── Generate Response ────────────────────────────────────────────────────────

export interface GenerateFingerprintData {
  /** MD5 hash – primary device identifier */
  visitorId: string;
  /** HMAC-signed token for server-side verification of redirect/conversion events */
  visitorToken: VisitorToken;
  /** Per-session identifier */
  sessionId: string;
  stableFingerprint: string;
  detailedFingerprint: string;
  visitCount: number;
  isVPN: boolean;
  vpnProvider: string | null;
  /** True when this device has been seen before */
  isExisting: boolean;
  /** Similarity score (0–100) against the stored fingerprint for returning visitors */
  similarityScore: number;
  botDetection: BotDetectionResult;
  offerValidation: OfferValidationResult;
  jwtContext: JWTContext | null;
}

// ─── Fingerprint Record (GET /api/fingerprint/:visitorId) ─────────────────────

export interface SecuritySummary {
  isHighRisk: boolean;
  riskFactors: string[];
  vpnUsageRate: number;
  botDetectionRate: number;
  offerBlockRate: number;
  recommendedAction: 'ALLOW' | 'REVIEW' | 'BLOCK';
}

export interface FingerprintRecord {
  platform: Platform;
  visitorId: string;
  fingerprint: string;
  bucketKey: string;
  visitCount: number;
  firstSeen: string;
  lastSeen: string;
  isActive: boolean;
  userId?: string;
  networkInfo?: {
    ip: string;
    country?: string;
    region?: string;
    city?: string;
    isp?: string;
    isVPN: boolean;
    vpnProvider?: string;
    vpnConfidence?: number;
    vpnRiskScore?: number;
  };
  botDetection?: {
    isBot: boolean;
    botType: string;
    confidence: number;
    riskScore: number;
    detectionMethods: string[];
  };
}

export interface GetFingerprintData {
  data: FingerprintRecord;
  securitySummary: SecuritySummary;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface VisitorStats {
  totalVisits: number;
  vpnVisits: number;
  regularVisits: number;
  botVisits: number;
  offersBlocked: number;
  offersAllowed: number;
  firstSeen: string;
  lastSeen: string;
  countries: string[];
  devices: string[];
  userId?: string;
}

// ─── List Request ─────────────────────────────────────────────────────────────

export interface ListFingerprintsParams {
  page?: number;
  limit?: number;
}
