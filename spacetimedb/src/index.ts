import {
  schema,
  table,
  t,
  SenderError,
  type InferSchema,
  type ProcedureCtx,
  type ReducerCtx,
} from 'spacetimedb/server';

const incident_room = table(
  { name: 'incident_room', public: true },
  {
    room_id: t.string().primaryKey(),
    title: t.string(),
    severity: t.string(),
    status: t.string(),
    created_at: t.timestamp(),
  }
);

const participant = table(
  { name: 'participant', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    room_id: t.string().index('btree'),
    identity: t.identity(),
    display_name: t.string(),
    role: t.string(),
    online: t.bool(),
    joined_at: t.timestamp(),
  }
);

const transcript_segment = table(
  { name: 'transcript_segment', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    room_id: t.string().index('btree'),
    sequence: t.u32(),
    speaker: t.string(),
    text: t.string(),
    relevant: t.bool(),
    created_at: t.timestamp(),
  }
);

const investigation_request = table(
  { name: 'investigation_request', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    room_id: t.string().index('btree'),
    source_segment_id: t.u64(),
    prompt: t.string(),
    target_service: t.string(),
    window_minutes: t.u32(),
    constraints: t.string(),
    status: t.string(),
    requested_by: t.identity(),
    approved_by: t.option(t.identity()),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const approval = table(
  { name: 'approval', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    request_id: t.u64().index('btree'),
    actor: t.identity(),
    decision: t.string(),
    created_at: t.timestamp(),
  }
);

const agent_step = table(
  { name: 'agent_step', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    request_id: t.u64().index('btree'),
    sequence: t.u32(),
    label: t.string(),
    detail: t.string(),
    status: t.string(),
    screenshot_ref: t.string(),
    created_at: t.timestamp(),
  }
);

const evidence = table(
  { name: 'evidence', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    request_id: t.u64().index('btree'),
    kind: t.string(),
    headline: t.string(),
    detail: t.string(),
    value: t.string(),
    created_at: t.timestamp(),
  }
);

const conclusion = table(
  { name: 'conclusion', public: true },
  {
    request_id: t.u64().primaryKey(),
    summary: t.string(),
    confidence: t.string(),
    recommendation: t.string(),
    status: t.string(),
    created_at: t.timestamp(),
  }
);

const timeline_event = table(
  { name: 'timeline_event', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    room_id: t.string().index('btree'),
    event_type: t.string(),
    actor: t.string(),
    body: t.string(),
    created_at: t.timestamp(),
  }
);

// Deliberately private: clients cannot query or subscribe to this table. A
// signed-in user can interact with only their own row through the procedures
// below, and no procedure ever returns the stored credential.
const connector_credential = table(
  { name: 'connector_credential' },
  {
    id: t.string().primaryKey(),
    owner: t.identity().index('btree'),
    provider: t.string().index('btree'),
    secret_json: t.string(),
    settings_json: t.string(),
    status: t.string(),
    sample_json: t.string(),
    created_at: t.timestamp(),
    checked_at: t.timestamp(),
  }
);

const connector_request_gate = table(
  { name: 'connector_request_gate' },
  {
    id: t.string().primaryKey(),
    owner: t.identity().index('btree'),
    provider: t.string(),
    last_attempt_at: t.timestamp(),
  }
);

const spacetimedb = schema({
  incident_room,
  participant,
  transcript_segment,
  investigation_request,
  approval,
  agent_step,
  evidence,
  conclusion,
  timeline_event,
  connector_credential,
  connector_request_gate,
});

export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;
type ConnectorProcedureCtx = ProcedureCtx<InferSchema<typeof spacetimedb>>;

const SPACETIME_AUTH_ISSUER = 'https://auth.spacetimedb.com/oidc';
const SPACETIME_AUTH_AUDIENCE = 'client_034JamHgZLHqWf7dD3qIdh';

export const onConnect = spacetimedb.clientConnected(ctx => {
  const jwt = ctx.senderAuth.jwt;
  if (!jwt) {
    throw new SenderError('Sign in with SpacetimeAuth before connecting.');
  }
  if (jwt.issuer !== SPACETIME_AUTH_ISSUER) {
    throw new SenderError('Connection token has an untrusted issuer.');
  }
  if (!jwt.audience.includes(SPACETIME_AUTH_AUDIENCE)) {
    throw new SenderError('Connection token is not intended for this application.');
  }
});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  const connectedRows = [...ctx.db.participant.iter()].filter(row =>
    row.identity.isEqual(ctx.sender) && row.online
  );
  for (const row of connectedRows) {
    ctx.db.participant.id.update({ ...row, online: false });
  }
});

