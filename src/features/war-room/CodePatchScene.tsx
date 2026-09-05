import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SceneProps } from './sceneRegistry';

const EASE = [0.23, 1, 0.32, 1] as const;
const TESTS = [
  { x: 132, label: 'coupon' },
  { x: 236, label: 'retry' },
  { x: 340, label: 'checkout' },
];

/**
 * One spoken instruction becomes one guarded edit: the unguarded call recedes,
 * the retry wrapper is revealed in place, the focused tests seal, and a draft
 * PR is parked without merging.
 */
export default function CodePatchScene({ beat, reducedMotion }: SceneProps) {
  const [contracted, setContracted] = useState(false);
  const clipId = `patch-reveal-${useId().replace(/:/g, '')}`;
  const applied = beat >= 1;

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
        <defs>
          <clipPath id={clipId}>
            <motion.rect
              x="40"
              y="40"
              height="26"
              initial={reducedMotion ? false : { width: 0 }}
              animate={{ width: applied ? 620 : 0 }}
              transition={{ duration: duration ?? 0.85, ease: EASE }}
            />
          </clipPath>
        </defs>

        <motion.g
          animate={{ opacity: applied ? 0.34 : 1 }}
          transition={{ duration: duration ?? 0.5, ease: EASE }}
        >
          <text className="scene__label scene__label--fault" x="40" y="26">
            −
          </text>
          <text className="scene__code" x="60" y="26">
            await applyCoupon(cart, coupon)
          </text>
        </motion.g>

        <g clipPath={`url(#${clipId})`}>
          <text className="scene__label scene__label--signal" x="40" y="60">
            +
          </text>
          <text className="scene__code scene__code--added" x="60" y="60">
            await withRetry(3, () =&gt; applyCoupon(cart, coupon))
          </text>
        </g>

        <line className="scene__hairline" x1="40" y1="98" x2="420" y2="98" />
        {TESTS.map((test, index) => (
          <g key={test.label}>
            <motion.circle
              className="scene__node scene__node--pass"
              cx={test.x}
              cy="98"
              r="4.5"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: applied ? 1 : 0, scale: applied ? 1 : 0.4 }}
              transition={{
                duration: duration ?? 0.34,
                ease: EASE,
                delay: reducedMotion || !applied ? 0 : 0.35 + index * 0.28,
              }}
            />
            <motion.text
              className="scene__label"
              x={test.x - 20}
              y="118"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: applied ? 0.72 : 0 }}
              transition={{
                duration: duration ?? 0.34,
                delay: reducedMotion || !applied ? 0 : 0.4 + index * 0.28,
              }}
            >
              {test.label}
            </motion.text>
          </g>
        ))}
        <text className="scene__label" x="40" y="86">
          focused tests
        </text>

        <motion.g
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: applied ? 1 : 0, y: 0 }}
          transition={{ duration: duration ?? 0.44, ease: EASE, delay: reducedMotion || !applied ? 0 : 1.2 }}
        >
          <rect className="scene__chip scene__chip--review" x="540" y="84" width="200" height="26" rx="6" />
          <text className="scene__label scene__label--review" x="556" y="101">
            draft PR · not merged
          </text>
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
            Retry patched <span>·</span> 3 tests passed <span>·</span> draft PR ready
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
