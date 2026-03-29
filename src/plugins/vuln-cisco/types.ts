export interface SeveritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface VulnDevice {
  id: string;
  viewId: string;
  hostname: string;
  ip: string;
  snmpCommunity?: string;
  snmpSecretKey?: string;
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

/** Tracks an in-flight scan — lives in Zustand (not persisted) so it survives component unmount. */
export interface ActiveScan {
  scanId: string;
  device: VulnDevice;
  status: ScanStatus;
  startedAt: number; // Date.now() — used to compute elapsed time on remount
}