type VaultProvider = 'supabase' | 'langsmith';
type ConnectorSample = {
  kind: string;
  count: number;
  latestAt?: string;
  project?: string;
  table?: string;
};

const SUPABASE_PROJECT_REF = /^[a-z0-9]{8,64}$/;
const SCHEMA_TABLE = /^[a-z_][a-z0-9_]{0,62}\.[a-z_][a-z0-9_]{0,62}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LANGSMITH_ENDPOINTS: Record<string, string> = {
  us: 'https://api.smith.langchain.com',
  eu: 'https://eu.api.smith.langchain.com',
  apac: 'https://apac.api.smith.langchain.com',
  aws_us: 'https://aws.api.smith.langchain.com',
};

function credentialId(ctx: ConnectorProcedureCtx, provider: VaultProvider) {
  return `${ctx.sender.toHexString()}:${provider}`;
}

function takeConnectorRequestSlot(
  ctx: ConnectorProcedureCtx,
  provider: VaultProvider
) {
  const id = credentialId(ctx, provider);
  ctx.withTx(tx => {
    const existing = tx.db.connector_request_gate.id.find(id);
    if (
      existing &&
      tx.timestamp.microsSinceUnixEpoch - existing.last_attempt_at.microsSinceUnixEpoch < 2_000_000n
    ) {
      throw new SenderError('Wait two seconds before running another provider check.');
    }
    const row = {
      id,
      owner: ctx.sender,
      provider,
      last_attempt_at: tx.timestamp,
    };
    if (existing) tx.db.connector_request_gate.id.update(row);
    else tx.db.connector_request_gate.insert(row);
  });
}

function safeJson(value: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // The generic error below deliberately avoids returning stored material.
  }
  throw new SenderError(`${label} connection data is invalid. Reconnect it.`);
}

function assertCredential(value: string, provider: string) {
  const clean = value.trim();
  if (clean.length < 8 || clean.length > 4096 || /[\r\n]/.test(clean)) {
    throw new SenderError(`${provider} credential is not valid.`);
  }
  return clean;
}

function providerJson(
  ctx: ConnectorProcedureCtx,
  provider: string,
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string }
) {
  let response;
  try {
    response = ctx.http.fetch(url, init);
  } catch {
    throw new SenderError(`${provider} could not be reached.`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SenderError(`${provider} rejected the credential or its access scope.`);
    }
    throw new SenderError(`${provider} could not complete the bounded read (HTTP ${response.status}).`);
  }

  const text = response.text();
  if (!text) return null;
  if (text.length > 524_288) {
    throw new SenderError(`${provider} returned more data than the bounded read permits.`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SenderError(`${provider} returned an invalid response.`);
  }
}

function recordsFrom(value: unknown, candidateKeys: string[]) {
  const records = (candidate: unknown) =>
    Array.isArray(candidate)
      ? candidate.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item)) as Record<string, unknown>[]
      : [];
  if (Array.isArray(value)) return records(value);
  if (typeof value !== 'object' || value === null) return [];
  const object = value as Record<string, unknown>;
  for (const key of candidateKeys) {
    const rows = records(object[key]);
    if (rows.length || Array.isArray(object[key])) return rows;
  }
  return [];
}

