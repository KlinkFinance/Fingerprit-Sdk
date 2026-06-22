# Changelog

All notable changes to `@klinkfinance/fingerprint-sdk` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

Initial release.

### Added

#### Core SDK

- `FingerprintSDK` class — single integration point for all services. Accepts `FingerprintSDKConfig` and validates the configuration at construction time, throwing `FingerprintConfigError` immediately on invalid input.
- `FingerprintSDK.create(config)` static factory — constructs the SDK and performs a live readiness check against the API before returning; throws if the API is unreachable.
- `FingerprintSDK.getConfig()` — returns the resolved configuration object (read-only) for debugging.

#### `sdk.fingerprint` — FingerprintService

- `generate(request, opts?)` — POST `/api/fingerprint/generate`. Auto-collects all available browser signals for `platform: 'web'` requests via `BrowserCollector`. Caller-supplied fields override auto-collected values. Attaches fraud signals from `FraudDetector` automatically; throws `FingerprintBlockedError` before the network call if a hard-block flag is present. Forwards `userId` as the `X-User-Id` request header.
- `list(params?, opts?)` — GET `/api/fingerprint`. Returns a paginated list of fingerprint records with `PaginationMeta`.
- `getOne(visitorId, opts?)` — GET `/api/fingerprint/:visitorId`. Returns a `FingerprintRecord` alongside a `SecuritySummary` with recommended action (`ALLOW`, `REVIEW`, or `BLOCK`).
- `getStats(visitorId, opts?)` — GET `/api/fingerprint/:visitorId/stats`. Returns aggregated visit statistics including VPN, bot, and offer block counts.

#### `sdk.fraud` — FraudService + FraudDetector

- `FraudDetector` class — browser-only passive signal collector. Starts event listeners (`mousemove`, `touchstart`, `touchmove`, `touchend`, `click`, `keydown`, `scroll`) at construction. Implements five detection phases: instant hard checks, passive behaviour analysis, async fingerprint assembly (canvas + audio), timing checks, and risk score calculation (0–100).
- Hard-block flags: `webdriver`, `bot_global:<name>` (eight automation globals), `untrusted_click`, `impossible_speed`.
- High-weight flags (25 points each, first two counted): `no_plugins`, `fake_chrome`, `emulator`, `low_mouse_entropy`, `no_touch_events`, `instant_keypress`, `robotic_typing`.
- Medium-weight flags (15 points each): `zero_outer_height`, `fake_mobile`, `ua_touch_mismatch`, `tz_mismatch`, `emulator_resolution`, `scripted_touch`, `scripted_scroll`, `very_fast_claim`.
- Low-weight flags (8 points each): `high_untrusted_ratio`, `emulator_dpr`, `no_mouse_movement`, `stale_session`, `languages_suspicious`.
- `FraudService.getSignals()` — collect and return the current `FraudSignalBundle` without posting to the server. Returns `null` in non-browser environments.
- `FraudService.report(opts?)` — collect signals and POST to `POST /api/fraud/signals`. Returns the bundle sent.
- `FraudService.destroy()` — removes all DOM event listeners attached by the detector.

#### `sdk.bot` — BotService

- `analyze(opts?)` — POST `/api/fingerprint/analyze-bot`. Standalone bot and automation analysis based on server-side header inspection. Returns `AnalyzeBotData` with `isBot`, `botType` (`good_bot`, `bad_bot`, `suspicious`, `unknown`), `confidence` (0–100, 100 = definitely human), `riskScore`, `action`, `detectionMethods`, `cloudflareData`, and `behavioralSignals`.

#### `sdk.offers` — OfferService

- `validate(request, opts?)` — POST `/api/fingerprint/validate-offer`. Runs 8 server-side offer fraud checks for a known visitor: `velocityCheck`, `deviceTrustCheck`, `networkRiskCheck`, `clickInjectionCheck`, `geoSignalCheck`, `behavioralCheck`, `duplicateDeviceCheck`, `installIntegrityCheck`. Returns `ValidateOfferData` with `allowed`, `action`, `overallRiskScore` (0–100), per-check results, `blockReasons`, and `riskFactors`. `clickTimestamp` defaults to the time of the method call if not supplied.

#### `sdk.tokens` — TokenService

- `verify(request, opts?)` — POST `/api/fingerprint/verify-token`. Server-side HMAC-SHA256 verification of the `visitorToken` appended to redirect URLs. Returns `{ valid, visitorId?, reason? }`.
- `verifyToken(token, opts?)` — convenience wrapper that accepts a `VisitorToken` object directly (the `visitorToken` field from a `generate()` response).

