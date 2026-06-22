/**
 * Example: Next.js Offer Wall page (App Router, Client Component)
 *
 * Demonstrates the complete client-side integration flow:
 * 1. Collect fingerprint on mount
 * 2. Show personalised offers
 * 3. Validate before redirect
 */
'use client';

import { useState } from 'react';
import { useFingerprint } from './hooks/useFingerprint';
import { FingerprintSDK } from '@klinkfinance/fingerprint-sdk';

const sdk = new FingerprintSDK({
  baseUrl: process.env.NEXT_PUBLIC_FINGERPRINT_API_URL!,
  apiKey: process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY,
});

interface Offer {
  id: string;
  title: string;
  payout: number;
  url: string;
}

interface OfferWallProps {
  userId: string;
  offers: Offer[];
  publisherId: string;
}

export default function OfferWall({ userId, offers, publisherId }: OfferWallProps) {
  const { visitorId, data: fingerprintData, isLoading, error } = useFingerprint({ userId, publisherId });
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [blockInfo, setBlockInfo] = useState<{ offerId: string; reason: string } | null>(null);

  async function handleOfferClick(offer: Offer) {
    if (!visitorId || !fingerprintData?.visitorToken) return;

    setRedirecting(offer.id);
    setBlockInfo(null);

    try {
      const result = await sdk.offers.validate({
        visitorId,
        offerId: offer.id,
        publisherId,
        clickTimestamp: Date.now(),
      });

      if (!result.allowed) {
        setBlockInfo({ offerId: offer.id, reason: result.blockReasons[0] ?? 'Risk threshold exceeded' });
        return;
      }

      // Safe to redirect
      window.open(offer.url, '_blank', 'noopener,noreferrer');
    } finally {
      setRedirecting(null);
    }
  }

  if (isLoading) return <p>Preparing your offers…</p>;
  if (error) return <p>Failed to initialise – please refresh.</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#888' }}>
        Visitor: {visitorId}
        {fingerprintData?.isVPN && ' · VPN detected'}
        {fingerprintData?.botDetection?.isBot && ' · Bot detected'}
      </p>

      {blockInfo && (
        <p style={{ color: 'red' }}>
          Offer blocked: {blockInfo.reason}
        </p>
      )}

      <ul>
        {offers.map((offer) => (
          <li key={offer.id}>
            <strong>{offer.title}</strong> — ${offer.payout}
            <button
              onClick={() => handleOfferClick(offer)}
              disabled={!visitorId || redirecting === offer.id}
            >
              {redirecting === offer.id ? 'Checking…' : 'Claim'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
