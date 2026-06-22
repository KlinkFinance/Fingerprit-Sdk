/**
 * Example: Node.js / Express server-side usage
 *
 * Shows: SDK initialisation with health check, token verification,
 * and offer fraud validation in a typical API middleware flow.
 */

import { FingerprintSDK, FingerprintAPIError, FingerprintNetworkError } from '@klinkfinance/fingerprint-sdk';
import type { VisitorToken } from '@klinkfinance/fingerprint-sdk';

async function main() {
  // Factory method verifies the API is reachable before returning
  const sdk = await FingerprintSDK.create({
    baseUrl: process.env.FINGERPRINT_API_URL ?? 'http://localhost:3000',
    apiKey: process.env.FINGERPRINT_API_KEY,
    defaultPublisherId: 'pub-klink-001',
    timeout: 8000,
    retries: 3,
    debug: process.env.NODE_ENV === 'development',
  });

  console.log('SDK ready. Config:', sdk.getConfig());

  // ── Example 1: verify a visitor token from a webhook payload ──────────────

  const incomingToken: VisitorToken = {
    visitorId: 'abc123',
    sig: 'hexsignature',
    ts: Date.now() - 5000,
    userId: 'user-42',
  };

  const tokenResult = await sdk.tokens.verifyToken(incomingToken);
  if (!tokenResult.valid) {
    console.warn('Rejected token:', tokenResult.reason);
    process.exit(1);
  }
  console.log('Token verified for visitor:', tokenResult.visitorId);

  // ── Example 2: validate an offer before awarding payout ──────────────────

  const offerResult = await sdk.offers.validate({
    visitorId: incomingToken.visitorId,
    offerId: 'offer-xyz',
    clickTimestamp: incomingToken.ts,
  });

  if (offerResult.allowed) {
    console.log('Offer approved, risk score:', offerResult.overallRiskScore);
  } else {
    console.warn('Offer blocked:', offerResult.blockReasons, 'Action:', offerResult.action);
  }

  // ── Example 3: look up a visitor record ──────────────────────────────────

  try {
    const record = await sdk.fingerprint.getOne(incomingToken.visitorId);
    console.log('Visitor platform:', record.data.platform);
    console.log('Security summary:', record.securitySummary);
  } catch (err) {
    if (err instanceof FingerprintAPIError && err.statusCode === 404) {
      console.log('Visitor not found');
    } else if (err instanceof FingerprintNetworkError) {
      console.error('Network issue – fingerprint API unreachable');
    } else {
      throw err;
    }
  }

  // ── Example 4: check API health before a batch job ───────────────────────

  const health = await sdk.status.health();
  console.log('API uptime:', health.uptime, 'seconds');
}

main().catch(console.error);