function firstIsoDate(rows: Record<string, unknown>[], keys: string[]) {
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value !== 'string') continue;
      const timestamp = new Date(value);
      if (!Number.isNaN(timestamp.getTime())) return timestamp.toISOString();
    }
  }
  return undefined;
}

function quoteSchemaTable(value: string) {
  if (!SCHEMA_TABLE.test(value)) {
    throw new SenderError('Use a schema-qualified Supabase table such as public.proactive_events.');
  }
  const [schemaName, tableName] = value.split('.');
  return `"${schemaName}"."${tableName}"`;
}

function readSupabase(
  ctx: ConnectorProcedureCtx,
  accessToken: string,
  projectRef: string,
  sourceTable: string,
  limit: 1 | 5
): ConnectorSample {
  const projection = '"occurred_at"';
  const ordering = ' order by "occurred_at" desc';
  const raw = providerJson(
    ctx,
    'Supabase',
    `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query/read-only`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: `select ${projection} from ${quoteSchemaTable(sourceTable)}${ordering} limit $1`,
        parameters: [limit],
      }),
    }
  );
  const rows = recordsFrom(raw, ['result', 'data', 'rows']).slice(0, limit);
  const latestAt = firstIsoDate(rows, ['occurred_at']);
  return {
    kind: limit === 1 ? 'configured-table-access' : 'recent-events',
    count: rows.length,
    table: sourceTable,
    ...(latestAt ? { latestAt } : {}),
  };
}

function readLangSmith(
  ctx: ConnectorProcedureCtx,
  apiKey: string,
  workspaceId: string,
  projectId: string,
  region: string,
  limit: 1 | 5
): ConnectorSample {
  const endpoint = LANGSMITH_ENDPOINTS[region];
  if (!endpoint) throw new SenderError('Choose a supported LangSmith cloud region.');
  const now = ctx.timestamp.toDate();
  const minimum = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const raw = providerJson(ctx, 'LangSmith', `${endpoint}/api/v2/runs/query`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'x-tenant-id': workspaceId,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      project_ids: [projectId],
      min_start_time: minimum.toISOString(),
      max_start_time: now.toISOString(),
      page_size: limit,
      selects: ['ID', 'START_TIME'],
    }),
  });
  const rows = recordsFrom(raw, ['runs', 'items', 'data']).slice(0, limit);
  const latestAt = firstIsoDate(rows, ['start_time', 'startTime']);
  return {
    kind: limit === 1 ? 'configured-project-access' : 'recent-run-metadata',
    count: rows.length,
    project: projectId,
    ...(latestAt ? { latestAt } : {}),
  };
}

function providerBoundary(provider: VaultProvider) {
  return provider === 'supabase'
    ? 'provider read-only database role + fixed table query'
    : 'workspace service key + fixed project metadata query';
}

function providerScope(provider: VaultProvider) {
  return provider === 'supabase'
    ? ['database:read', 'configured table only', 'maximum 5 rows']
    : ['projects:read', 'runs:read', 'configured project only', 'maximum 5 rows'];
}

function receipt(
  provider: VaultProvider | 'spacetimedb',
  checkedAt: string,
  sample: ConnectorSample,
  status = 'verified'
) {
  if (provider === 'spacetimedb') {
    return {
      provider,
      configured: true,
      status,
      credentialBoundary: 'signed-in SpacetimeAuth identity + private per-user connector vault',
      scope: ['own connector records', 'private credential table', 'live room state'],
      checkedAt,
      message: 'Realtime control plane linked to this signed-in identity.',
      sample,
    };
  }
  return {
    provider,
    configured: true,
    status,
    credentialBoundary: providerBoundary(provider),
    scope: providerScope(provider),
    checkedAt,
    message: status === 'verified'
      ? 'Read-only access verified.'
      : 'The saved connection needs attention.',
    sample,
  };
}

