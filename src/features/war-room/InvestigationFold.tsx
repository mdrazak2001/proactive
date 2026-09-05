import { useRef } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import GlassSurface from './GlassSurface';

export type FoldEvidence = {
  id: bigint;
  kind: string;
  headline: string;
  detail: string;
  value: string;
  createdAt: { microsSinceUnixEpoch: bigint };
};

export type FoldConclusion = {
  summary: string;
  confidence: string;
  recommendation: string;
  createdAt: { microsSinceUnixEpoch: bigint };
};

type FoldRequest = {
  status: string;
  windowMinutes: number;
  targetService: string;
};

type InvestigationFoldProps = {
  request: FoldRequest;
  evidenceRows: readonly FoldEvidence[];
  conclusionRow: FoldConclusion | undefined;
  connected: boolean;
  isCommander: boolean;
  onWindow: (minutes: number) => void;
  onApprove: () => void;
  onStart: () => void;
  onPause: () => void;
};

type FoldPhase = 'proposed' | 'approved' | 'running' | 'paused' | 'complete';
type ArtifactKind = typeof artifactOrder[number];

const artifactOrder = [
  'DEPLOY CORRELATION',
  'NEW EXCEPTION',
  'IMPACT ESTIMATE',
  'DEPENDENCY CHECK',
] as const;

const lensStops = ['4%', '27%', '51%', '68%', '87%', '94%'] as const;
const transition = { duration: 0.48, ease: [0.23, 1, 0.32, 1] as const };

function phaseFor(request: FoldRequest, conclusionRow: FoldConclusion | undefined): FoldPhase {
  if (conclusionRow) return 'complete';
  if (request.status === 'running' || request.status === 'ready_to_review') return 'running';
  if (request.status === 'paused') return 'paused';
  if (request.status === 'approved') return 'approved';
  return 'proposed';
}

function currentKind(rows: readonly FoldEvidence[]): ArtifactKind | undefined {
  return rows[rows.length - 1]?.kind as ArtifactKind | undefined;
}

