export type BotType = 'good_bot' | 'bad_bot' | 'suspicious' | 'unknown';
export type BotAction = 'ALLOW' | 'REVIEW' | 'BLOCK';

export interface CloudflareSignals {
  botScore?: number;
  threatScore?: number;
  ray?: string;
  country?: string;
  deviceType?: string;
}

export interface BehavioralSignals {
  suspiciousUserAgent: boolean;
  headlessBrowser: boolean;
  automationTool: boolean;
  knownBotPattern: boolean;
  missingBrowserSignals?: boolean;
  suspiciousAcceptHeaders?: boolean;
  noJavaScriptIndicators?: boolean;
  suspiciousConnectionPattern?: boolean;
}

export interface BotDetectionResult {
  isBot: boolean;
  botType: BotType;
  /** 0–100: 100 means definitely human */
  confidence: number;
  /** 0–100: higher = more risky */
  riskScore: number;
  detectionMethods: string[];
  botName?: string;
  fraudScore?: number;
  fraudSignals?: string[];
  action: BotAction;
  cloudflareData?: CloudflareSignals;
  behavioralSignals?: BehavioralSignals;
  recommendations?: string[];
  platform?: string;
}

export interface AnalyzeBotData {
  isBot: boolean;
  botType: BotType;
  confidence: number;
  detectionMethods: string[];
  riskScore: number;
  fraudScore: number;
  fraudSignals: string[];
  action: BotAction;
  platform?: string;
  cloudflareData?: CloudflareSignals;
  behavioralSignals?: BehavioralSignals;
  recommendations?: string[];
}
