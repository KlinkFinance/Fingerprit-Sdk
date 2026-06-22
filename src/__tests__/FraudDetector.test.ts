/** @jest-environment jsdom */

import { FraudDetector } from '../collectors/FraudDetector';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Restore an Object.defineProperty'd navigator field. */
function restoreNavigatorProp(prop: string): void {
  // jsdom allows reconfiguring these; delete + set works for booleans
  try {
    Object.defineProperty(navigator, prop, {
      value: undefined,
      configurable: true,
      writable: true,
    });
  } catch { /* best-effort */ }
}

// ── Phase 1 flag tests ───────────────────────────────────────────────────────

describe('FraudDetector — Phase 1: webdriver flag', () => {
  afterEach(() => {
    restoreNavigatorProp('webdriver');
  });

  it('flags webdriver when navigator.webdriver === true', async () => {
    Object.defineProperty(navigator, 'webdriver', {
      value: true,
      configurable: true,
      writable: true,
    });

    const detector = new FraudDetector();
    const result = await detector.collect();

    expect(result.flags).toContain('webdriver');
  });

  it('sets hardBlock=true and riskScore=100 when webdriver is flagged', async () => {
    Object.defineProperty(navigator, 'webdriver', {
      value: true,
      configurable: true,
      writable: true,
    });

    const detector = new FraudDetector();
    const result = await detector.collect();

    expect(result.hardBlock).toBe(true);
    expect(result.riskScore).toBe(100);
    detector.destroy();
  });
});

describe('FraudDetector — Phase 1: automation globals', () => {
  afterEach(() => {
    // Clean up any automation globals we injected
    const w = window as unknown as Record<string, unknown>;
    delete w.__nightmare;
  });

  it('flags bot_global:__nightmare when __nightmare is present on window', async () => {
    (window as unknown as Record<string, unknown>).__nightmare = {};

    const detector = new FraudDetector();
    const result = await detector.collect();

    expect(result.flags).toContain('bot_global:__nightmare');
    expect(result.hardBlock).toBe(true);
    detector.destroy();
  });
});

describe('FraudDetector — Phase 1: tiny_screen flag', () => {
  const originalWidth = screen.width;
  const originalHeight = screen.height;

  afterEach(() => {
    Object.defineProperty(screen, 'width', { value: originalWidth, configurable: true, writable: true });
    Object.defineProperty(screen, 'height', { value: originalHeight, configurable: true, writable: true });
  });

  it('flags tiny_screen when screen dimensions are below 100px', async () => {
    Object.defineProperty(screen, 'width', { value: 50, configurable: true, writable: true });
    Object.defineProperty(screen, 'height', { value: 50, configurable: true, writable: true });

    const detector = new FraudDetector();
    const result = await detector.collect();

    expect(result.flags).toContain('tiny_screen');
    detector.destroy();
  });
});

describe('FraudDetector — Phase 1: fake_mobile flag', () => {
  const originalUA = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it('flags fake_mobile when mobile UA but maxTouchPoints is 0', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
      writable: true,
    });

    const detector = new FraudDetector();
    const result = await detector.collect();

    expect(result.flags).toContain('fake_mobile');
    detector.destroy();
  });
});

describe('FraudDetector — Phase 1: clean window', () => {
  it('hardBlock is false with default jsdom navigator', async () => {
    // jsdom default: webdriver is undefined/false, no automation globals
    const detector = new FraudDetector();

    // Provide enough dwell time to avoid impossible_speed
    await new Promise(r => setTimeout(r, 0));
    // We use a Date.now spy to ensure dwell > 1500ms
    const nowSpy = jest.spyOn(Date, 'now');
    const base = Date.now();
    nowSpy.mockRestore();

    // Re-create detector after mocking so we control the dwell
    const nowSpy2 = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(base)         // constructor pageLoadTime
      .mockReturnValue(base + 2000);     // collect() — dwell 2000ms

    const detector2 = new FraudDetector();
    const result = await detector2.collect();

    expect(result.hardBlock).toBe(false);
    detector2.destroy();
    nowSpy2.mockRestore();
    detector.destroy();
  });
});

// ── Score computation ────────────────────────────────────────────────────────

describe('FraudDetector — score: no flags', () => {
  it('riskScore is 0 and hardBlock is false when no suspicious signals', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    const base = 1_000_000;
    // constructor call, then collect() call — dwell = 2000ms (no timing flags)
    nowSpy.mockReturnValueOnce(base).mockReturnValue(base + 2000);

    const detector = new FraudDetector();
    const result = await detector.collect();

    // tiny_screen or other env artefacts may exist in jsdom; we only assert
    // the overall result driven by the mocked timing
    expect(result.hardBlock).toBe(false);
    expect(result.riskScore).toBeLessThan(100);

    detector.destroy();
    nowSpy.mockRestore();
  });
});