export function InvestigationFold({
  request,
  evidenceRows,
  conclusionRow,
  connected,
  isCommander,
  onWindow,
  onApprove,
  onStart,
  onPause,
}: InvestigationFoldProps) {
  const reduceMotion = useReducedMotion();
  const phase = phaseFor(request, conclusionRow);
  const awaitingApproval = phase === 'proposed';
  const evidenceByKind = new Map(evidenceRows.map(row => [row.kind, row]));
  const orderedEvidence = artifactOrder.map(kind => evidenceByKind.get(kind));
  const firstMissing = orderedEvidence.findIndex(row => !row);
  const visibleEvidence = orderedEvidence
    .slice(0, firstMissing === -1 ? orderedEvidence.length : firstMissing)
    .filter((row): row is FoldEvidence => Boolean(row));
  const latestKind = currentKind(visibleEvidence);
  const isComplete = phase === 'complete';
  const lensIndex = isComplete ? 5 : visibleEvidence.length;
  const lensPosition = lensStops[lensIndex] ?? lensStops[0];
  const hasDeploy = visibleEvidence.length >= 1;
  const hasException = visibleEvidence.length >= 2;
  const hasImpact = visibleEvidence.length >= 3;
  const hasDependency = visibleEvidence.length >= 4;
  const deployRow = visibleEvidence[0];
  const exceptionRow = visibleEvidence[1];
  const impactRow = visibleEvidence[2];
  const dependencyRow = visibleEvidence[3];
  const deploymentMarker = deployRow?.headline.match(/\bR\d+\b/i)?.[0] ?? 'R42';
  const deployDelta = deployRow?.value ?? '+11.8 pp';
  const exceptionName = exceptionRow?.headline ?? 'applyCoupon TypeError';
  const impactValue = impactRow?.value ?? '≈106/min';
  const dependencyName = dependencyRow?.headline.match(/^[\w.-]+/)?.[0] ?? 'Stripe';
  const dependencyLatency = dependencyRow?.value.match(/[\d.]+ms/i)?.[0] ?? dependencyRow?.value ?? '342ms';
  const dependencyConclusion = `${dependencyName} ruled out`;
  const motionTransition = reduceMotion ? { duration: 0 } : transition;
  const initialStateRef = useRef<{ evidenceCount: number; complete: boolean } | null>(null);
  if (!initialStateRef.current) {
    initialStateRef.current = { evidenceCount: visibleEvidence.length, complete: Boolean(conclusionRow) };
  }
  const joinedInProgress = initialStateRef.current.evidenceCount > 0 || initialStateRef.current.complete;
  const openingInitial = reduceMotion || joinedInProgress ? false : undefined;

  return (
    <section className={`investigation-fold is-${phase}`} aria-label="The Evidence Wake — read-only investigation">
      <motion.div
        className={`investigation-rail ${awaitingApproval ? '' : 'is-collapsed'}`}
        initial={false}
        animate={{ minHeight: awaitingApproval ? 44 : 30 }}
        transition={motionTransition}
      >
        {awaitingApproval ? (
          <>
            <fieldset className="window-selector">
              <legend>Investigation window</legend>
              {[15, 30].map(minutes => (
                <button
                  type="button"
                  key={minutes}
                  aria-pressed={request.windowMinutes === minutes}
                  className={request.windowMinutes === minutes ? 'is-selected' : ''}
                  onClick={() => onWindow(minutes)}
                >
                  {minutes} min
                </button>
              ))}
            </fieldset>
            <span className="investigation-scope">{request.targetService} · read only · no production writes</span>
            {isCommander ? (
              <button className="rail-action" type="button" onClick={onApprove} disabled={request.windowMinutes < 30}>
                {request.windowMinutes < 30 ? 'Include R42 first' : 'Approve'}
              </button>
            ) : (
              <span className="rail-observer">Awaiting commander</span>
            )}
          </>
        ) : (
          <>
            <span className={`shared-state ${connected ? 'is-live' : ''}`} aria-label={connected ? 'Shared state live' : 'Shared state reconnecting'} />
            <span className="investigation-scope">{request.windowMinutes} min · {request.targetService} · read only</span>
            {phase === 'approved' && isCommander && <button className="rail-action rail-action--quiet" type="button" onClick={onStart}>Start</button>}
            {phase === 'running' && request.status === 'running' && isCommander && <button className="rail-action rail-action--quiet" type="button" onClick={onPause}>Pause</button>}
            {phase === 'paused' && <span className="rail-observer">Paused</span>}
          </>
        )}
      </motion.div>

      <LayoutGroup id="evidence-wake">
        <div
          className={`evidence-wake ${isComplete ? 'is-resolved' : ''}`}
          aria-live="polite"
          aria-relevant="additions"
          aria-label={`${visibleEvidence.length} evidence receipts received`}
        >
          <svg className="evidence-wake__trace" viewBox="0 0 760 176" preserveAspectRatio="none" aria-hidden="true">
            <motion.path
              className="wake-spine"
              d="M 4 112 C 78 112, 118 112, 178 112 S 284 112, 350 112 S 482 112, 548 112 S 666 112, 756 112"
              pathLength="1"
              initial={openingInitial === false ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: isComplete ? 0.18 : 1 }}
              transition={motionTransition}
            />

            {hasDeploy && (
              <motion.g
                className="wake-deploy"
                initial={openingInitial === false ? false : { opacity: 0 }}
                animate={{ opacity: isComplete ? 0.12 : latestKind === 'DEPLOY CORRELATION' ? 1 : 0.3 }}
                transition={motionTransition}
              >
                <motion.path
                  className="wake-predeploy"
                  d="M 4 112 C 50 111, 84 114, 122 112 S 155 112, 178 112"
                  pathLength="1"
                  initial={openingInitial === false ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={motionTransition}
                />
                <motion.path
                  className="wake-fault-trace"
                  d="M 178 112 C 202 109, 215 93, 231 76 S 270 48, 328 44"
                  pathLength="1"
                  initial={openingInitial === false ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={motionTransition}
                />
                <motion.line
                  className="wake-r42-tick"
                  x1="178"
                  y1="86"
                  x2="178"
                  y2="124"
                  initial={openingInitial === false ? false : { opacity: 0 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: [0, 1, 0.5, 1] }}
                  transition={motionTransition}
                />
              </motion.g>
            )}

            {hasDependency && !isComplete && (
              <motion.g
                className="wake-stripe-trace"
                initial={openingInitial === false ? false : { opacity: 0, filter: 'blur(0px)' }}
                animate={{
                  opacity: latestKind === 'DEPENDENCY CHECK' ? 0.44 : 0.14,
                  filter: latestKind === 'DEPENDENCY CHECK' ? 'blur(0.35px)' : 'blur(1.8px)',
                }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                transition={motionTransition}
              >
                <path d="M 552 132 C 590 131, 626 134, 662 132 S 713 132, 756 132" />
              </motion.g>
            )}

            {isComplete && [178, 386, 517, 662].map(x => (
              <motion.line
                key={x}
                className="wake-notch"
                x1={x}
                x2={x}
                y1="107"
                y2="117"
                initial={openingInitial === false ? false : { opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={motionTransition}
              />
            ))}
          </svg>

          <AnimatePresence initial={false} mode="popLayout">
            {hasDeploy && !isComplete && (
              <motion.div
                key={`deploy-${String(deployRow?.id)}`}
                className={`wake-reading wake-reading--deploy ${latestKind === 'DEPLOY CORRELATION' ? 'is-current' : 'is-context'}`}
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: latestKind === 'DEPLOY CORRELATION' ? 1 : 0.34, y: 0 }}
                exit={{ opacity: 0, y: 54, scale: 0.35 }}
                transition={motionTransition}
              >
                <motion.span layoutId="wake-r42">{deploymentMarker}</motion.span>
                <strong>{deployDelta}</strong>
              </motion.div>
            )}

            {hasException && !isComplete && (
              <motion.div
                key={`exception-${String(exceptionRow?.id)}`}
                className={`wake-reading wake-reading--exception ${latestKind === 'NEW EXCEPTION' ? 'is-current' : 'is-context'}`}
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: latestKind === 'NEW EXCEPTION' ? 1 : latestKind === 'IMPACT ESTIMATE' ? 0.3 : 0.24, y: 0 }}
                exit={{ opacity: 0, y: 50, scale: 0.35 }}
                transition={motionTransition}
              >
                <motion.strong layoutId="wake-exception">{exceptionName}</motion.strong>
              </motion.div>
            )}

            {hasImpact && !isComplete && (
              <motion.div
                key={`impact-${String(impactRow?.id)}`}
                className={`wake-reading wake-reading--impact ${latestKind === 'IMPACT ESTIMATE' ? 'is-current' : 'is-context'}`}
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: latestKind === 'IMPACT ESTIMATE' ? 1 : 0.34, y: 0 }}
                exit={{ opacity: 0, y: 29, scale: 0.35 }}
                transition={motionTransition}
              >
                <strong>{impactValue}</strong>
              </motion.div>
            )}

            {hasDependency && !isComplete && (
              <motion.div
                key={`dependency-${String(dependencyRow?.id)}`}
                className="wake-reading wake-reading--dependency is-current"
                initial={reduceMotion ? false : { opacity: 0, y: 5, filter: 'blur(2px)' }}
                animate={{ opacity: latestKind === 'DEPENDENCY CHECK' ? 0.72 : 0.28, y: 0, filter: 'blur(0.45px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.35, filter: 'blur(4px)' }}
                transition={motionTransition}
              >
                <motion.strong layoutId="wake-stripe">{dependencyConclusion}</motion.strong>
                <span>{dependencyLatency}</span>
              </motion.div>
            )}

            {isComplete && (
              <motion.p
                key={`conclusion-${String(conclusionRow?.createdAt.microsSinceUnixEpoch)}`}
                className="evidence-wake__answer"
                aria-label={`${deploymentMarker}, ${exceptionName}, ${dependencyConclusion}`}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={motionTransition}
              >
                <motion.span layoutId="wake-r42">{deploymentMarker}</motion.span>
                <i aria-hidden="true">·</i>
                <motion.span layoutId="wake-exception">{exceptionName}</motion.span>
                <i aria-hidden="true">·</i>
                <motion.span layoutId="wake-stripe">{dependencyConclusion}</motion.span>
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div
            className="evidence-lens"
            style={{ x: '-50%' }}
            initial={openingInitial === false ? false : { left: lensStops[0], opacity: 0, scale: 0.72 }}
            animate={{ left: lensPosition, opacity: isComplete ? 0.62 : 1, scale: isComplete ? 0.76 : 1 }}
            transition={motionTransition}
            aria-hidden="true"
          >
            <GlassSurface width={44} height={44} borderRadius={22} displacement={5} />
          </motion.div>
        </div>
      </LayoutGroup>
    </section>
  );
}

export default InvestigationFold;
