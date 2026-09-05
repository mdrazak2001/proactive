import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SceneProps } from './sceneRegistry';

const EASE = [0.23, 1, 0.32, 1] as const;
const RECIPIENTS = [
  { x: 320, label: 'HR' },
  { x: 470, label: 'Legal' },
];
const TRACK_X = 552;
const TRACK_WIDTH = 180;

/**
 * One spoken instruction becomes one dispatch: two approved recipients resolve
 * on the send line, the approved policy docks as an attachment, and the 82%
 * training gap is flagged rather than smoothed over.
 */
export default function MailDispatchScene({ beat, reducedMotion }: SceneProps) {
  const [contracted, setContracted] = useState(false);
  const dispatched = beat >= 1;

  useEffect(() => {
    if (beat < 2) {
      setContracted(false);
      return;
    }
    if (reducedMotion) {
      setContracted(true);
      return;
    }
    const timer = window.setTimeout(() => setContracted(true), 900);
    return () => window.clearTimeout(timer);
  }, [beat, reducedMotion]);

  const duration = reducedMotion ? 0 : undefined;

  return (
    <div className="scene">
      <motion.svg
        className="scene__plot"
        width="780"
        height="124"
        viewBox="0 0 780 124"
        animate={{ opacity: contracted ? 0.1 : 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.6, ease: EASE }}
        aria-hidden="true"
        focusable="false"
      >
        <g className="scene__envelope">
          <rect x="40" y="34" width="60" height="40" rx="4" />
          <path d="M 40 38 L 70 58 L 100 38" />
        </g>

        <line className="scene__hairline" x1="108" y1="54" x2="512" y2="54" />
        {RECIPIENTS.map((recipient, index) => (
          <g key={recipient.label}>
            <motion.circle
              className="scene__node scene__node--pass"
              cx={recipient.x}
              cy="54"
              r="4.5"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: dispatched ? 1 : 0, scale: dispatched ? 1 : 0.4 }}
              transition={{
                duration: duration ?? 0.34,
                ease: EASE,
                delay: reducedMotion || !dispatched ? 0 : 0.3 + index * 0.3,
              }}
            />
            <motion.text
              className="scene__label"
              x={recipient.x - 10}
              y="40"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: dispatched ? 0.86 : 0 }}
              transition={{
                duration: duration ?? 0.34,
                delay: reducedMotion || !dispatched ? 0 : 0.34 + index * 0.3,
              }}
            >
              {recipient.label}
            </motion.text>
          </g>
        ))}

        <motion.g
          initial={reducedMotion ? false : { opacity: 0, x: -22 }}
          animate={{ opacity: dispatched ? 1 : 0, x: 0 }}
          transition={{ duration: duration ?? 0.5, ease: EASE, delay: reducedMotion || !dispatched ? 0 : 0.9 }}
        >
          <rect className="scene__chip" x="108" y="86" width="256" height="26" rx="6" />
          <text className="scene__label" x="124" y="103">
            rollout-policy.pdf · approved
          </text>
        </motion.g>

        <motion.g
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: dispatched ? 1 : 0 }}
          transition={{ duration: duration ?? 0.4, delay: reducedMotion || !dispatched ? 0 : 1.15 }}
        >
          <text className="scene__label scene__label--review" x={TRACK_X} y="86">
            training coverage 82%
          </text>
          <line className="scene__hairline" x1={TRACK_X} y1="102" x2={TRACK_X + TRACK_WIDTH} y2="102" />
          <motion.line
            className="scene__fill scene__fill--review"
            x1={TRACK_X}
            y1="102"
            x2={TRACK_X + TRACK_WIDTH * 0.82}
            y2="102"
            pathLength="1"
            initial={reducedMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: dispatched ? 1 : 0.001 }}
            transition={{ duration: duration ?? 0.8, ease: EASE, delay: reducedMotion || !dispatched ? 0 : 1.2 }}
          />
        </motion.g>
      </motion.svg>

      <AnimatePresence>
        {contracted && (
          <motion.p
            className="scene__conclusion"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.5, ease: EASE }}
          >
            HR + Legal <span>·</span> policy attached <span>·</span> training gap flagged
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
