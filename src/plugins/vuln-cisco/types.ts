export interface SeveritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface VulnDevice {
  id: string;
  hostname: string;
  ip: string;
  snmpCommunity?: string;
  lastScanAt?: string;
  lastSeverity?: SeveritySummary;
}

export interface ScanEntry {
  timestamp: string;
  status: 'complete' | 'failed';
  severity: SeveritySummary;
  deviceInfo?: {
    hostname: string;
    platform: string;
    version: string;
    model: string;
  };
  totalFindings: number;
}

export interface ScanStatus {
  scanId: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  device: string;
  resultPath?: string;
}

export interface DeviceSummary {
  device: string;
  hostname?: string;
  lastScan?: string;
  severity?: SeveritySummary;
  scanCount: number;
}
