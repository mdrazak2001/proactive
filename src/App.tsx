import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { reducers, tables } from './module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import LiveViewPane from './features/war-room/LiveViewPane';
import {
  useBrowserbaseLiveView,
  type ComputerRunState,
} from './features/war-room/useBrowserbaseLiveView';
import './App.css';

const ROOM_ID = 'checkout-r42';
const COMPUTER_DEMO_GOAL = [
  'Investigate whether release R42 caused the checkout error spike in this read-only demo.',
  'Select checkout-api, change the window to 30 minutes, show deploy markers, inspect the applyCoupon TypeError, and check Stripe dependency health.',
  'Do not roll back, remediate, submit, or change production. Finish with the evidence you observed.',
].join(' ');

const transcriptScript = [
  {
    speaker: 'Priya · Incident commander',
    text: 'Checkout failures are climbing. We are at twelve percent errors now.',
    relevant: false,
  },
  {
    speaker: 'Noah · Checkout',
    text: 'Release R42 went out at 2:14. The first alert fired a few minutes later.',
    relevant: false,
  },
  {
    speaker: 'Priya · Incident commander',
    text: 'Compare before and after that deploy, open the new error group, and check whether Stripe latency changed. Read only—do not touch production.',
    relevant: true,
  },
  {
    speaker: 'Maya · Support',
    text: 'Enterprise customers are still reporting failed coupon checkouts.',
    relevant: false,
  },
];

const agentRecipe = [
  {
    label: 'Set investigation scope',
    detail: 'checkout-api · production · approved time window',
    screenshotRef: 'scope',
  },
  {
    label: 'Overlay release markers',
    detail: 'Release R42 deployed at 14:14:08',
    screenshotRef: 'deploy',
  },
  {
    label: 'Open new error group',
    detail: 'TypeError in applyCoupon first seen after R42',
    screenshotRef: 'error',
  },
  {
    label: 'Compare Stripe dependency',
    detail: 'Stripe p95 and error rate remained inside baseline',
    screenshotRef: 'dependency',
  },
];

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

function formatTime(value: { microsSinceUnixEpoch: bigint }) {
  const date = new Date(Number(value.microsSinceUnixEpoch / 1000n));
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function compareBigInt(a: bigint, b: bigint) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function StatusGlyph({ status }: { status: string }) {
  return <span className={`status-glyph status-glyph--${status}`} aria-hidden="true" />;
}

function ProactiveMark() {
  return (
    <div className="brand-mark" aria-label="Proactive">
      <span className="brand-mark__signal"><i /><i /><i /></span>
      <span>PROACTIVE</span>
    </div>
  );
}

function JoinScreen({ connected, onJoin }: {
  connected: boolean;
  onJoin: (name: string, role: string) => void;
}) {
  const [name, setName] = useState('Mohammed');
  const [role, setRole] = useState('Incident commander');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() && connected) onJoin(name.trim(), role);
  };

  return (
    <main className="join-shell">
      <div className="join-shell__topline">
        <ProactiveMark />
        <span className={`connection-pill ${connected ? 'is-live' : ''}`}>
          <span /> {connected ? 'Realtime ready' : 'Connecting'}
        </span>
      </div>
      <section className="join-card">
        <div className="join-card__eyebrow">LIVE INCIDENT ROOM · SEV-1</div>
        <h1>Join the checkout<br />investigation.</h1>
        <p>One shared, read-only agent computer. Everyone sees what it checks; only the commander can move it forward.</p>
        <form onSubmit={submit}>
          <label>
            Display name
            <input value={name} onChange={event => setName(event.target.value)} autoFocus />
          </label>
          <fieldset>
            <legend>Your role</legend>
            {['Incident commander', 'Responder', 'Observer'].map(option => (
              <button
                type="button"
                key={option}
                className={role === option ? 'role-option is-selected' : 'role-option'}
                onClick={() => setRole(option)}
              >
                <span>{option}</span>
                <i>{role === option ? 'Selected' : 'Join as'}</i>
              </button>
            ))}
          </fieldset>
          <button className="primary-button" disabled={!connected || !name.trim()} type="submit">
            Enter war room <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
      <p className="join-shell__footnote">No account · No production credentials · Every action is visible</p>
    </main>
  );
}

