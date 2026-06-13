export interface User {
  id: number;
  username: string;
  email: string;
  role: 'administrator' | 'operator' | 'viewer' | 'client';
  auth0_id?: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
}

export interface Client {
  id: number;
  name: string;
  description: string;
  created_at: string;
  scan_count: number;
}

export interface Scan {
  id: number;
  client_id: number;
  target: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  ai_summary: string;
  started_at: string;
  finished_at: string | null;
  hosts: ScanHost[];
}

export interface ScanHost {
  id: number;
  ip: string;
  hostname: string;
  os_guess: string;
  ports: OpenPort[];
}

export interface OpenPort {
  port: number;
  service: string;
  banner: string;
  cve: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  description: string;
  vulnerabilities?: Vulnerability[];
}

export interface Vulnerability {
  cve: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
}

export interface ThreatAlert {
  id: string;
  timestamp: string;
  attack_type: string;
  industry: string;
  region: string;
  severity: number;
  threat_score: number;
  growth_probability: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  explainability: Record<string, number>;
  enrichment: {
    splunk: SplunkData;
    virustotal: VirusTotalData;
  };
}

export interface SplunkData {
  status: string;
  source: string;
  query_time_ms: number;
  total_correlated_events: number;
  matching_rules: string[];
  raw_payloads: string[];
}

export interface VirusTotalData {
  status: string;
  indicator_scanned: string;
  harmless_votes: number;
  malicious_votes: number;
  suspicious_votes: number;
  reputation_rating: 'MALICIOUS' | 'CLEAN' | 'SUSPICIOUS';
  engine_analysis: Record<string, string>;
}

export interface OverviewMetrics {
  totalIncidents: number;
  financialLoss: number;
  lossDelta: number;
  affectedUsers: number;
  usersDelta: number;
}

export interface OverviewData {
  metrics: OverviewMetrics;
  trends: { year: number; attack_count: number }[];
  impact: { year: number; financial_loss_in_million_: number }[];
}

export interface NetworkData {
  protocols: { name: string; value: number }[];
  severities: { name: string; value: number }[];
  locations: { latitude: number; longitude: number }[];
}

export interface IndiaData {
  topState: string;
  states: { state: string; detections: number }[];
  ransomware: { Month: string; Detections: number }[];
}

export interface TablesData {
  actors: ThreatActor[];
  cves: CveData[];
}

export interface ThreatActor {
  group: string;
  type: string;
  risk_level: string;
  attacks: string;
}

export interface CveData {
  cve: string;
  severity: string;
  affected_sector: string;
}

export interface ForecastRequest {
  region: 'Global' | 'India';
  year: number;
  month: string;
}

export interface ForecastData {
  predictedAttacks: number;
  financialRisk: 'Low Risk' | 'Medium Risk' | 'High Risk';
  threatScore: number;
  insights: {
    topSector: string;
    topAttack: string;
    topRegion: string;
    highRiskMonth: string;
  };
}

export interface SystemHealth {
  ip: string;
  firewall: { status: string; secure: boolean; raw: string };
  defender: { status: string; secure: boolean; details?: any; raw?: string };
  network: { established_connections: number; raw: string };
  ai_summary?: string;
}

export interface ChatMessage {
  role: 'user' | 'ai' | 'system';
  content: string;
}

export interface ScanWizardState {
  step: 'target' | 'progress' | 'report';
  clientId: number;
  clientName: string;
}

export interface ActiveScan {
  id: number;
  status: string;
  target: string;
  ai_summary?: string;
  hosts?: ScanHost[];
  started_at?: string;
  finished_at?: string;
}

export interface N8nDispatchResult {
  status: string;
  n8n_status: string;
  message: string;
  routing_simulation: {
    slack_channel: string;
    email_dispatched_to: string;
    workflow_execution_id: string;
  };
}

export interface ThreatPrediction {
  input: ThreatInput;
  predicted_threat_score: number;
  predicted_growth_probability: number;
  predicted_risk_level: string;
  explainability: Record<string, number>;
  recommended_actions: string[];
  enrichments: {
    splunk: SplunkData;
    virustotal: VirusTotalData;
  };
}

export interface ThreatInput {
  attack_type: string;
  industry: string;
  region: string;
  severity: number;
}