function missingReceipt(provider: VaultProvider) {
  return {
    provider,
    configured: false,
    status: 'not_configured',
    credentialBoundary: providerBoundary(provider),
    scope: providerScope(provider),
    message: 'Connect this source to verify a bounded read.',
  };
}

function readSavedConnector(ctx: ConnectorProcedureCtx, provider: VaultProvider) {
  return ctx.withTx(tx => tx.db.connector_credential.id.find(credentialId(ctx, provider)));
}

function runSavedConnector(
  ctx: ConnectorProcedureCtx,
  provider: VaultProvider,
  limit: 1 | 5
) {
  const row = readSavedConnector(ctx, provider);
  if (!row) throw new SenderError(`${provider === 'supabase' ? 'Supabase' : 'LangSmith'} is not connected.`);
  const secret = safeJson(row.secret_json, provider);
  const settings = safeJson(row.settings_json, provider);
  if (provider === 'supabase') {
    return readSupabase(
      ctx,
      String(secret.accessToken ?? ''),
      String(settings.projectRef ?? ''),
      String(settings.sourceTable ?? ''),
      limit
    );
  }
  return readLangSmith(
    ctx,
    String(secret.apiKey ?? ''),
    String(settings.workspaceId ?? ''),
    String(settings.projectId ?? ''),
    String(settings.region ?? ''),
    limit
  );
}

function saveConnector(
  ctx: ConnectorProcedureCtx,
  provider: VaultProvider,
  secretJson: string,
  settingsJson: string,
  sample: ConnectorSample
) {
  const id = credentialId(ctx, provider);
  ctx.withTx(tx => {
    const existing = tx.db.connector_credential.id.find(id);
    const row = {
      id,
      owner: ctx.sender,
      provider,
      secret_json: secretJson,
      settings_json: settingsJson,
      status: 'verified',
      sample_json: JSON.stringify(sample),
      created_at: existing?.created_at ?? tx.timestamp,
      checked_at: tx.timestamp,
    };
    if (existing) tx.db.connector_credential.id.update(row);
    else tx.db.connector_credential.insert(row);
  });
}

function markConnector(
  ctx: ConnectorProcedureCtx,
  provider: VaultProvider,
  status: 'verified' | 'error',
  sample?: ConnectorSample
) {
  ctx.withTx(tx => {
    const id = credentialId(ctx, provider);
    const existing = tx.db.connector_credential.id.find(id);
    if (!existing) return;
    tx.db.connector_credential.id.update({
      ...existing,
      status,
      sample_json: sample ? JSON.stringify(sample) : existing.sample_json,
      checked_at: tx.timestamp,
    });
  });
}

export const listConnectorConnections = spacetimedb.procedure(
  t.string(),
  ctx => {
    const rows = ctx.withTx(tx => [...tx.db.connector_credential.owner.filter(ctx.sender)]);
    const byProvider = new Map(rows.map(row => [row.provider, row]));
    const providerStatus = (provider: VaultProvider) => {
      const row = byProvider.get(provider);
      if (!row) return missingReceipt(provider);
      let sample: ConnectorSample = { kind: 'saved-connection', count: 0 };
      try {
        sample = JSON.parse(row.sample_json) as ConnectorSample;
      } catch {
        // A safe placeholder is enough; verification can rewrite the receipt.
      }
      return receipt(provider, row.checked_at.toISOString(), sample, row.status);
    };
    const roomCount = ctx.withTx(tx => [...tx.db.incident_room.iter()].length);
    return JSON.stringify({
      providers: [
        providerStatus('supabase'),
        providerStatus('langsmith'),
        receipt(
          'spacetimedb',
          ctx.timestamp.toISOString(),
          { kind: 'realtime-control-plane', count: roomCount }
        ),
      ],
      message: 'Per-user connector vault online',
    });
  }
);