function TelemetryChart({ stepCount }: { stepCount: number }) {
  const showDeploy = stepCount >= 2;
  return (
    <div className="telemetry-chart">
      <div className="telemetry-chart__axis">
        <span>15%</span><span>10%</span><span>5%</span><span>0%</span>
      </div>
      <svg viewBox="0 0 720 220" role="img" aria-label="Checkout error rate chart">
        <g className="chart-grid">
          <line x1="0" y1="30" x2="720" y2="30" />
          <line x1="0" y1="85" x2="720" y2="85" />
          <line x1="0" y1="140" x2="720" y2="140" />
          <line x1="0" y1="195" x2="720" y2="195" />
        </g>
        <path className="chart-baseline" d="M0 185 C75 182 100 188 160 181 S250 185 310 180 S400 184 455 179" />
        <path className={`chart-errors ${stepCount ? 'is-drawn' : ''}`} d="M0 185 C75 182 100 188 160 181 S250 185 310 180 S400 184 455 179 C485 172 500 138 522 105 S560 63 585 60 S630 50 720 48" />
        {showDeploy && (
          <g className="deploy-marker">
            <line x1="465" y1="12" x2="465" y2="205" />
            <circle cx="465" cy="178" r="5" />
            <text x="478" y="24">R42 · 14:14</text>
          </g>
        )}
      </svg>
      <div className="telemetry-chart__time"><span>14:00</span><span>14:10</span><span>14:20</span><span>14:30</span></div>
    </div>
  );
}

