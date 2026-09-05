type TimestampLike = { microsSinceUnixEpoch: bigint };

export type BoardStep = {
  id: bigint;
  sequence: number;
  label: string;
  detail: string;
  screenshotRef: string;
  createdAt: TimestampLike;
};

export type BoardEvidence = {
  id: bigint;
  kind: string;
  headline: string;
  detail: string;
  value: string;
  createdAt: TimestampLike;
};

export type BoardConclusion = {
  summary: string;
  confidence: string;
  recommendation: string;
  createdAt: TimestampLike;
};

type BoardProps = {
  request: { status: string; windowMinutes: number } | undefined;
  steps: readonly BoardStep[];
  evidenceRows: readonly BoardEvidence[];
  conclusionRow: BoardConclusion | undefined;
  connected: boolean;
};

const expectedSteps = [
  { ref: 'scope', short: 'SCOPE' },
  { ref: 'deploy', short: 'CHANGE' },
  { ref: 'error', short: 'ERROR' },
  { ref: 'dependency', short: 'CONTROL' },
];

function formatBoardTime(value?: TimestampLike) {
  if (!value) return 'awaiting row';
  const date = new Date(Number(value.microsSinceUnixEpoch / 1000n));
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function EvidenceNode({
  className,
  eyebrow,
  placeholder,
  evidence,
  step,
}: {
  className: string;
  eyebrow: string;
  placeholder: string;
  evidence?: BoardEvidence;
  step?: BoardStep;
}) {
  const active = Boolean(evidence);
  return (
    <article className={`causal-node ${className} ${active ? 'is-observed' : ''}`}>
      <div className="causal-node__topline">
        <span>{active ? eyebrow : 'AWAITING EVIDENCE'}</span>
        <i>{evidence ? `ROW ${String(evidence.id)}` : '—'}</i>
      </div>
      <strong>{evidence?.headline ?? placeholder}</strong>
      <em>{evidence?.value ?? 'PENDING'}</em>
      <p>{evidence?.detail ?? 'This node activates only when a subscribed SpacetimeDB row arrives.'}</p>
      <footer>
        <span>{evidence ? formatBoardTime(evidence.createdAt) : 'not observed'}</span>
        <span className={step && evidence ? 'is-verified' : ''}>
          {step && evidence ? '✓ VERIFIED' : step ? 'AWAITING RECEIPT' : 'QUERY PENDING'}
        </span>
      </footer>
    </article>
  );
}

function FlowArrow({ active, label, className = '' }: { active: boolean; label: string; className?: string }) {
  return (
    <div className={`causal-arrow ${className} ${active ? 'is-active' : ''}`} aria-hidden="true">
      <span>{label}</span>
      <i />
    </div>
  );
}

export default function CausalEvidenceBoard({ request, steps, evidenceRows, conclusionRow, connected }: BoardProps) {
  const stepByRef = new Map(steps.map(step => [step.screenshotRef, step]));
  const evidenceByKind = new Map(evidenceRows.map(row => [row.kind, row]));
  const deploy = evidenceByKind.get('DEPLOY CORRELATION');
  const exception = evidenceByKind.get('NEW EXCEPTION');
  const impact = evidenceByKind.get('IMPACT ESTIMATE');
  const dependency = evidenceByKind.get('DEPENDENCY CHECK');
  const running = request?.status === 'running';
  const waiting = request && ['proposed', 'edited', 'approved'].includes(request.status);
  const observedCount = evidenceRows.length;

  return (
    <section className={`causal-board ${running ? 'is-running' : ''}`} aria-live="polite">
      <header className="causal-board__header">
        <div>
          <span>DEMO DATASET · REAL-TIME EXECUTION</span>
          <strong>What changed, what broke, who felt it?</strong>
        </div>
        <div className={`causal-board__source ${connected ? '' : 'is-reconnecting'}`}>
          <i /> {connected ? 'SPACETIMEDB LIVE' : 'RECONNECTING'}
        </div>
      </header>

      <div className="causal-board__progress" aria-label={`${steps.length} of 4 investigation steps verified`}>
        {expectedSteps.map((expected, index) => {
          const step = stepByRef.get(expected.ref);
          return (
            <div key={expected.ref} className={step ? 'is-complete' : running && index === steps.length ? 'is-current' : ''}>
              <i>{step ? '✓' : index + 1}</i>
              <span>{expected.short}</span>
              <em>{step ? `step row ${String(step.id)}` : 'queued'}</em>
            </div>
          );
        })}
      </div>

      <div className="causal-board__map">
        <EvidenceNode
          className="causal-node--change"
          eyebrow="OBSERVED CHANGE"
          placeholder="Release correlation"
          evidence={deploy}
          step={stepByRef.get('deploy')}
        />
        <FlowArrow className="causal-arrow--one" active={Boolean(deploy && exception)} label="2 MIN" />
        <EvidenceNode
          className="causal-node--failure"
          eyebrow="OBSERVED FAILURE"
          placeholder="New exception group"
          evidence={exception}
          step={stepByRef.get('error')}
        />
        <FlowArrow className="causal-arrow--two" active={Boolean(exception && impact)} label="AFFECTS" />
        <EvidenceNode
          className="causal-node--impact"
          eyebrow="DERIVED IMPACT"
          placeholder="Customer impact estimate"
          evidence={impact}
          step={stepByRef.get('error')}
        />

        <div className={`causal-branch ${exception && dependency ? 'is-active' : ''}`} aria-hidden="true">
          <i />
          <span>CONTROL CHECK</span>
        </div>
        <EvidenceNode
          className="causal-node--dependency"
          eyebrow="OBSERVED CONTROL"
          placeholder="Stripe dependency health"
          evidence={dependency}
          step={stepByRef.get('dependency')}
        />
      </div>

      <div className={`causal-board__inference ${conclusionRow ? 'is-ready' : ''}`}>
        <div>
          <span>{conclusionRow ? `INFERENCE · ${conclusionRow.confidence}` : 'INFERENCE LOCKED'}</span>
          <strong>{conclusionRow?.summary ?? 'Conclusion assembles after all evidence rows are verified.'}</strong>
        </div>
        <p>{conclusionRow?.recommendation ?? 'No recommendation yet · no production action can be taken.'}</p>
      </div>

      <footer className="causal-board__footer">
        <span>{steps.length}/4 STEP ROWS</span>
        <span>{observedCount}/4 EVIDENCE ROWS</span>
        <span>{conclusionRow ? '1 CONCLUSION ROW' : '0 CONCLUSION ROWS'}</span>
        <i>{request ? `${request.windowMinutes} MIN WINDOW` : 'WAITING FOR QUESTION'}</i>
      </footer>

      {waiting && (
        <div className="causal-board__curtain">
          <span>◇</span>
          <strong>Investigation prepared</strong>
          <p>The causal board stays still until the commander approves this exact read-only scope.</p>
        </div>
      )}
    </section>
  );
}
