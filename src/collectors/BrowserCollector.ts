import type {
  GenerateFingerprintRequest,
  WebGLInfo,
  UserAgentData,
  ConnectionInfo,
} from '../types/fingerprint';

/** All browser-collectable fields — everything except platform, userId, offerId, publisherId, and mobile-specific fields */
export type CollectedWebSignals = Omit<
  GenerateFingerprintRequest,
  | 'platform'
  | 'userId'
  | 'offerId'
  | 'publisherId'
  | 'clickTimestamp'
  | 'fraudSignals'
  | 'mobileInfo'
  | 'gaid'
  | 'idfa'
  | 'advertisingId'
  | 'advertisingIdType'
>;

type NavExtended = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>;
    mobile?: boolean;
    platform?: string;
  };
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
};

/**
 * Collects all available browser signals without any third-party library.
 *
 * Safe to call server-side (returns empty object when `window` is absent).
 * Catches every individual signal so a failed WebGL context or missing
 * permission never aborts the entire collection.
 */
export class BrowserCollector {
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined';
  }

  static async collect(): Promise<CollectedWebSignals> {
    if (!this.isAvailable()) return {};

    const nav = navigator as NavExtended;
    const signals: CollectedWebSignals = {};

    // ── Basic navigator ──────────────────────────────────────────────────
    signals.userAgent = nav.userAgent;
    signals.language = nav.language;
    signals.languages = Array.from(nav.languages ?? [nav.language]).filter(Boolean);
    signals.cookieEnabled = nav.cookieEnabled;
    signals.platformInfo = nav.platform ?? undefined;
    signals.vendor = nav.vendor ?? undefined;

    const dnt = nav.doNotTrack;
    signals.doNotTrack = dnt === '1' ? true : dnt === '0' ? false : null;

    if (nav.hardwareConcurrency) signals.hardwareConcurrency = nav.hardwareConcurrency;
    if (nav.deviceMemory) signals.deviceMemory = nav.deviceMemory;

    // ── User-Agent Client Hints (Chrome / Edge) ──────────────────────────
    if (nav.userAgentData) {
      const uaData: UserAgentData = {};
      if (nav.userAgentData.brands) uaData.brands = nav.userAgentData.brands;
      if (typeof nav.userAgentData.mobile === 'boolean') uaData.mobile = nav.userAgentData.mobile;
      if (nav.userAgentData.platform) uaData.platform = nav.userAgentData.platform;
      signals.userAgentData = uaData;
    }

    // ── Locale / timezone ────────────────────────────────────────────────
    try {
      signals.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch { /* non-fatal */ }
    signals.timezoneOffset = new Date().getTimezoneOffset();

    // ── Screen ───────────────────────────────────────────────────────────
    signals.screen = {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
    };

    signals.isResponsiveMode =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 768px)').matches;

    // ── Storage ──────────────────────────────────────────────────────────
    signals.localStorage = (() => { try { return typeof window.localStorage !== 'undefined'; } catch { return false; } })();
    signals.sessionStorage = (() => { try { return typeof window.sessionStorage !== 'undefined'; } catch { return false; } })();
    signals.indexedDB = typeof window.indexedDB !== 'undefined';

    // ── Touch ────────────────────────────────────────────────────────────
    signals.touchCapability = {
      isTouchDevice: 'ontouchstart' in window || nav.maxTouchPoints > 0,
      maxTouchPoints: nav.maxTouchPoints ?? 0,
    };

    // ── Network (Network Information API) ────────────────────────────────
    if (nav.connection) {
      const conn: ConnectionInfo = {};
      if (nav.connection.effectiveType) conn.effectiveType = nav.connection.effectiveType;
      if (typeof nav.connection.downlink === 'number') conn.downlink = nav.connection.downlink;
      if (typeof nav.connection.rtt === 'number') conn.rtt = nav.connection.rtt;
      signals.connection = conn;
    }

    // ── Plugins ──────────────────────────────────────────────────────────
    const pluginList = Array.from(nav.plugins ?? []);
    if (pluginList.length > 0) {
      // Plugin API is deprecated but still fingerprint-relevant in legacy browsers
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      signals.plugins = pluginList.map((p) => p.filename ?? '').filter(Boolean);
    }

    // ── WebGL ────────────────────────────────────────────────────────────
    signals.webgl = this.collectWebGL();

    // ── Canvas fingerprint ───────────────────────────────────────────────
    signals.canvas = this.collectCanvas();

    // ── Audio fingerprint ────────────────────────────────────────────────
    signals.audio = await this.collectAudio();

    return signals;
  }

  private static collectWebGL(): WebGLInfo | undefined {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

      if (!gl) return undefined;

      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const info: WebGLInfo = {
        version: gl.getParameter(gl.VERSION) as string,
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION) as string,
      };

      if (dbg) {
        info.vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string;
        info.renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
      } else {
        info.vendor = gl.getParameter(gl.VENDOR) as string;
        info.renderer = gl.getParameter(gl.RENDERER) as string;
      }

      return info;
    } catch {
      return undefined;
    }
  }

  private static async collectAudio(): Promise<string | undefined> {
    try {
      const Ctx = (window as unknown as Record<string, unknown>).OfflineAudioContext as
        | (new (channels: number, length: number, sampleRate: number) => OfflineAudioContext)
        | undefined;
      if (!Ctx) return undefined;

      const ctx = new Ctx(1, 44100, 44100);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(10000, ctx.currentTime);

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-50, ctx.currentTime);
      comp.knee.setValueAtTime(40, ctx.currentTime);
      comp.ratio.setValueAtTime(12, ctx.currentTime);
      comp.attack.setValueAtTime(0, ctx.currentTime);
      comp.release.setValueAtTime(0.25, ctx.currentTime);

      osc.connect(comp);
      comp.connect(ctx.destination);
      osc.start(0);

      const buffer = await ctx.startRendering();
      const samples = buffer.getChannelData(0).slice(4500, 5000);
      let hash = 0;
      for (let i = 0; i < samples.length; i++) {
        hash = (Math.imul(31, hash) + (samples[i] * 1e8 | 0)) | 0;
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    } catch {
      return undefined;
    }
  }

  private static collectCanvas(): string | undefined {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;

      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f0f';
      ctx.fillRect(0, 0, 10, 10);
      ctx.font = 'italic 14px Arial, sans-serif';
      ctx.fillStyle = 'rgba(16, 32, 200, 0.9)';
      ctx.fillText('Klink Fingerprint SDK', 4, 20);
      ctx.font = 'bold 11px Courier New, monospace';
      ctx.fillStyle = 'rgba(200, 80, 16, 0.7)';
      ctx.fillText('abcdefghij 0123456789', 4, 38);

      // Return last 80 chars of the data URL — stable renderer signature
      return canvas.toDataURL('image/png').slice(-80);
    } catch {
      return undefined;
    }
  }
}