function AgentComputer({ request, steps, evidenceRows, conclusionRow, computerRun }: {
  request: any;
  steps: readonly any[];
  evidenceRows: readonly any[];
  conclusionRow: any;
  computerRun: ComputerRunState;
}) {
  const running = request?.status === 'running';
  const waiting = request && ['proposed', 'edited', 'approved'].includes(request.status);
  const latestStep = steps.length > 0 ? steps[steps.length - 1] : undefined;
  const showLiveView = Boolean(computerRun.liveViewUrl) && (running || request?.status === 'ready_to_review');
  const computerFailed = computerRun.status === 'error' || computerRun.status === 'approval_required';
  const computerActive = computerRun.status === 'starting' || computerRun.status === 'running';
  const receiptLabel = computerFailed
    ? 'COMPUTER PAUSED'
    : computerRun.status === 'completed'
      ? 'COMPUTER RUN COMPLETE'
      : computerActive
        ? `LIVE COMPUTER · ${computerRun.actionCount} ACTION${computerRun.actionCount === 1 ? '' : 'S'}`
        : conclusionRow
          ? 'CONCLUSION READY'
          : running
            ? `STEP ${steps.length + 1} OF 4`
            : 'AGENT STATUS';
  const receiptText = computerRun.error
    ?? computerRun.summary
    ?? conclusionRow?.summary
    ?? latestStep?.label
    ?? (waiting ? 'Waiting for approval' : 'Standing by');

  return (
    <section className="agent-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">SHARED EXECUTION SURFACE</span>
          <h2>Agent Computer</h2>
        </div>
        <div className="guardrail-badge"><span>◆</span> SANDBOX · READ ONLY</div>
      </div>

      <div className={`computer-frame ${running ? 'is-running' : ''}`}>
        <div className="computer-chrome">
          <div className="computer-dots"><i /><i /><i /></div>
          <div className="computer-address">
            {showLiveView ? 'browserbase · isolated live view' : 'observe.proactive.local / checkout-api'}
          </div>
          <div className="computer-live"><span /> LIVE VIEW</div>
        </div>

        {!request ? (
          <div className="computer-idle">
            <div className="idle-radar"><span /><span /><span /></div>
            <strong>Waiting for a diagnostic question</strong>
            <p>The agent can inspect the seeded observability console after approval.</p>
          </div>
        ) : showLiveView && computerRun.liveViewUrl ? (
          <LiveViewPane url={computerRun.liveViewUrl} />
        ) : (
          <div className="observability-console">
            <div className="console-toolbar">
              <div><span>SERVICE</span><strong>checkout-api</strong></div>
              <div><span>ENVIRONMENT</span><strong>production · mirrored</strong></div>
              <div><span>WINDOW</span><strong>Last {request.windowMinutes} min</strong></div>
              <div className="console-toolbar__state"><StatusGlyph status={request.status} />{request.status.replaceAll('_', ' ')}</div>
            </div>
            <div className="metric-strip">
              <div><span>CHECKOUT 5XX</span><strong className="metric-bad">12.6%</strong><i>+11.8%</i></div>
              <div><span>REQUEST RATE</span><strong>842/m</strong><i>steady</i></div>
              <div><span>STRIPE P95</span><strong>342ms</strong><i className="metric-good">healthy</i></div>
            </div>
            <div className="chart-heading">
              <div><span className="legend-dot legend-dot--fault" /> Checkout 5xx</div>
              <div><span className="legend-dot legend-dot--quiet" /> Baseline</div>
              <span>ERROR RATE · 30 SECOND ROLLUP</span>
            </div>
            <TelemetryChart stepCount={steps.length} />

            {waiting && (
              <div className="computer-curtain">
                <span className="computer-curtain__lock">◇</span>
                <strong>Investigation prepared</strong>
                <p>The computer will remain still until the commander approves the exact scope.</p>
              </div>
            )}

            {running && (
              <div className="agent-cursor" style={{ '--step': Math.min(steps.length, 4) } as React.CSSProperties}>
                <span>↖</span><i>Proactive</i>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="execution-receipt" aria-live="polite">
        <div className="execution-receipt__lead">
          <StatusGlyph status={computerFailed ? 'paused' : conclusionRow ? 'ready' : running ? 'running' : 'idle'} />
          <div>
            <span>{receiptLabel}</span>
            <strong>{receiptText}</strong>
          </div>
        </div>
        {(running || computerActive) && <div className="running-bars"><i /><i /><i /><i /><i /></div>}
      </div>

      {(evidenceRows.length > 0 || conclusionRow) && (
        <div className="evidence-grid">
          {evidenceRows.map(row => (
            <article className="evidence-card" key={String(row.id)}>
              <span>{row.kind}</span>
              <strong>{row.headline}</strong>
              <p>{row.detail}</p>
              <i>{row.value}</i>
            </article>
          ))}
          {conclusionRow && (
            <article className="evidence-card evidence-card--conclusion">
              <span>LIKELY CAUSE · {conclusionRow.confidence}</span>
              <strong>Application regression</strong>
              <p>{conclusionRow.recommendation}</p>
              <i>Ready to review →</i>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

function InvestigationOrder({ request, isCommander, onWindow, onApprove, onPause }: {
  request: any;
  isCommander: boolean;
  onWindow: (minutes: number) => void;
  onApprove: () => void;
  onPause: () => void;
}) {
  if (!request) {
    return (
      <section className="order-card order-card--empty">
        <div className="order-card__signal">⌁</div>
        <span className="panel-kicker">LISTENING</span>
        <h2>I’ll surface one investigation.</h2>
        <p>Ask for a concrete diagnostic check and name what must not change.</p>
      </section>
    );
  }

  const awaitingApproval = ['proposed', 'edited'].includes(request.status);
  const approved = ['approved', 'running', 'ready_to_review'].includes(request.status);

  return (
    <section className={`order-card ${approved ? 'is-approved' : ''}`}>
      <div className="order-card__topline">
        <span className="panel-kicker">INVESTIGATION ORDER</span>
        <span className="readonly-stamp">READ ONLY</span>
      </div>
      <h2>{request.prompt}</h2>
      <dl className="scope-list">
        <div><dt>Target</dt><dd>{request.targetService}</dd></div>
        <div><dt>Environment</dt><dd>Production mirror</dd></div>
        <div><dt>Actions</dt><dd>4 allowlisted checks</dd></div>
        <div><dt>Constraint</dt><dd>{request.constraints}</dd></div>
      </dl>

      {awaitingApproval && (
        <div className="window-control">
          <span>INVESTIGATION WINDOW</span>
          <div>
            {[15, 30].map(minutes => (
              <button
                type="button"
                key={minutes}
                className={request.windowMinutes === minutes ? 'is-active' : ''}
                onClick={() => onWindow(minutes)}
              >{minutes} min</button>
            ))}
          </div>
          {request.windowMinutes === 15 && <p>15 minutes excludes the release marker. A responder can correct this live.</p>}
        </div>
      )}

      {awaitingApproval && isCommander && (
        <button className="approve-button" type="button" onClick={onApprove}>
          <span>Approve investigation</span><i>⌘ ↵</i>
        </button>
      )}
      {awaitingApproval && !isCommander && <p className="observer-note">Waiting for the incident commander to approve.</p>}
      {request.status === 'running' && isCommander && (
        <button className="pause-button" type="button" onClick={onPause}>Pause agent</button>
      )}
      {approved && request.status !== 'running' && (
        <div className="approval-receipt"><span>✓</span><div><strong>{request.status === 'ready_to_review' ? 'Investigation complete' : 'Approved'}</strong><p>Scope locked in the shared audit trail</p></div></div>
      )}
    </section>
  );
}

function App() {
  const { isActive: connected } = useSpacetimeDB();
  const [joined, setJoined] = useState(() => sessionStorage.getItem('proactive_joined') === 'true');
  const [displayName, setDisplayName] = useState(() => sessionStorage.getItem('proactive_name') ?? 'Mohammed');
  const [role, setRole] = useState(() => sessionStorage.getItem('proactive_role') ?? 'Incident commander');
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  const [rooms] = useTable(tables.incidentRoom);
  const [participants] = useTable(tables.participant);
  const [segments] = useTable(tables.transcriptSegment);
  const [requests] = useTable(tables.investigationRequest);
  const [steps] = useTable(tables.agentStep);
  const [evidenceRows] = useTable(tables.evidence);
  const [conclusions] = useTable(tables.conclusion);
  const [events] = useTable(tables.timelineEvent);

  const createDemoRoom = useReducer(reducers.createDemoRoom);
  const joinRoom = useReducer(reducers.joinRoom);
  const appendTranscript = useReducer(reducers.appendTranscriptSegment);
  const proposeInvestigation = useReducer(reducers.proposeInvestigation);
  const editWindow = useReducer(reducers.editInvestigationWindow);
  const approve = useReducer(reducers.approveInvestigation);
  const start = useReducer(reducers.startInvestigation);
  const recordStep = useReducer(reducers.recordAgentStep);
  const addEvidence = useReducer(reducers.addEvidence);
  const complete = useReducer(reducers.completeInvestigation);
  const pause = useReducer(reducers.pauseInvestigation);
  const resetDemo = useReducer(reducers.resetDemo);

  const roomRequested = useRef(false);
  const executionStarted = useRef<bigint | null>(null);
  const completionSubmitted = useRef<bigint | null>(null);
  const room = rooms.find(item => item.roomId === ROOM_ID);
  const roomParticipants = participants.filter(item => item.roomId === ROOM_ID && item.online);
  const roomSegments = useMemo(
    () => segments.filter(item => item.roomId === ROOM_ID).sort((a, b) => a.sequence - b.sequence),
    [segments]
  );
  const roomRequests = useMemo(
    () => requests.filter(item => item.roomId === ROOM_ID).sort((a, b) => compareBigInt(a.id, b.id)),
    [requests]
  );
  const request = roomRequests.length > 0 ? roomRequests[roomRequests.length - 1] : undefined;
  const requestSteps = useMemo(
    () => request ? steps.filter(item => item.requestId === request.id).sort((a, b) => a.sequence - b.sequence) : [],
    [request, steps]
  );
  const requestEvidence = useMemo(
    () => request ? evidenceRows.filter(item => item.requestId === request.id) : [],
    [request, evidenceRows]
  );
  const conclusionRow = request ? conclusions.find(item => item.requestId === request.id) : undefined;
  const roomEvents = useMemo(
    () => events.filter(item => item.roomId === ROOM_ID).sort((a, b) => compareBigInt(b.id, a.id)).slice(0, 8),
    [events]
  );
  const isCommander = role === 'Incident commander';
  const executionSurface = useMemo(() => {
    const forcedControl = new URLSearchParams(window.location.search).get('role') === 'control';
    return !forcedControl && !window.matchMedia('(max-width: 720px)').matches;
  }, []);
  const computerRun = useBrowserbaseLiveView(
    joined && executionSurface && isCommander && request?.status === 'running',
    COMPUTER_DEMO_GOAL,
    request ? String(request.id) : '',
  );

  useEffect(() => {
    if (!connected || room || roomRequested.current) return;
    roomRequested.current = true;
    Promise.resolve(createDemoRoom({ roomId: ROOM_ID, title: 'Checkout degradation after R42' }))
      .catch(reason => setError(String(reason)));
  }, [connected, createDemoRoom, room]);

  useEffect(() => {
    if (!joined || !executionSurface || !isCommander || request?.status !== 'running' || requestSteps.length > 0) return;
    if (executionStarted.current === request.id) return;
    executionStarted.current = request.id;

    const run = async () => {
      for (let index = 0; index < agentRecipe.length; index += 1) {
        const step = agentRecipe[index];
        await recordStep({
          requestId: request.id,
          sequence: index + 1,
          label: step.label,
          detail: step.detail,
          status: 'complete',
          screenshotRef: step.screenshotRef,
        });
        if (index === 1) {
          await addEvidence({
            requestId: request.id,
            kind: 'DEPLOY CORRELATION',
            headline: 'Errors rose 2m after R42',
            detail: 'Checkout 5xx moved from 0.8% to 12.6% immediately after release.',
            value: '+11.8%',
          });
        }
        if (index === 2) {
          await addEvidence({
            requestId: request.id,
            kind: 'NEW EXCEPTION',
            headline: 'applyCoupon TypeError',
            detail: 'First seen in R42; isolated to coupon-enabled checkout requests.',
            value: 'R42 only',
          });
        }
        if (index === 3) {
          await addEvidence({
            requestId: request.id,
            kind: 'DEPENDENCY CHECK',
            headline: 'Stripe remained healthy',
            detail: 'Latency and error rate stayed within the previous 24-hour baseline.',
            value: '342ms p95',
          });
        }
        await wait(1050);
      }
    };

    run().catch(reason => setError(String(reason)));
  }, [
    addEvidence,
    executionSurface,
    isCommander,
    joined,
    recordStep,
    request,
    requestSteps.length,
  ]);

  useEffect(() => {
    if (
      !joined ||
      !executionSurface ||
      !isCommander ||
      !request ||
      request.status !== 'running' ||
      requestSteps.length < agentRecipe.length ||
      completionSubmitted.current === request.id
    ) {
      return;
    }

    if (computerRun.status === 'completed') {
      completionSubmitted.current = request.id;
      const observedSummary = computerRun.summary?.trim();
      void complete({
        requestId: request.id,
        summary: observedSummary
          ? observedSummary.slice(0, 500)
          : 'The live computer verified the R42 correlation and a healthy Stripe baseline.',
        confidence: 'COMPUTER VERIFIED',
        recommendation: 'Review rollback of R42. No production action has been taken.',
      }).catch(reason => {
        completionSubmitted.current = null;
        setError(String(reason));
      });
      return;
    }

    if (computerRun.status === 'error' || computerRun.status === 'approval_required') {
      completionSubmitted.current = request.id;
      void pause({ requestId: request.id }).catch(reason => {
        completionSubmitted.current = null;
        setError(String(reason));
      });
    }
  }, [
    complete,
    computerRun.status,
    computerRun.summary,
    executionSurface,
    isCommander,
    joined,
    pause,
    request,
    requestSteps.length,
  ]);

  const handleJoin = async (name: string, selectedRole: string) => {
    setDisplayName(name);
    setRole(selectedRole);
    sessionStorage.setItem('proactive_joined', 'true');
    sessionStorage.setItem('proactive_name', name);
    sessionStorage.setItem('proactive_role', selectedRole);
    setJoined(true);
    try {
      await joinRoom({ roomId: ROOM_ID, displayName: name, role: selectedRole });
    } catch (reason) {
      setError(String(reason));
    }
  };

  const playIncident = async () => {
    if (playing || roomSegments.length || request) return;
    setPlaying(true);
    setError('');
    try {
      for (let index = 0; index < transcriptScript.length; index += 1) {
        const line = transcriptScript[index];
        await appendTranscript({
          roomId: ROOM_ID,
          sequence: index + 1,
          speaker: line.speaker,
          text: line.text,
          relevant: line.relevant,
        });
        await wait(index === 2 ? 1250 : 800);
      }
      await proposeInvestigation({
        roomId: ROOM_ID,
        sourceSegmentId: 0n,
        prompt: 'Did R42 cause checkout failures, or is Stripe degrading?',
        targetService: 'checkout-api',
        windowMinutes: 15,
        constraints: 'No writes · No shell · No production changes',
      });
    } catch (reason) {
      setError(String(reason));
    } finally {
      setPlaying(false);
    }
  };

  const handleReset = async () => {
    if (!isCommander || playing) return;
    setError('');
    try {
      await resetDemo({ roomId: ROOM_ID });
      executionStarted.current = null;
      completionSubmitted.current = null;
    } catch (reason) {
      setError(String(reason));
    }
  };

  const handleApprove = async () => {
    if (!request) return;
    try {
      await approve({ requestId: request.id });
      await wait(350);
      await start({ requestId: request.id });
    } catch (reason) {
      setError(String(reason));
    }
  };

  if (!joined) return <JoinScreen connected={connected && Boolean(room)} onJoin={handleJoin} />;

  return (
    <div className="app-shell">
      <header className="war-header">
        <div className="war-header__brand"><ProactiveMark /><span className="header-divider" /></div>
        <div className="incident-identity">
          <span className="severity-badge">SEV-1</span>
          <div><strong>{room?.title ?? 'Opening incident room…'}</strong><span>INC-2048 · Started 14:17 IST</span></div>
        </div>
        <div className="war-header__right">
          <div className="presence-stack" aria-label={`${roomParticipants.length} connected participants`}>
            {roomParticipants.slice(0, 4).map((person, index) => <span key={String(person.id)} style={{ zIndex: 4 - index }}>{person.displayName.slice(0, 1).toUpperCase()}</span>)}
            <i>{Math.max(roomParticipants.length, 1)} live</i>
          </div>
          <div className={`connection-pill ${connected ? 'is-live' : ''}`}><span />{connected ? 'Main room live' : 'Reconnecting'}</div>
        </div>
      </header>

      <main className="workspace">
        <aside className="transcript-panel">
          <div className="panel-heading panel-heading--compact">
            <div><span className="panel-kicker">MEETING SENSOR</span><h2>Live transcript</h2></div>
            <span className="transcript-pulse"><i /><i /><i /></span>
          </div>
          <div className="transcript-stream" aria-live="polite">
            {roomSegments.length === 0 ? (
              <div className="transcript-empty"><span>···</span><p>Conversation will appear here. The transcript is context—not the product.</p></div>
            ) : roomSegments.map(segment => (
              <article key={String(segment.id)} className={segment.relevant ? 'transcript-line is-relevant' : 'transcript-line'}>
                <span>{segment.speaker}</span>
                <p>{segment.text}</p>
                {segment.relevant && <i>Investigation detected →</i>}
              </article>
            ))}
            {playing && <div className="typing-line"><i /><i /><i /></div>}
          </div>
          <div className="demo-control">
            {roomSegments.length > 0 ? (
              isCommander && (
                <button type="button" disabled={playing} onClick={handleReset}>
                  <span>Reset prepared incident</span><i>↻</i>
                </button>
              )
            ) : (
              <button type="button" disabled={playing} onClick={playIncident}>
                <span>{playing ? 'Streaming incident…' : 'Play prepared incident'}</span>
                <i>{playing ? '●' : '▶'}</i>
              </button>
            )}
            <p>Deterministic transcript · demo mode</p>
          </div>
        </aside>

        <AgentComputer request={request} steps={requestSteps} evidenceRows={requestEvidence} conclusionRow={conclusionRow} computerRun={computerRun} />

        <aside className="rail-panel">
          <InvestigationOrder
            request={request}
            isCommander={isCommander}
            onWindow={minutes => request && editWindow({ requestId: request.id, windowMinutes: minutes })}
            onApprove={handleApprove}
            onPause={() => request && pause({ requestId: request.id })}
          />
          <section className="activity-rail">
            <div className="activity-rail__heading"><span className="panel-kicker">SHARED AUDIT TRAIL</span><i>{roomEvents.length}</i></div>
            <div className="activity-list">
              {roomEvents.map(event => (
                <article key={String(event.id)}>
                  <span>{formatTime(event.createdAt)}</span>
                  <div><strong>{event.actor}</strong><p>{event.body}</p></div>
                </article>
              ))}
              {roomEvents.length === 0 && <p className="activity-empty">Every decision and computer action will appear here.</p>}
            </div>
          </section>
        </aside>
      </main>

      <footer className="war-footer">
        <span>Signed in as <strong>{displayName}</strong> · {role}</span>
        <span>Agent boundary: <strong>observe and prepare</strong> · never remediate</span>
      </footer>

      {error && <div className="error-toast" role="alert"><strong>Couldn’t complete that action</strong><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    </div>
  );
}

export default App;
