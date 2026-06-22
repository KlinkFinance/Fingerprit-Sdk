# @klinklabs/fingerprint

![npm version](https://img.shields.io/npm/v/@klinklabs/fingerprint)
![license](https://img.shields.io/npm/l/@klinklabs/fingerprint)
![node](https://img.shields.io/node/v/@klinklabs/fingerprint)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue)

Official TypeScript SDK for the Klink Finance Fingerprint API. Provides device fingerprinting, bot detection, VPN detection, and offer fraud validation for both browser and server environments.

---

## How the flow works

Publishers redirect users to a Klink-powered landing page with offer context in the query string. The SDK runs on that page, collects signals, and either hard-blocks the user client-side or sends the signals to the API for server-side validation. On approval, the user is redirected to the offer URL with a signed token appended so the destination server can verify the visit.

```
Publisher site                Landing page (your app)              Offer destination
──────────────                ───────────────────────              ─────────────────

User clicks offer
      │
      ▼
Redirect to landing page
?offerId=X
&publisherId=Y
&userId=Z
&redirect=https://offer.example.com
      │
      ▼
                    FingerprintSDK initialises
                    FraudDetector starts collecting
                    (passive listeners attach)
                          │
                    User interacts / page loads
                          │
                    sdk.fingerprint.generate()
                      ├─ Phase 1: instant hard checks
                      ├─ Phase 2: passive behaviour analysis
                      ├─ Phase 3: async fingerprint assembly
                      ├─ Phase 4: timing checks
                      └─ Phase 5: risk score (0–100)
                          │
                    hardBlock?
                    ├─ YES → block user, show error
                    └─ NO  → POST to /api/fingerprint/generate
                                │
                          Server validates:
                          bot detection, VPN, offer checks
                                │
                          offerValidation.allowed?
                          ├─ NO  → block user
                          └─ YES → redirect to offer URL
                                   + ?visitorId=X&sig=Y&ts=Z
                                          │
                                          ▼
                                                    Server verifies HMAC
                                                    sdk.tokens.verify()
                                                    Process conversion
```

---

## Installation

```bash
npm install @klinklabs/fingerprint axios
```

`axios` is a required peer dependency.

### Local development with `file:` link

If you are working in a monorepo or developing the SDK alongside a consumer app:

```bash
# In the test app (or any consumer)
npm install ../Klink-SDK/typescript-sdk
```

This installs via `file:../Klink-SDK/typescript-sdk` — no npm publish required.

---

## Quick Start

The example below mirrors the publisher redirect flow used by Klink Finance landing pages.

```typescript
// app/page.tsx (Next.js — "use client")
"use client";

import { useSearchParams } from "next/navigation";
import {
  FingerprintSDK,
  FingerprintBlockedError,
} from "@klinklabs/fingerprint";

const sdk = new FingerprintSDK({
  baseUrl: process.env.NEXT_PUBLIC_FINGERPRINT_API_URL!,
  apiKey: process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY,
  defaultPublisherId: process.env.NEXT_PUBLIC_PUBLISHER_ID,
});

export default function OfferPage() {
  const params = useSearchParams();
  const offerId     = params.get("offerId")!;
  const userId      = params.get("userId")!;
  const redirectUrl = params.get("redirect")!;

  async function claimOffer() {
    try {
      const result = await sdk.fingerprint.generate({
        platform: "web",
        offerId,
        userId,
        clickTimestamp: Date.now(),
      });

      if (!result.offerValidation.allowed) {
        // Server-side block — show error
        console.error("Blocked:", result.offerValidation.blockReasons);
        return;
      }

      // Append signed token to redirect URL for server-side verification
      const dest = new URL(redirectUrl);
      dest.searchParams.set("visitorId", result.visitorId);
      dest.searchParams.set("sig", result.visitorToken.sig);
      dest.searchParams.set("ts", String(result.visitorToken.ts));
      window.location.href = dest.toString();
    } catch (err) {
      if (err instanceof FingerprintBlockedError) {
        // Client-side hard block — automation/webdriver detected
        console.error("Blocked client-side:", err.flags, "risk:", err.riskScore);
      }
    }
  }

  return <button onClick={claimOffer}>Claim Offer</button>;
}
```

---

## SDK Configuration

Pass a `FingerprintSDKConfig` object to the constructor.

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | **required** | Base URL of the Fingerprint API (e.g. `https://fingerprint.klinkfinance.com`) |
| `apiKey` | `string` | — | Sent as `X-API-Key` header on every request |
| `timeout` | `number` | `10000` | Request timeout in milliseconds |
| `retries` | `number` | `3` | Number of retry attempts on transient failures (429, 5xx, network errors) |
| `retryDelay` | `number` | `500` | Base delay in ms between retries — doubles each attempt with ±20% jitter |
| `debug` | `boolean` | `false` | Log every request and response to `console.debug` |
| `defaultPublisherId` | `string` | — | Publisher ID auto-attached to all `generate` and `validate` calls |
| `defaultHeaders` | `Record<string, string>` | — | Custom headers applied to every outbound request |

### Factory with health check

Use `FingerprintSDK.create()` when you want the process to fail fast at startup if the API is unreachable:

```typescript
const sdk = await FingerprintSDK.create({
  baseUrl: process.env.FINGERPRINT_API_URL!,
  apiKey: process.env.FINGERPRINT_API_KEY,
});
```

---

## API Reference

### `sdk.fingerprint`

#### `generate(request, opts?): Promise<GenerateFingerprintData>`

Generates or retrieves a device fingerprint. For `platform: 'web'` requests in a browser context the SDK automatically collects all available browser signals (user-agent, screen, WebGL, canvas, audio fingerprint, timezone, storage flags, plugins, connection). Fields you supply explicitly override the auto-collected values.

The fraud detector runs before the network call. If a hard-block flag is present, a `FingerprintBlockedError` is thrown without hitting the API.

```typescript
const result = await sdk.fingerprint.generate({
  platform: "web",     // "web" | "android" | "ios"
  userId: "user-123",
  offerId: "offer-456",
  publisherId: "pub-789",  // omit if defaultPublisherId is set
  clickTimestamp: Date.now(),
});

// result: GenerateFingerprintData
console.log(result.visitorId);                         // MD5 device hash
console.log(result.visitorToken);                      // { visitorId, sig, ts, userId? }
console.log(result.isVPN);                             // boolean
console.log(result.botDetection.isBot);                // boolean
console.log(result.botDetection.riskScore);            // 0–100
console.log(result.offerValidation.allowed);           // boolean
console.log(result.offerValidation.overallRiskScore);  // 0–100
console.log(result.isExisting);                        // returning device?
console.log(result.similarityScore);                   // 0–100 match against stored fp
```

**`GenerateFingerprintRequest` fields (all optional except `platform`):**

| Field | Type | Description |
|---|---|---|
| `platform` | `'web' \| 'android' \| 'ios'` | Target platform |
| `userId` | `string` | Forwarded as `X-User-Id` request header |
| `offerId` | `string` | Offer ID or pre-signed JWT with offer context |
| `publisherId` | `string` | Overrides `defaultPublisherId` |
| `clickTimestamp` | `number` | Unix ms timestamp of the triggering user action |
| `fraudSignals` | `FraudSignalBundle` | Attached automatically; override only for testing |
| `mobileInfo` | `MobileInfo` | Required for `android` / `ios` platforms |

All browser device signals (`userAgent`, `screen`, `webgl`, `canvas`, `audio`, `timezone`, etc.) are collected automatically for `platform: 'web'` and can be overridden individually.

#### `list(params?, opts?): Promise<PaginatedData<FingerprintRecord>>`

Paginated list of all fingerprints.

```typescript
const page = await sdk.fingerprint.list({ page: 1, limit: 50 });
// page.fingerprints[]  page.pagination.{ total, page, limit, totalPages }
```

#### `getOne(visitorId, opts?): Promise<GetFingerprintData>`

Retrieve a single fingerprint record with its security summary.

```typescript
const { data, securitySummary } = await sdk.fingerprint.getOne("visitor-id");
// securitySummary.recommendedAction  →  "ALLOW" | "REVIEW" | "BLOCK"
```

#### `getStats(visitorId, opts?): Promise<VisitorStats>`

Aggregated visit statistics for a visitor (visit counts, VPN/bot/offer block rates, countries seen, etc.).

---

### `sdk.fraud`

The `FraudDetector` starts passive event listeners (mouse, touch, click, keyboard, scroll) as soon as the SDK is constructed in a browser context. Signals are collected lazily on the first `getSignals()` or `report()` call.

#### `getSignals(): Promise<FraudSignalBundle | null>`

Collect and return the current fraud signal bundle without sending it to the server. Returns `null` in non-browser environments.

```typescript
const bundle = await sdk.fraud.getSignals();
if (bundle) {
  console.log(bundle.hardBlock);   // true → user should be blocked immediately
  console.log(bundle.riskScore);   // 0–100
  console.log(bundle.flags);       // string[] of triggered flags
  console.log(bundle.behaviour);   // { dwellMs, mouseEntropy, untrustedRatio, ... }
  console.log(bundle.fingerprint); // { canvas, audio, tz, screen, ... }
}
```

#### `report(opts?): Promise<FraudSignalBundle | null>`

Collect signals and POST them to `POST /api/fraud/signals`. Returns the bundle that was sent, or `null` in non-browser environments.

#### `destroy(): void`

Remove all event listeners attached by the fraud detector. Call this on component unmount.

```typescript
useEffect(() => {
  return () => sdk.fraud.destroy();
}, []);
```

---

### `sdk.bot`

#### `analyze(opts?): Promise<AnalyzeBotData>`

Standalone bot/automation analysis. The server inspects the forwarded request headers for automation indicators. Use this when you want bot signals without generating a full fingerprint.

```typescript
const result = await sdk.bot.analyze();
console.log(result.isBot);           // boolean
console.log(result.botType);         // "good_bot" | "bad_bot" | "suspicious" | "unknown"
console.log(result.confidence);      // 0–100 (100 = definitely human)
console.log(result.riskScore);       // 0–100
console.log(result.action);          // "ALLOW" | "REVIEW" | "BLOCK"
console.log(result.detectionMethods); // string[]
```

---

### `sdk.offers`

#### `validate(request, opts?): Promise<ValidateOfferData>`

Run the full 8-check offer fraud validation for a known visitor. Call this immediately before redirecting to an offer URL. If `allowed` is `false`, do not redirect.

```typescript
const result = await sdk.offers.validate({
  visitorId: "visitor-id",         // from a previous generate() call
  offerId: "offer-456",
  publisherId: "pub-789",
  clickTimestamp: Date.now(),
});

if (!result.allowed) {
  console.error("Blocked:", result.blockReasons);
  return;
}
// Safe to redirect
```

**`OfferValidationResult` fields:**

| Field | Type | Description |
|---|---|---|
| `allowed` | `boolean` | Whether to proceed with the offer |
| `action` | `'ALLOW' \| 'REVIEW' \| 'BLOCK'` | Recommended action |
| `overallRiskScore` | `number` | 0–100, higher = riskier |
| `checks` | `OfferChecks` | Results of the 8 individual checks |
| `blockReasons` | `string[]` | Human-readable reasons for a block decision |
| `riskFactors` | `string[]` | Contributing risk signals |

**The 8 offer checks** (all accessible via `result.checks`):

| Check | Description |
|---|---|
| `velocityCheck` | Offer claim rate for this device/user |
| `deviceTrustCheck` | Device risk score and history |
| `networkRiskCheck` | VPN, proxy, and datacenter IP detection |
| `clickInjectionCheck` | Click timestamp vs install/session timing |
| `geoSignalCheck` | Geography consistency |
| `behavioralCheck` | Behaviour pattern analysis |
| `duplicateDeviceCheck` | Same device claiming multiple offers |
| `installIntegrityCheck` | Install source and attestation validity |

---

### `sdk.tokens`

Use these methods server-side to verify that the `visitorId` and `sig` appended to your redirect URL were issued by Klink and have not been tampered with.

#### `verify(request, opts?): Promise<VerifyTokenData>`

```typescript
// Server route handler — verify the params appended by the SDK
const { visitorId, sig, ts } = req.query;

const result = await sdk.tokens.verify({
  visitorId: String(visitorId),
  sig: String(sig),
  ts: Number(ts),
});

if (!result.valid) {
  return res.status(403).json({ error: "Invalid token", reason: result.reason });
}
// Proceed — result.visitorId is the verified identity
```

#### `verifyToken(token, opts?): Promise<VerifyTokenData>`

Convenience helper — pass a `VisitorToken` object directly (the `visitorToken` field from a `generate()` response).

```typescript
const { visitorToken } = await sdk.fingerprint.generate({ platform: "web" });
const { valid } = await sdk.tokens.verifyToken(visitorToken);
```

---

### `sdk.status`

#### `isReady(): Promise<boolean>`

Returns `true` if the API is reachable and the database is connected. Suitable for pre-flight checks.

#### `health(opts?): Promise<HealthData>`

Basic health check — fast, no database dependency.

#### `status(opts?): Promise<StatusData>`

Detailed status including database connectivity and memory usage.

#### `ready(opts?): Promise<ReadinessData>`

Returns 200 when the service is ready to handle traffic.

#### `live(opts?): Promise<LivenessData>`

Kubernetes liveness probe endpoint.

---

## Fraud Detection Engine

The `FraudDetector` runs entirely in the browser. It executes five phases each time `collect()` is called (which happens automatically inside `generate()`).

### Phase 1 — Instant hard checks (synchronous, runs at construction)

Checks that do not require user interaction. A positive result immediately marks the session for hard-blocking.

| Flag | Hard block | Description |
|---|---|---|
| `webdriver` | yes | `navigator.webdriver === true` |
| `bot_global:<name>` | yes | One of the automation globals is present (`__nightmare`, `callPhantom`, `_phantom`, `domAutomation`, `domAutomationController`, `_selenium`, `__webdriver_script_fn`, `__puppeteer__`) |
| `no_plugins` | no | Desktop browser with zero plugins |
| `zero_outer_height` | no | `window.outerHeight === 0` — headless indicator |
| `fake_chrome` | no | Chrome UA but no `window.chrome` object |
| `emulator` | no | `navigator.platform === 'Linux armv8l'` with no touch points |
| `tiny_screen` | no | Screen dimension under 100px |
| `fake_mobile` | no | Mobile UA but `maxTouchPoints === 0` |

### Phase 2 — Passive behaviour listeners (continuous, runs from construction)

Event listeners on `mousemove`, `touchstart`, `touchmove`, `touchend`, `click`, `keydown`, and `scroll` run silently in the background from SDK construction until `collect()` is called.

| Flag | Hard block | Description |
|---|---|---|
| `untrusted_click` | yes | Any `click` event with `isTrusted === false` |
| `no_mouse_movement` | no | Desktop device, zero mouse movement recorded |
| `low_mouse_entropy` | no | Mouse movement angle variance below 0.3 (robotic linear motion) |
| `no_touch_events` | no | Mobile device, zero touch events recorded |
| `scripted_touch` | no | Touch coordinates repeat — fewer than 50% unique positions |
| `high_untrusted_ratio` | no | More than 30% of clicks are untrusted |
| `instant_keypress` | no | Two keydown events with 0ms gap |
| `robotic_typing` | no | Key inter-press variance below 2ms |
| `scripted_scroll` | no | Scroll jump larger than 2000px in a single event |

### Phase 3 — Async fingerprint assembly

Canvas fingerprint, audio fingerprint (OfflineAudioContext), and device property collection run asynchronously. Consistency checks produce additional flags.

| Flag | Hard block | Description |
|---|---|---|
| `ua_touch_mismatch` | no | Mobile UA but `maxTouchPoints === 0` (post-assembly check) |
| `tz_mismatch` | no | No timezone resolved from `Intl.DateTimeFormat` |
| `emulator_dpr` | no | Mobile device with `devicePixelRatio === 1.0` |
| `emulator_resolution` | no | Screen matches a known emulator resolution/DPR combination |
| `languages_suspicious` | no | Only one language set with no region tag |

### Phase 4 — Timing checks

Evaluated at `collect()` time against the page load timestamp.

| Flag | Hard block | Description |
|---|---|---|
| `impossible_speed` | yes | Page dwell time under 1500ms — user could not have read the page |
| `very_fast_claim` | no | Dwell time under 4000ms |
| `stale_session` | no | Dwell time over 1 hour |

### Phase 5 — Risk score calculation

| Flag tier | Weight per flag | Cap |
|---|---|---|
| Hard block flags (any) | 100 | 100 |
| High flags (`no_plugins`, `fake_chrome`, `emulator`, `low_mouse_entropy`, `no_touch_events`, `instant_keypress`, `robotic_typing`) | 25 (first 2 only) | — |
| Medium flags (`zero_outer_height`, `fake_mobile`, `ua_touch_mismatch`, `tz_mismatch`, `emulator_resolution`, `scripted_touch`, `scripted_scroll`, `very_fast_claim`) | 15 | — |
| Low flags (`high_untrusted_ratio`, `emulator_dpr`, `no_mouse_movement`, `stale_session`, `languages_suspicious`) | 8 | — |
| Non-hard-block total | — | 99 |

A `riskScore` of 100 means `hardBlock: true`. A score of 0 means no fraud signals were detected.

---

## Error Handling

All errors extend `FingerprintSDKError` (which extends `Error`) and carry a `.code` string. Check `instanceof` to branch by error type.

```typescript
import {
  FingerprintBlockedError,
  FingerprintAPIError,
  FingerprintAuthError,
  FingerprintNetworkError,
  FingerprintTimeoutError,
  FingerprintValidationError,
  FingerprintConfigError,
} from "@klinklabs/fingerprint";

try {
  const result = await sdk.fingerprint.generate({ platform: "web" });
} catch (err) {
  if (err instanceof FingerprintBlockedError) {
    // Client-side hard block — never reached the API
    console.error("Blocked flags:", err.flags);       // string[]
    console.error("Risk score:", err.riskScore);      // 0–100
  } else if (err instanceof FingerprintAuthError) {
    // 401 or 403 — bad or missing API key
    console.error("Auth failed:", err.message, err.statusCode);
  } else if (err instanceof FingerprintValidationError) {
    // 400 — bad request payload
    console.error("Validation error:", err.message, err.responseBody);
  } else if (err instanceof FingerprintAPIError) {
    // Other non-2xx response
    console.error("API error:", err.statusCode, err.message);
  } else if (err instanceof FingerprintTimeoutError) {
    // Request exceeded configured timeout
    console.error("Timed out after:", err.timeoutMs, "ms");
  } else if (err instanceof FingerprintNetworkError) {
    // No response received — connectivity failure
    console.error("Network error:", err.message, err.cause);
  } else if (err instanceof FingerprintConfigError) {
    // Bad SDK configuration — thrown at construction time
    console.error("Config error:", err.message);
  }
}
```

| Error class | `.code` | Thrown when |
|---|---|---|
| `FingerprintBlockedError` | `BLOCKED_ERROR` | Client-side hard-block before the network call; has `.flags[]` and `.riskScore` |
| `FingerprintAPIError` | `API_ERROR` | Non-2xx API response (except 400/401/403) |
| `FingerprintAuthError` | `AUTH_ERROR` | 401 or 403; has `.statusCode` |
| `FingerprintValidationError` | `VALIDATION_ERROR` | 400 bad request; has `.responseBody` |
| `FingerprintNetworkError` | `NETWORK_ERROR` | No response — DNS failure, connection refused, etc.; has `.cause` |
| `FingerprintTimeoutError` | `TIMEOUT_ERROR` | Timeout exceeded; has `.timeoutMs` |
| `FingerprintConfigError` | `CONFIG_ERROR` | Bad constructor arguments (invalid URL, negative timeout, etc.) |

---

## Running the Test App

The test app at `/fingerprint-sdk-testapp` is a Next.js 16 application that implements the full publisher redirect flow: it reads offer params from the URL, runs the SDK, and either blocks or redirects the user.

```bash
cd fingerprint-sdk-testapp
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

**Configuration** — create `.env.local` in the test app directory:

```env
NEXT_PUBLIC_FINGERPRINT_API_URL=https://fingerprint.klinkfinance.com
NEXT_PUBLIC_FINGERPRINT_API_KEY=your-api-key
NEXT_PUBLIC_FINGERPRINT_PUBLISHER_ID=pub-your-id
```

**Test URL format** — append publisher redirect params to simulate a real inbound click:

```
http://localhost:3000?offerId=offer-123&publisherId=pub-456&userId=user-789&redirect=https://example.com/offer
```

| Param | Description |
|---|---|
| `offerId` | The offer being claimed |
| `publisherId` | Publisher sending the traffic |
| `userId` | End-user identifier |
| `redirect` | URL to redirect to on approval; `visitorId`, `sig`, and `ts` are appended |

If `redirect` is omitted, the result is displayed in the test console instead of redirecting.

---

## Running Tests

```bash
# Run the test suite
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Tests are in `src/__tests__/` and use Jest with `ts-jest`. Coverage is collected from all `src/**/*.ts` files.

---

## Building

```bash
npm run build
```

Outputs CommonJS + declaration files to `dist/`. The `tsconfig.build.json` excludes test files from the build output.

```bash
# Type-check without emitting
npm run typecheck

# Watch mode for local development
npm run dev
```

---

## Publishing to npm

The `prepublishOnly` hook runs `build` and `typecheck` automatically.

```bash
npm run build
npm publish
```

To publish a pre-release:

```bash
npm publish --tag next
```

The published package includes `dist/`, `README.md`, and `CHANGELOG.md` (controlled by the `files` field in `package.json`).

---

## License

MIT — see [LICENSE](./LICENSE) for details.
