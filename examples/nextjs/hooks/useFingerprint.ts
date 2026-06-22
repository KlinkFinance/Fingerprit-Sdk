/**
 * Example: React hook for fingerprint generation in Next.js (App Router / Pages Router)
 *
 * The SDK now auto-collects all browser signals, so you only need to pass
 * context fields (userId, offerId, publisherId). No manual signal collection needed.
 *
 * Usage:
 *   const { visitorId, visitorToken, data, isLoading, error } = useFingerprint({ userId: user?.id });
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FingerprintSDK } from '@klinkfinance/fingerprint-sdk';
import type { GenerateFingerprintData } from '@klinkfinance/fingerprint-sdk';

// Initialise once — reused across all component instances
const sdk = new FingerprintSDK({
  baseUrl: process.env.NEXT_PUBLIC_FINGERPRINT_API_URL!,
  apiKey: process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY,
  timeout: 8000,
  retries: 2,
});

interface UseFingerprintOptions {
  userId?: string;
  offerId?: string;
  publisherId?: string;
  /** Set to true to skip fingerprinting (e.g. while user session is loading) */
  disabled?: boolean;
}

interface UseFingerprintReturn {
  data: GenerateFingerprintData | null;
  visitorId: string | null;
  isLoading: boolean;
  error: Error | null;
  /** Force a fresh fingerprint (e.g. after login when userId becomes available) */
  refresh: () => void;
}

export function useFingerprint(options: UseFingerprintOptions = {}): UseFingerprintReturn {
  const { userId, offerId, publisherId, disabled = false } = options;
  const [data, setData] = useState<GenerateFingerprintData | null>(null);
  const [isLoading, setIsLoading] = useState(!disabled);
  const [error, setError] = useState<Error | null>(null);
  const ranRef = useRef(false);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // platform: 'web' → SDK collects userAgent, screen, WebGL, canvas, timezone, etc. automatically
      const result = await sdk.fingerprint.generate({
        platform: 'web',
        userId,
        offerId,
        publisherId,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [userId, offerId, publisherId]);

  useEffect(() => {
    if (disabled || ranRef.current) return;
    ranRef.current = true;
    run();
  }, [disabled, run]);

  return {
    data,
    visitorId: data?.visitorId ?? null,
    isLoading,
    error,
    refresh: run,
  };
}
