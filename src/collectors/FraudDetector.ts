import type { FraudSignalBundle, FraudFingerprint, FraudBehaviour } from '../types/fraud';

const SDK_VERSION = '1.0.0';

const AUTOMATION_GLOBALS = [
  '__nightmare', 'callPhantom', '_phantom', 'domAutomation',
  'domAutomationController', '_selenium', '__webdriver_script_fn', '__puppeteer__',
] as const;

const EMULATOR_RESOLUTIONS: Array<[number, number, number[]]> = [
  [1080, 1920, [2, 3]],
  [720, 1280, [2, 3]],
  [1440, 2560, [2, 3]],
];

const HARD_BLOCK_FLAGS = new Set(['webdriver', 'impossible_speed', 'untrusted_click']);

const HIGH_FLAGS = new Set([
  'no_plugins', 'fake_chrome', 'emulator', 'low_mouse_entropy',
  'no_touch_events', 'instant_keypress', 'robotic_typing',
]);
const MED_FLAGS = new Set([
  'zero_outer_height', 'fake_mobile', 'ua_touch_mismatch', 'tz_mismatch',
  'emulator_resolution', 'scripted_touch', 'scripted_scroll', 'very_fast_claim',
]);
const LOW_FLAGS = new Set([
  'high_untrusted_ratio', 'emulator_dpr', 'no_mouse_movement',
  'stale_session', 'languages_suspicious',
]);

type Listener = { target: EventTarget; type: string; fn: EventListener };

export class FraudDetector {
  private readonly pageLoadTime: number;
  private readonly phase1Flags: string[] = [];

  // Phase 2 state
  private mouseVectors: Array<{ dx: number; dy: number }> = [];
  private lastMouseX = 0;
  private lastMouseY = 0;
  private touchEvents: Array<{ x: number; y: number }> = [];
  private untrustedClicks = 0;
  private totalClicks = 0;
  private keyTimestamps: number[] = [];
  private scrollPositions: number[] = [];
  private readonly boundListeners: Listener[] = [];

  constructor() {
    this.pageLoadTime = Date.now();
    if (typeof window === 'undefined') return;
    this.runPhase1();
    this.attachListeners();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private isMobile(): boolean {
    try { return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent); }
    catch { return false; }
  }

