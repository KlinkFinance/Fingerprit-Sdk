export interface HealthData {
  success: boolean;
  message: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

export interface DatabaseStatus {
  connected: boolean;
  status: string;
  name?: string;
}

export interface StatusData {
  success: boolean;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  database: DatabaseStatus;
  uptime: number;
  environment: string;
  version?: string;
  timestamp: string;
}

export interface ReadinessData {
  success: boolean;
  message: string;
}

export interface LivenessData {
  success: boolean;
  message: string;
  uptime: number;
}
