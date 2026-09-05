export const providerIds = [
  'supabase',
  'langsmith',
  'supermemory',
  'spacetimedb',
  'browserbase',
] as const;

export type ProviderId = (typeof providerIds)[number];
export type ProviderStatus =
  | 'not_configured'
  | 'configured'
  | 'verified'
  | 'error';

export interface SampleSummary {
  kind: string;
  count: number;
  latestAt?: string;
  sessionId?: string;
  liveViewUrl?: string;
}

export interface ConnectorReceipt {
  provider: ProviderId;
  status: 'verified' | 'ok';
  credentialBoundary: string;
  scope: string[];
  sample: SampleSummary;
  checkedAt: string;
}

export interface ConnectorQueryResult {
  receipt: ConnectorReceipt;
}

export interface ConnectorConfiguration {
  configured: boolean;
  valid: boolean;
}

export interface Connector {
  readonly id: ProviderId;
  readonly name: string;
  readonly credentialBoundary: string;
  readonly scope: string[];
  configuration(): ConnectorConfiguration;
  verify(): Promise<ConnectorReceipt>;
  query(): Promise<ConnectorQueryResult>;
}

export interface SafeProviderStatus {
  provider: ProviderId;
  id: ProviderId;
  name: string;
  configured: boolean;
  status: ProviderStatus;
  credentialBoundary: string;
  scope: string[];
  checkedAt?: string;
  message: string;
  sample?: SampleSummary;
}