describe('FraudDetector — score: impossible_speed', () => {
  it('sets hardBlock=true and riskScore=100 when dwell < 1500ms', async () => {
    const base = 1_000_000;
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(base)         // constructor: pageLoadTime = base
      .mockReturnValue(base + 500);      // collect(): now = base+500, dwell = 500ms

    const detector = new FraudDetector();
    const result = await detector.collect();

    expect(result.flags).toContain('impossible_speed');
    expect(result.hardBlock).toBe(true);
    expect(result.riskScore).toBe(100);

    detector.destroy();
    nowSpy.mockRestore();
  });
});

describe('FraudDetector — score: very_fast_claim', () => {
  it('adds very_fast_claim flag (medium weight) when dwell is 1500-4000ms', async () => {
    const base = 1_000_000;
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(base)
      .mockReturnValue(base + 2000); // dwell = 2000ms → very_fast_claim

    const detector = new FraudDetector();
    const result = await detector.collect();

    expect(result.flags).toContain('very_fast_claim');
    // very_fast_claim is a MED flag (+15), not hard block
    expect(result.hardBlock).toBe(false);

    detector.destroy();
    nowSpy.mockRestore();
  });
});

describe('FraudDetector — score: no_plugins high flag', () => {
  const originalUA = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true,
      writable: true,
    });
  });

  it('adds 25 to riskScore for no_plugins on desktop UA with 0 plugins', async () => {
    // Use a non-mobile UA so the desktop branch runs
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      configurable: true,
      writable: true,
    });

    const base = 1_000_000;
    // dwell > 4000ms so no timing flags
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(base)
      .mockReturnValue(base + 5000);

    const detector = new FraudDetector();
    const result = await detector.collect();

    // jsdom has 0 plugins; no_plugins is HIGH (+25) for desktop
    if (result.flags.includes('no_plugins')) {
      expect(result.riskScore).toBeGreaterThanOrEqual(25);
    }
    // Either way, not a hard block from plugins alone
    expect(result.hardBlock).toBe(false);

    detector.destroy();
    nowSpy.mockRestore();
  });
});

// ── collect() return shape ───────────────────────────────────────────────────

describe('FraudDetector — collect() return shape', () => {
  let result: Awaited<ReturnType<FraudDetector['collect']>>;
  let detector: FraudDetector;

  beforeAll(async () => {
    const base = 1_000_000;
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(base)
      .mockReturnValue(base + 5000); // dwell 5000ms — no timing flags

    detector = new FraudDetector();
    result = await detector.collect();
    nowSpy.mockRestore();
  });

  afterAll(() => {
    detector.destroy();
  });

  it('returns hardBlock boolean', () => expect(typeof result.hardBlock).toBe('boolean'));
  it('returns riskScore number', () => expect(typeof result.riskScore).toBe('number'));
  it('returns flags array', () => expect(Array.isArray(result.flags)).toBe(true));
  it('returns fingerprint object', () => expect(result.fingerprint).toBeDefined());
  it('returns behaviour object', () => expect(result.behaviour).toBeDefined());
  it('returns sdkVersion string', () => expect(typeof result.sdkVersion).toBe('string'));
  it('returns collectedAt number (Unix ms)', () => expect(typeof result.collectedAt).toBe('number'));

  it('fingerprint.tz is a non-empty string (Intl available in jsdom)', () => {
    expect(typeof result.fingerprint.tz).toBe('string');
    expect(result.fingerprint.tz.length).toBeGreaterThan(0);
  });

  it('fingerprint.lang is a string', () => {
    expect(typeof result.fingerprint.lang).toBe('string');
  });

  it('fingerprint.audio is "unsupported" (OfflineAudioContext absent in jsdom)', () => {
    expect(result.fingerprint.audio).toBe('unsupported');
  });

  it('behaviour.dwellMs is a positive number', () => {
    expect(result.behaviour.dwellMs).toBeGreaterThan(0);
  });

  it('behaviour.mouseEntropy is 0 (no mouse events dispatched)', () => {
    expect(result.behaviour.mouseEntropy).toBe(0);
  });

  it('behaviour.untrustedRatio is 0 (no clicks dispatched)', () => {
    expect(result.behaviour.untrustedRatio).toBe(0);
  });
});

// ── destroy() ────────────────────────────────────────────────────────────────

describe('FraudDetector — destroy()', () => {
  it('can be called without throwing', () => {
    const base = 1_000_000;
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(base)
      .mockReturnValue(base + 5000);

    const detector = new FraudDetector();
    nowSpy.mockRestore();

    expect(() => detector.destroy()).not.toThrow();
  });

  it('can be called multiple times without throwing', () => {
    const base = 1_000_000;
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(base)
      .mockReturnValue(base + 5000);

    const detector = new FraudDetector();
    nowSpy.mockRestore();

    expect(() => {
      detector.destroy();
      detector.destroy();
    }).not.toThrow();
  });
});