export const connectSupabase = spacetimedb.procedure(
  { accessToken: t.string(), projectRef: t.string(), sourceTable: t.string() },
  t.string(),
  (ctx, { accessToken, projectRef, sourceTable }) => {
    const token = assertCredential(accessToken, 'Supabase');
    const project = projectRef.trim();
    const tableName = sourceTable.trim().toLowerCase();
    if (!token.startsWith('sbp_fc')) {
      throw new SenderError('Use a scoped Supabase token beginning sbp_fc with Database Read on this project. Classic PATs and project keys are not accepted.');
    }
    if (!SUPABASE_PROJECT_REF.test(project)) {
      throw new SenderError('Supabase project ref is not valid.');
    }
    if (!SCHEMA_TABLE.test(tableName)) {
      throw new SenderError('Use a schema-qualified table such as public.proactive_events.');
    }
    takeConnectorRequestSlot(ctx, 'supabase');
    const sample = readSupabase(ctx, token, project, tableName, 1);
    saveConnector(
      ctx,
      'supabase',
      JSON.stringify({ accessToken: token }),
      JSON.stringify({ projectRef: project, sourceTable: tableName }),
      sample
    );
    return JSON.stringify(receipt('supabase', ctx.timestamp.toISOString(), sample));
  }
);

export const connectLangsmith = spacetimedb.procedure(
  {
    apiKey: t.string(),
    workspaceId: t.string(),
    projectId: t.string(),
    region: t.string(),
  },
  t.string(),
  (ctx, { apiKey, workspaceId, projectId, region }) => {
    const key = assertCredential(apiKey, 'LangSmith');
    const workspace = workspaceId.trim();
    const project = projectId.trim();
    const regionId = region.trim().toLowerCase();
    if (!UUID.test(workspace)) throw new SenderError('LangSmith workspace ID is not valid.');
    if (!UUID.test(project)) throw new SenderError('LangSmith project ID is not valid.');
    if (!LANGSMITH_ENDPOINTS[regionId]) throw new SenderError('Choose a supported LangSmith cloud region.');
    takeConnectorRequestSlot(ctx, 'langsmith');
    const sample = readLangSmith(ctx, key, workspace, project, regionId, 1);
    saveConnector(
      ctx,
      'langsmith',
      JSON.stringify({ apiKey: key }),
      JSON.stringify({ workspaceId: workspace, projectId: project, region: regionId }),
      sample
    );
    return JSON.stringify(receipt('langsmith', ctx.timestamp.toISOString(), sample));
  }
);

export const verifyConnectorConnection = spacetimedb.procedure(
  { provider: t.string() },
  t.string(),
  (ctx, { provider: rawProvider }) => {
    if (rawProvider === 'spacetimedb') {
      const roomCount = ctx.withTx(tx => [...tx.db.incident_room.iter()].length);
      return JSON.stringify(receipt(
        'spacetimedb',
        ctx.timestamp.toISOString(),
        { kind: 'realtime-control-plane', count: roomCount }
      ));
    }
    if (rawProvider !== 'supabase' && rawProvider !== 'langsmith') {
      throw new SenderError('That connector is not available for self-service setup.');
    }
    const provider = rawProvider as VaultProvider;
    try {
      takeConnectorRequestSlot(ctx, provider);
      const sample = runSavedConnector(ctx, provider, 1);
      markConnector(ctx, provider, 'verified', sample);
      return JSON.stringify(receipt(provider, ctx.timestamp.toISOString(), sample));
    } catch (error) {
      markConnector(ctx, provider, 'error');
      throw error;
    }
  }
);

export const sampleConnectorConnection = spacetimedb.procedure(
  { provider: t.string() },
  t.string(),
  (ctx, { provider: rawProvider }) => {
    if (rawProvider === 'spacetimedb') {
      const roomCount = ctx.withTx(tx => [...tx.db.incident_room.iter()].length);
      return JSON.stringify(receipt(
        'spacetimedb',
        ctx.timestamp.toISOString(),
        { kind: 'realtime-control-plane', count: Math.min(roomCount, 5) }
      ));
    }
    if (rawProvider !== 'supabase' && rawProvider !== 'langsmith') {
      throw new SenderError('That connector is not available for self-service setup.');
    }
    const provider = rawProvider as VaultProvider;
    try {
      takeConnectorRequestSlot(ctx, provider);
      const sample = runSavedConnector(ctx, provider, 5);
      markConnector(ctx, provider, 'verified', sample);
      return JSON.stringify(receipt(provider, ctx.timestamp.toISOString(), sample));
    } catch (error) {
      markConnector(ctx, provider, 'error');
      throw error;
    }
  }
);