#### `sdk.status` — StatusService

- `isReady()` — returns `true` if the API readiness probe succeeds; catches all errors and returns `false`. Suitable for application startup checks.
- `health(opts?)` — GET `/health`. Fast health check with no database dependency; returns uptime, environment, and timestamp.
- `status(opts?)` — GET `/status`. Detailed status including database connectivity, memory usage, and service version.
- `ready(opts?)` — GET `/ready`. Readiness probe — returns 200 only when the database is connected.
- `live(opts?)` — GET `/live`. Kubernetes liveness probe — always returns 200 if the Node.js process is alive.

#### `BrowserCollector`

- `BrowserCollector.collect()` — static async method that collects all available browser device signals without any third-party library. Signals collected: `userAgent`, `userAgentData` (UA-CH brands, mobile, platform), `language`, `languages`, `timezone`, `timezoneOffset`, `screen` (width, height, colorDepth, pixelRatio, availWidth, availHeight), `isResponsiveMode`, `cookieEnabled`, `doNotTrack`, `localStorage`, `sessionStorage`, `indexedDB`, `touchCapability`, `hardwareConcurrency`, `deviceMemory`, `platformInfo`, `vendor`, `connection` (Network Information API), `plugins`, `webgl` (vendor, renderer, version, shading language version), `canvas` fingerprint, `audio` fingerprint (OfflineAudioContext hash).
- `BrowserCollector.isAvailable()` — returns `false` server-side (`window` or `navigator` absent) so the collector is safe to import in universal/SSR code.

#### `ApiClient`

- Axios-based HTTP client with automatic retry logic (exponential backoff with ±20% jitter, configurable base delay and max attempts).
- Retries on network errors and HTTP status codes 429, 500, 502, 503, 504.
- Per-request `timeout` and `noRetry` overrides via `RequestOptions`.
- Debug interceptors log every outgoing request and incoming response to `console.debug` when `debug: true`.

#### Error classes

- `FingerprintSDKError` — base class for all SDK errors; carries `.code` string and extends `Error`.
- `FingerprintBlockedError` — client-side hard block; carries `.flags: string[]` and `.riskScore: number`.
- `FingerprintAPIError` — non-2xx response; carries `.statusCode` and `.responseBody`.
- `FingerprintAuthError` — 401 or 403; carries `.statusCode: 401 | 403` and `.responseBody`.
- `FingerprintValidationError` — 400 bad request; carries `.statusCode` and `.responseBody`.
- `FingerprintNetworkError` — no response received; carries `.cause?: Error`.
- `FingerprintTimeoutError` — timeout exceeded; carries `.timeoutMs: number`.
- `FingerprintConfigError` — bad SDK configuration; thrown synchronously at construction time.

#### Type exports

- Full TypeScript type exports for all request/response shapes: `FingerprintSDKConfig`, `RequestOptions`, `GenerateFingerprintRequest`, `GenerateFingerprintData`, `VisitorToken`, `JWTContext`, `FingerprintRecord`, `GetFingerprintData`, `SecuritySummary`, `VisitorStats`, `ListFingerprintsParams`, `BotDetectionResult`, `AnalyzeBotData`, `BotType`, `BotAction`, `CloudflareSignals`, `BehavioralSignals`, `ValidateOfferRequest`, `ValidateOfferData`, `OfferValidationResult`, `OfferChecks`, `OfferCheck`, `OfferAction`, `VerifyTokenRequest`, `VerifyTokenData`, `HealthData`, `StatusData`, `ReadinessData`, `LivenessData`, `FraudSignalBundle`, `FraudFingerprint`, `FraudBehaviour`, `MobileInfo`, and all supporting mobile sub-types.
- Platform types: `Platform` (`'web' | 'android' | 'ios'`), `InstallSource`, `ConnectionType`, `AttestationProvider`.
- API wrapper types: `ApiSuccessResponse<T>`, `ApiErrorResponse`, `ApiResponse<T>`, `PaginationMeta`, `PaginatedData<T>`.

#### Test app (`fingerprint-sdk-testapp`)

- Next.js 16 test application that implements the complete publisher redirect flow: reads `offerId`, `publisherId`, `userId`, and `redirect` from the URL query string, runs `sdk.fingerprint.generate()`, shows fraud signals and server validation results, and redirects to the offer URL with `visitorId`, `sig`, and `ts` appended on approval.
- Debug panel with standalone `sdk.fingerprint.generate()` and `sdk.fraud.getSignals()` buttons.
- Installed via `file:` link (`"@klinkfinance/fingerprint-sdk": "file:../Klink-SDK/typescript-sdk"`).
