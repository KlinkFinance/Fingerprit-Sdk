/**
 * Example: Next.js API Route (App Router) – server-side token verification
 *
 * File: app/api/offers/redirect/route.ts
 *
 * The client sends the visitorToken received from sdk.fingerprint.generate()
 * so the server can verify the token before processing an offer redirect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FingerprintSDK, FingerprintAuthError, FingerprintAPIError } from '@klinkfinance/fingerprint-sdk';
import type { VisitorToken } from '@klinkfinance/fingerprint-sdk';

// Initialise once at module level (reused across requests in the same worker)
const sdk = new FingerprintSDK({
  baseUrl: process.env.FINGERPRINT_API_URL!,
  apiKey: process.env.FINGERPRINT_API_KEY,
  timeout: 5000,
  retries: 2,
  defaultPublisherId: process.env.PUBLISHER_ID,
});

export async function POST(request: NextRequest) {
  let body: { visitorToken?: VisitorToken; offerId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { visitorToken, offerId } = body;

  if (!visitorToken?.visitorId || !visitorToken.sig || !visitorToken.ts) {
    return NextResponse.json({ error: 'visitorToken is required' }, { status: 400 });
  }

  try {
    // 1. Verify the HMAC token hasn't been tampered with
    const verification = await sdk.tokens.verifyToken(visitorToken);
    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Invalid or expired visitor token', reason: verification.reason },
        { status: 401 },
      );
    }

    // 2. Run offer fraud validation
    const offerResult = await sdk.offers.validate({
      visitorId: visitorToken.visitorId,
      offerId,
      clickTimestamp: Date.now(),
    });

    if (!offerResult.allowed) {
      return NextResponse.json(
        {
          error: 'Offer blocked by fraud prevention',
          action: offerResult.action,
          blockReasons: offerResult.blockReasons,
          riskScore: offerResult.overallRiskScore,
        },
        { status: 403 },
      );
    }

    // Proceed with redirect
    return NextResponse.json({
      allowed: true,
      riskScore: offerResult.overallRiskScore,
    });
  } catch (err) {
    if (err instanceof FingerprintAuthError) {
      console.error('[Fingerprint] Auth error – check FINGERPRINT_API_KEY', err.message);
      return NextResponse.json({ error: 'Service misconfiguration' }, { status: 500 });
    }
    if (err instanceof FingerprintAPIError) {
      console.error('[Fingerprint] API error', err.statusCode, err.message);
      return NextResponse.json({ error: 'Fingerprint service error' }, { status: 502 });
    }
    console.error('[Fingerprint] Unexpected error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
