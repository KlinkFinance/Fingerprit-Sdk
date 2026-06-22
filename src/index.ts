export { FingerprintSDK } from './FingerprintSDK';

// Browser signal collector (web only)
export { BrowserCollector } from './collectors/BrowserCollector';
export type { CollectedWebSignals } from './collectors/BrowserCollector';

// Client-side fraud detection
export { FraudDetector } from './collectors/FraudDetector';
export { FraudService } from './services/FraudService';

// Services (for advanced use / dependency injection)
export { FingerprintService } from './services/FingerprintService';
export { OfferService } from './services/OfferService';
export { BotService } from './services/BotService';
export { TokenService } from './services/TokenService';
export { StatusService } from './services/StatusService';

// Core client
export { ApiClient } from './client/ApiClient';

// Errors
export {
  FingerprintSDKError,
  FingerprintAPIError,
  FingerprintNetworkError,
  FingerprintTimeoutError,
  FingerprintAuthError,
  FingerprintConfigError,
  FingerprintValidationError,
  FingerprintBlockedError,
} from './errors';

// All types
export type {
  // Config
  FingerprintSDKConfig,
  RequestOptions,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  PaginationMeta,
  PaginatedData,

  // Fingerprint
  Platform,
  InstallSource,
  ConnectionType,
  AttestationProvider,
  ScreenInfo,
  MobileInfo,
  MobileAppInfo,
  MobileOSInfo,
  MobileDeviceInfo,
  MobileScreenInfo,
  MobileLocaleInfo,
  MobileNetworkInfo,
  MobilePowerInfo,
  MobileIdsInfo,
  MobileAttestationInfo,
  UserAgentData,
  TouchCapability,
  WebGLInfo,
  ConnectionInfo,
  GenerateFingerprintRequest,
  GenerateFingerprintData,
  VisitorToken,
  JWTContext,
  GetFingerprintData,
  FingerprintRecord,
  SecuritySummary,
  VisitorStats,
  ListFingerprintsParams,

  // Bot
  BotType,
  BotAction,
  BotDetectionResult,
  AnalyzeBotData,
  CloudflareSignals,
  BehavioralSignals,

  // Offer
  OfferAction,
  OfferCheck,
  OfferChecks,
  OfferValidationResult,
  OfferValidationMeta,
  ValidateOfferRequest,
  ValidateOfferData,

  // Token
  VerifyTokenRequest,
  VerifyTokenData,

  // Status
  HealthData,
  StatusData,
  ReadinessData,
  LivenessData,

  // Fraud detection
  FraudSignalBundle,
  FraudFingerprint,
  FraudBehaviour,
} from './types';