export const disconnectConnectorConnection = spacetimedb.procedure(
  { provider: t.string() },
  t.string(),
  (ctx, { provider: rawProvider }) => {
    if (rawProvider !== 'supabase' && rawProvider !== 'langsmith') {
      throw new SenderError('The SpacetimeDB control plane stays linked to your signed-in identity.');
    }
    const provider = rawProvider as VaultProvider;
    ctx.withTx(tx => {
      const id = credentialId(ctx, provider);
      tx.db.connector_credential.id.delete(id);
      tx.db.connector_request_gate.id.delete(id);
    });
    return JSON.stringify(missingReceipt(provider));
  }
);

function addTimeline(
  ctx: Ctx,
  roomId: string,
  eventType: string,
  actor: string,
  body: string
) {
  ctx.db.timeline_event.insert({
    id: 0n,
    room_id: roomId,
    event_type: eventType,
    actor,
    body,
    created_at: ctx.timestamp,
  });
}

function requireRoom(ctx: Ctx, roomId: string) {
  const room = ctx.db.incident_room.room_id.find(roomId);
  if (!room) throw new SenderError('Incident room not found.');
  return room;
}

function requireRequest(ctx: Ctx, requestId: bigint) {
  const request = ctx.db.investigation_request.id.find(requestId);
  if (!request) throw new SenderError('Investigation request not found.');
  return request;
}

function requireParticipant(ctx: Ctx, roomId: string) {
  const person = [...ctx.db.participant.room_id.filter(roomId)].find(
    row => row.identity.isEqual(ctx.sender) && row.online
  );
  if (!person) throw new SenderError('Join the incident room before changing it.');
  return person;
}

function requireCommander(ctx: Ctx, roomId: string) {
  const person = requireParticipant(ctx, roomId);
  if (person.role !== 'Incident commander') {
    throw new SenderError('Only the incident commander can approve or stop an investigation.');
  }
  return person;
}

export const createDemoRoom = spacetimedb.reducer(
  { roomId: t.string(), title: t.string() },
  (ctx, { roomId, title }) => {
    if (ctx.db.incident_room.room_id.find(roomId)) return;
    ctx.db.incident_room.insert({
      room_id: roomId,
      title,
      severity: 'SEV-1',
      status: 'investigating',
      created_at: ctx.timestamp,
    });
    addTimeline(ctx, roomId, 'room_created', 'Proactive', 'Incident room opened');
  }
);

export const joinRoom = spacetimedb.reducer(
  { roomId: t.string(), displayName: t.string(), role: t.string() },
  (ctx, { roomId, displayName, role }) => {
    requireRoom(ctx, roomId);
    const cleanName = displayName.trim();
    if (!cleanName) throw new SenderError('Display name is required.');
    if (!['Incident commander', 'Responder', 'Observer'].includes(role)) {
      throw new SenderError('Unknown incident-room role.');
    }

    const existing = [...ctx.db.participant.room_id.filter(roomId)].find(row =>
      row.identity.isEqual(ctx.sender)
    );
    if (existing) {
      ctx.db.participant.id.update({
        ...existing,
        display_name: cleanName,
        role,
        online: true,
      });
    } else {
      ctx.db.participant.insert({
        id: 0n,
        room_id: roomId,
        identity: ctx.sender,
        display_name: cleanName,
        role,
        online: true,
        joined_at: ctx.timestamp,
      });
    }
    addTimeline(ctx, roomId, 'participant_joined', cleanName, `${role} joined the room`);
  }
);

