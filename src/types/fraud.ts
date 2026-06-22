export interface FraudFingerprint {
  canvas: string;
  audio: string;
  tz: string;
  lang: string;
  screen: string;
  pixelRatio: number;
  cpu: number | null;
  memory: number | null;
  platform: string;
  touchPoints: number;
  connectionType: string | null;
}

export interface FraudBehaviour {
  dwellMs: number;
  mouseEntropy: number;
  untrustedRatio: number;
  keyDeltaVariance: number;
  touchEventCount: number;
}

export interface FraudSignalBundle {
  hardBlock: boolean;
  riskScore: number;
  flags: string[];
  fingerprint: FraudFingerprint;
  behaviour: FraudBehaviour;
  sdkVersion: string;
  collectedAt: number;
}