  private on(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn, { passive: true });
    this.boundListeners.push({ target, type, fn });
  }

  // ── Phase 1: Instant hard checks ────────────────────────────────────────────

  private runPhase1(): void {
    try { if (navigator.webdriver) this.phase1Flags.push('webdriver'); } catch { /* */ }

    try {
      if (!this.isMobile()) {
        if ((navigator.plugins?.length ?? 0) === 0) this.phase1Flags.push('no_plugins');
        if (window.outerHeight === 0) this.phase1Flags.push('zero_outer_height');
        if (/Chrome/.test(navigator.userAgent) && !('chrome' in window)) {
          this.phase1Flags.push('fake_chrome');
        }
      }
    } catch { /* */ }

    try {
      const w = window as unknown as Record<string, unknown>;
      for (const g of AUTOMATION_GLOBALS) {
        if (g in w) this.phase1Flags.push(`bot_global:${g}`);
      }
    } catch { /* */ }

    try {
      if (navigator.platform === 'Linux armv8l' && navigator.maxTouchPoints === 0) {
        this.phase1Flags.push('emulator');
      }
      if (screen.width < 100 || screen.height < 100) this.phase1Flags.push('tiny_screen');
      if (this.isMobile() && navigator.maxTouchPoints === 0) this.phase1Flags.push('fake_mobile');
    } catch { /* */ }
  }

  // ── Phase 2: Passive behaviour listeners ─────────────────────────────────────

  private attachListeners(): void {
    try {
      this.on(window, 'mousemove', (e) => {
        try {
          const { clientX: x, clientY: y } = e as MouseEvent;
          this.mouseVectors.push({ dx: x - this.lastMouseX, dy: y - this.lastMouseY });
          if (this.mouseVectors.length > 200) this.mouseVectors.shift();
          this.lastMouseX = x;
          this.lastMouseY = y;
        } catch { /* */ }
      });

      const onTouch = (e: Event) => {
        try {
          const t = (e as TouchEvent).touches[0];
          if (t) this.touchEvents.push({ x: t.clientX, y: t.clientY });
        } catch { /* */ }
      };
      this.on(window, 'touchstart', onTouch);
      this.on(window, 'touchmove', onTouch);
      this.on(window, 'touchend', onTouch);

      this.on(window, 'click', (e) => {
        try {
          this.totalClicks++;
          if (!(e as MouseEvent).isTrusted) this.untrustedClicks++;
        } catch { /* */ }
      });

      this.on(window, 'keydown', () => {
        try { this.keyTimestamps.push(Date.now()); } catch { /* */ }
      });

      this.on(window, 'scroll', () => {
        try { this.scrollPositions.push(window.scrollY); } catch { /* */ }
      });
    } catch { /* */ }
  }

  // ── Phase 2 metrics ──────────────────────────────────────────────────────────

  private mouseEntropy(): number {
    try {
      const active = this.mouseVectors.filter(v => v.dx !== 0 || v.dy !== 0);
      if (!active.length) return 0;
      const angles = active.map(v => Math.atan2(v.dy, v.dx));
      const mean = angles.reduce((s, a) => s + a, 0) / angles.length;
      const variance = angles.reduce((s, a) => s + (a - mean) ** 2, 0) / angles.length;
      // Normalise: max variance for uniform [-π, π] ≈ π²/3
      return Math.min(variance / (Math.PI * Math.PI / 3), 1);
    } catch { return 0; }
  }

  private keyVariance(): number {
    try {
      if (this.keyTimestamps.length < 2) return 0;
      const deltas = this.keyTimestamps.slice(1).map((t, i) => t - this.keyTimestamps[i]);
      const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
      return deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length;
    } catch { return 0; }
  }

  private behaviourFlags(): string[] {
    const flags: string[] = [];
    const mobile = this.isMobile();

    try {
      if (!mobile) {
        if (!this.mouseVectors.length) flags.push('no_mouse_movement');
        else if (this.mouseEntropy() < 0.3) flags.push('low_mouse_entropy');
      }
    } catch { /* */ }

    try {
      if (mobile) {
        if (!this.touchEvents.length) {
          flags.push('no_touch_events');
        } else if (this.touchEvents.length >= 3) {
          const unique = new Set(this.touchEvents.map(t => `${t.x},${t.y}`));
          if (unique.size < this.touchEvents.length * 0.5) flags.push('scripted_touch');
        }
      }
    } catch { /* */ }

    try {
      if (this.untrustedClicks > 0) flags.push('untrusted_click');
      if (this.totalClicks > 0 && this.untrustedClicks / this.totalClicks > 0.3) {
        flags.push('high_untrusted_ratio');
      }
    } catch { /* */ }

    try {
      if (this.keyTimestamps.length >= 2) {
        const deltas = this.keyTimestamps.slice(1).map((t, i) => t - this.keyTimestamps[i]);
        if (deltas.some(d => d === 0)) flags.push('instant_keypress');
        if (this.keyVariance() < 2) flags.push('robotic_typing');
      }
    } catch { /* */ }

    try {
      if (this.scrollPositions.length >= 2) {
        const jumps = this.scrollPositions.slice(1).map((s, i) => Math.abs(s - this.scrollPositions[i]));
        if (jumps.some(j => j > 2000)) flags.push('scripted_scroll');
      }
    } catch { /* */ }

    return flags;
  }

  // ── Phase 3: Fingerprint assembly ────────────────────────────────────────────

  private async buildFingerprint(): Promise<{ fp: FraudFingerprint; fpFlags: string[] }> {
    const fpFlags: string[] = [];
    let canvas = 'blocked';
    let audio = 'unsupported';
    let tz = '', lang = '', screenStr = '', platform = '';
    let pixelRatio = 1, touchPoints = 0;
    let cpu: number | null = null;
    let memory: number | null = null;
    let connectionType: string | null = null;

    // Canvas fingerprint
    try {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 50;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.font = '11pt Arial';
        ctx.fillText('Klink 🔐 fraud check', 2, 15);
        ctx.fillStyle = 'rgba(102,204,0,0.7)';
        ctx.font = '18pt Georgia';
        ctx.fillText('Klink', 4, 45);
        canvas = c.toDataURL('image/png').slice(-100);
      }
    } catch { /* privacy mode or blocked */ }

    // Audio fingerprint
    try {
      const Ctx = (window as unknown as Record<string, unknown>).OfflineAudioContext as
        | (new (ch: number, len: number, sr: number) => OfflineAudioContext) | undefined;
      if (Ctx) {
        const actx = new Ctx(1, 44100, 44100);
        const osc = actx.createOscillator();
        const analyser = actx.createAnalyser();
        const gain = actx.createGain();
        gain.gain.setValueAtTime(0, actx.currentTime);
        osc.connect(analyser);
        analyser.connect(gain);
        gain.connect(actx.destination);
        osc.start(0);
        const buf = await actx.startRendering();
        const data = buf.getChannelData(0).slice(0, 100);
        audio = data.reduce((s, v) => s + Math.abs(v), 0).toFixed(10);
      }
    } catch { /* unsupported */ }

    // Device properties
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* */ }
    try { lang = navigator.language; } catch { /* */ }
    try { screenStr = `${screen.width}x${screen.height}x${screen.colorDepth}`; } catch { /* */ }
    try { pixelRatio = window.devicePixelRatio; } catch { /* */ }
    try { cpu = navigator.hardwareConcurrency ?? null; } catch { /* */ }
    try {
      memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null;
    } catch { /* */ }
    try { platform = navigator.platform; } catch { /* */ }
    try { touchPoints = navigator.maxTouchPoints; } catch { /* */ }
    try {
      connectionType = (navigator as Navigator & {
        connection?: { effectiveType?: string };
      }).connection?.effectiveType ?? null;
    } catch { /* */ }

    // Consistency checks
    const mobile = this.isMobile();
    try { if (mobile && touchPoints === 0) fpFlags.push('ua_touch_mismatch'); } catch { /* */ }
    try { if (!tz) fpFlags.push('tz_mismatch'); } catch { /* */ }
    try { if (mobile && pixelRatio === 1.0) fpFlags.push('emulator_dpr'); } catch { /* */ }
    try {
      const dpr = Math.round(pixelRatio);
      for (const [ew, eh, dprs] of EMULATOR_RESOLUTIONS) {
        if (screen.width === ew && screen.height === eh && dprs.includes(dpr)) {
          fpFlags.push('emulator_resolution'); break;
        }
      }
    } catch { /* */ }
    try {
      const langs = navigator.languages;
      if (!langs || langs.length === 1) {
        if (!/[_-]/.test(langs?.[0] ?? '')) fpFlags.push('languages_suspicious');
      }
    } catch { /* */ }

    return {
      fp: { canvas, audio, tz, lang, screen: screenStr, pixelRatio, cpu, memory, platform, touchPoints, connectionType },
      fpFlags,
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async collect(): Promise<FraudSignalBundle> {
    const now = Date.now();
    const dwellMs = now - this.pageLoadTime;

    const flags: string[] = [...this.phase1Flags, ...this.behaviourFlags()];
    const { fp, fpFlags } = await this.buildFingerprint();
    flags.push(...fpFlags);

    // Phase 4: timing
    if (dwellMs < 1500) flags.push('impossible_speed');
    else if (dwellMs < 4000) flags.push('very_fast_claim');
    if (dwellMs > 3_600_000) flags.push('stale_session');

    const uniqueFlags = [...new Set(flags)];
    const hardBlock = uniqueFlags.some(f => HARD_BLOCK_FLAGS.has(f) || f.startsWith('bot_global:'));

    // Phase 5: risk score
    let riskScore = 0;
    if (hardBlock) {
      riskScore = 100;
    } else {
      let highCount = 0;
      for (const f of uniqueFlags) {
        if (HIGH_FLAGS.has(f) && highCount < 2) { riskScore += 25; highCount++; }
        else if (MED_FLAGS.has(f)) riskScore += 15;
        else if (LOW_FLAGS.has(f)) riskScore += 8;
      }
      riskScore = Math.min(riskScore, 99);
    }

    const behaviour: FraudBehaviour = {
      dwellMs,
      mouseEntropy: this.mouseEntropy(),
      untrustedRatio: this.totalClicks > 0 ? this.untrustedClicks / this.totalClicks : 0,
      keyDeltaVariance: this.keyVariance(),
      touchEventCount: this.touchEvents.length,
    };

    return { hardBlock, riskScore, flags: uniqueFlags, fingerprint: fp, behaviour, sdkVersion: SDK_VERSION, collectedAt: now };
  }

  destroy(): void {
    try {
      for (const { target, type, fn } of this.boundListeners) {
        target.removeEventListener(type, fn);
      }
      this.boundListeners.length = 0;
    } catch { /* */ }
  }
}