export const appendTranscriptSegment = spacetimedb.reducer(
  {
    roomId: t.string(),
    sequence: t.u32(),
    speaker: t.string(),
    text: t.string(),
    relevant: t.bool(),
  },
  (ctx, { roomId, sequence, speaker, text, relevant }) => {
    requireRoom(ctx, roomId);
    requireParticipant(ctx, roomId);
    ctx.db.transcript_segment.insert({
      id: 0n,
      room_id: roomId,
      sequence,
      speaker,
      text,
      relevant,
      created_at: ctx.timestamp,
    });
  }
);

export const proposeInvestigation = spacetimedb.reducer(
  {
    roomId: t.string(),
    sourceSegmentId: t.u64(),
    prompt: t.string(),
    targetService: t.string(),
    windowMinutes: t.u32(),
    constraints: t.string(),
  },
  (ctx, args) => {
    requireRoom(ctx, args.roomId);
    requireParticipant(ctx, args.roomId);
    ctx.db.investigation_request.insert({
      id: 0n,
      room_id: args.roomId,
      source_segment_id: args.sourceSegmentId,
      prompt: args.prompt,
      target_service: args.targetService,
      window_minutes: args.windowMinutes,
      constraints: args.constraints,
      status: 'proposed',
      requested_by: ctx.sender,
      approved_by: undefined,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    addTimeline(
      ctx,
      args.roomId,
      'investigation_proposed',
      'Proactive',
      `Proposed read-only check for ${args.targetService} (${args.windowMinutes} min)`
    );
  }
);

export const editInvestigationWindow = spacetimedb.reducer(
  { requestId: t.u64(), windowMinutes: t.u32() },
  (ctx, { requestId, windowMinutes }) => {
    const request = requireRequest(ctx, requestId);
    requireParticipant(ctx, request.room_id);
    if (!['proposed', 'edited'].includes(request.status)) {
      throw new SenderError('Only a proposed investigation can be edited.');
    }
    if (windowMinutes < 5 || windowMinutes > 120) {
      throw new SenderError('Window must be between 5 and 120 minutes.');
    }
    ctx.db.investigation_request.id.update({
      ...request,
      window_minutes: windowMinutes,
      status: 'edited',
      updated_at: ctx.timestamp,
    });
    addTimeline(
      ctx,
      request.room_id,
      'investigation_edited',
      'Incident commander',
      `Changed investigation window to ${windowMinutes} minutes`
    );
  }
);

export const approveInvestigation = spacetimedb.reducer(
  { requestId: t.u64() },
  (ctx, { requestId }) => {
    const request = requireRequest(ctx, requestId);
    requireCommander(ctx, request.room_id);
    if (!['proposed', 'edited'].includes(request.status)) {
      throw new SenderError('Investigation is not awaiting approval.');
    }
    ctx.db.approval.insert({
      id: 0n,
      request_id: requestId,
      actor: ctx.sender,
      decision: 'approved',
      created_at: ctx.timestamp,
    });
    ctx.db.investigation_request.id.update({
      ...request,
      approved_by: ctx.sender,
      status: 'approved',
      updated_at: ctx.timestamp,
    });
    addTimeline(
      ctx,
      request.room_id,
      'investigation_approved',
      'Incident commander',
      'Approved read-only investigation'
    );
  }
);

export const startInvestigation = spacetimedb.reducer(
  { requestId: t.u64() },
  (ctx, { requestId }) => {
    const request = requireRequest(ctx, requestId);
    requireCommander(ctx, request.room_id);
    if (request.status !== 'approved') {
      throw new SenderError('Investigation must be approved before it starts.');
    }
    ctx.db.investigation_request.id.update({
      ...request,
      status: 'running',
      updated_at: ctx.timestamp,
    });
    addTimeline(ctx, request.room_id, 'investigation_started', 'Agent', 'Agent computer started');
  }
);

export const recordAgentStep = spacetimedb.reducer(
  {
    requestId: t.u64(),
    sequence: t.u32(),
    label: t.string(),
    detail: t.string(),
    status: t.string(),
    screenshotRef: t.string(),
  },
  (ctx, args) => {
    const request = requireRequest(ctx, args.requestId);
    if (request.status !== 'running') {
      throw new SenderError('Agent steps require a running investigation.');
    }
    ctx.db.agent_step.insert({
      id: 0n,
      request_id: args.requestId,
      sequence: args.sequence,
      label: args.label,
      detail: args.detail,
      status: args.status,
      screenshot_ref: args.screenshotRef,
      created_at: ctx.timestamp,
    });
    addTimeline(ctx, request.room_id, 'agent_step', 'Agent', args.label);
  }
);

export const addEvidence = spacetimedb.reducer(
  {
    requestId: t.u64(),
    kind: t.string(),
    headline: t.string(),
    detail: t.string(),
    value: t.string(),
  },
  (ctx, args) => {
    const request = requireRequest(ctx, args.requestId);
    if (request.status !== 'running') {
      throw new SenderError('Evidence requires a running investigation.');
    }
    ctx.db.evidence.insert({
      id: 0n,
      request_id: args.requestId,
      kind: args.kind,
      headline: args.headline,
      detail: args.detail,
      value: args.value,
      created_at: ctx.timestamp,
    });
  }
);

export const completeInvestigation = spacetimedb.reducer(
  {
    requestId: t.u64(),
    summary: t.string(),
    confidence: t.string(),
    recommendation: t.string(),
  },
  (ctx, args) => {
    const request = requireRequest(ctx, args.requestId);
    if (request.status !== 'running') {
      throw new SenderError('Only a running investigation can complete.');
    }
    ctx.db.conclusion.insert({
      request_id: args.requestId,
      summary: args.summary,
      confidence: args.confidence,
      recommendation: args.recommendation,
      status: 'ready_to_review',
      created_at: ctx.timestamp,
    });
    ctx.db.investigation_request.id.update({
      ...request,
      status: 'ready_to_review',
      updated_at: ctx.timestamp,
    });
    addTimeline(
      ctx,
      request.room_id,
      'investigation_completed',
      'Agent',
      'Evidence-backed conclusion ready to review'
    );
  }
);

export const pauseInvestigation = spacetimedb.reducer(
  { requestId: t.u64() },
  (ctx, { requestId }) => {
    const request = requireRequest(ctx, requestId);
    requireCommander(ctx, request.room_id);
    if (request.status !== 'running') return;
    ctx.db.investigation_request.id.update({
      ...request,
      status: 'paused',
      updated_at: ctx.timestamp,
    });
    addTimeline(ctx, request.room_id, 'investigation_paused', 'Incident commander', 'Agent paused');
  }
);

export const resetDemo = spacetimedb.reducer(
  { roomId: t.string() },
  (ctx, { roomId }) => {
    requireRoom(ctx, roomId);
    const commander = requireCommander(ctx, roomId);
    const requestIds = [...ctx.db.investigation_request.room_id.filter(roomId)].map(
      request => request.id
    );

    for (const requestId of requestIds) {
      ctx.db.approval.request_id.delete(requestId);
      ctx.db.agent_step.request_id.delete(requestId);
      ctx.db.evidence.request_id.delete(requestId);
      ctx.db.conclusion.request_id.delete(requestId);
    }

    ctx.db.investigation_request.room_id.delete(roomId);
    ctx.db.transcript_segment.room_id.delete(roomId);
    ctx.db.timeline_event.room_id.delete(roomId);
    for (const person of [...ctx.db.participant.room_id.filter(roomId)]) {
      if (!person.identity.isEqual(ctx.sender)) {
        ctx.db.participant.id.update({ ...person, online: false });
      }
    }
    addTimeline(ctx, roomId, 'demo_reset', commander.display_name, 'Prepared incident reset');
  }
);
