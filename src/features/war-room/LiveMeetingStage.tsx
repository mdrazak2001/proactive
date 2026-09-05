import { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import ActionAperture from './ActionAperture';
import IntentThread from './IntentThread';
import OutcomePin from './OutcomePin';
import SpeakerEdge from './SpeakerEdge';
import StreamingLine from './StreamingLine';
import { preparedClips, preparedSpeakers } from './preparedVoice';
import { beatForScene, resolveScenes, type StageSegment } from './sceneRegistry';
import './LiveMeetingStage.css';

const EASE = [0.23, 1, 0.32, 1] as const;
/** The frame is a fixed broadcast composition, never a fluid dashboard. */
const VISIBLE_LINES = 3;

export interface LiveMeetingStageProps {
  segments: StageSegment[];
  activeSequence: number | null;
  playing: boolean;
  connected: boolean;
  started: boolean;
  busy: boolean;
  getAnalyser: () => AnalyserNode | undefined;
  onStart: () => void;
}

export default function LiveMeetingStage({
  segments,
  activeSequence,
  playing,
  connected,
  started,
  busy,
  getAnalyser,
  onStart,
}: LiveMeetingStageProps) {
  const reducedMotion = Boolean(useReducedMotion());

  const activeSpeakerId = activeSequence
    ? preparedClips.find(clip => clip.sequence === activeSequence)?.speakerId
    : undefined;

  const resolved = useMemo(() => resolveScenes(segments), [segments]);
  const activeScene = resolved.length > 0 ? resolved[resolved.length - 1] : undefined;
  const pinned = resolved.slice(0, -1);
  const beat = activeScene ? beatForScene(segments, activeScene.triggerSequence) : 0;
  const visible = segments.slice(-VISIBLE_LINES);
  const Scene = activeScene?.definition.component;

  return (
    <div className="meeting-stage">
      <header className="meeting-stage__head">
        <div className="meeting-stage__slug">
          <span className={`meeting-stage__air${playing ? ' is-live' : ''}`}>
            <i aria-hidden="true" />
            {playing ? 'On air' : connected ? 'Bridge open' : 'Reconnecting'}
          </span>
          <span className="meeting-stage__scope">CHECKOUT · R42 · SEV-1</span>
        </div>
        <div className="meeting-stage__control">
          {started ? null : (
            <button type="button" disabled={busy} onClick={onStart}>
              {playing ? 'Streaming…' : 'Start transcript'}
            </button>
          )}
        </div>
      </header>

      <div className="meeting-stage__body">
        <aside className="meeting-stage__voices" aria-label="Voices on the bridge">
          <span className="meeting-stage__caption">Voices on the bridge</span>
          <div className="meeting-stage__edges">
            {preparedSpeakers.map(speaker => (
              <SpeakerEdge
                key={speaker.id}
                name={speaker.name}
                role={speaker.role}
                active={activeSpeakerId === speaker.id}
                reducedMotion={reducedMotion}
                getAnalyser={getAnalyser}
              />
            ))}
          </div>
          <span className="meeting-stage__foot">Prepared clips · shared rows</span>
        </aside>

        <div className="meeting-stage__center">
          <ol className="meeting-stage__transcript" aria-label="Live transcript" aria-live="polite">
            {visible.length === 0 ? (
              <li className="meeting-stage__quiet">
                <strong>The bridge is quiet.</strong>
                <p>Start the prepared conversation. Whatever the room asks for opens below.</p>
              </li>
            ) : (
              visible.map(segment => (
                <StreamingLine
                  key={String(segment.id)}
                  segment={segment}
                  active={activeSequence === segment.sequence}
                  reducedMotion={reducedMotion}
                />
              ))
            )}
          </ol>

          <IntentThread intent={activeScene?.definition.intent} reducedMotion={reducedMotion} />

          <div className="meeting-stage__aperture">
            <ActionAperture
              icon={activeScene?.definition.icon}
              scope={activeScene?.definition.scope}
              open={Boolean(activeScene)}
            >
              <AnimatePresence mode="wait" initial={false}>
                {activeScene && Scene ? (
                  <motion.div
                    key={activeScene.definition.id}
                    className="meeting-stage__scene"
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.32, ease: EASE }}
                  >
                    <Scene beat={beat} reducedMotion={reducedMotion} />
                  </motion.div>
                ) : (
                  <motion.p
                    key="closed"
                    className="meeting-stage__closed"
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reducedMotion ? undefined : { opacity: 0 }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.28 }}
                  >
                    Nothing has been asked for yet.
                  </motion.p>
                )}
              </AnimatePresence>
            </ActionAperture>
          </div>

          <ol className="meeting-stage__pins" aria-label="Completed receipts">
            <AnimatePresence initial={false}>
              {pinned.map(entry => (
                <OutcomePin
                  key={entry.definition.id}
                  icon={entry.definition.icon}
                  outcome={entry.definition.outcome}
                  reducedMotion={reducedMotion}
                />
              ))}
            </AnimatePresence>
          </ol>
        </div>
      </div>
    </div>
  );
}
