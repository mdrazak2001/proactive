import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SceneProps } from './sceneRegistry';

const EASE = [0.23, 1, 0.32, 1] as const;
const LENS_STOPS = [64, 300, 470, 662];

/**
 * The spoken question becomes one optical pass along a single evidence line:
 * R42 condenses into the lens, the lens draws the 5xx rise, the applyCoupon
 * TypeError resolves from the same trail, and Stripe is optically ruled out.
 *
 * Stripe 342ms is a prior fact: it appears as soon as Cliff's line commits
 * (beat 2), slightly before Sienna starts speaking. Her line (beat 3) only
 * rules it out.
 */
export default function EvidenceWakeScene({ beat, reducedMotion }: SceneProps) {
  const [contracted, setContracted] = useState(false);
  const stage = Math.min(beat, 3);
  const showStripe = beat >= 2;
  const ruleOutStripe = beat >= 3;

  useEffect(() => {
    if (beat < 3) {
      setContracted(false);
      return;
    }
    if (reducedMotion) {
      setContracted(true);
      return;
    }
    const timer = window.setTimeout(() => setContracted(true), 2100);
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
        <line className="scene__hairline" x1="40" y1="86" x2="740" y2="86" />

        <motion.text
          className="scene__token"
          x="56"
          y="74"
          animate={{ opacity: stage >= 1 ? 0 : 1, x: stage >= 1 ? 4 : 0 }}
          transition={{ duration: duration ?? 0.5, ease: EASE }}
        >
          R42
        </motion.text>

        <motion.path
          className="scene__fault-trace"
          d="M 170 86 C 224 86, 246 46, 300 40"
          pathLength="1"
          initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: stage >= 1 ? 1 : 0.001, opacity: stage >= 1 ? 1 : 0 }}
          transition={{ duration: duration ?? 0.9, ease: EASE }}
        />
        <motion.text
          className="scene__label scene__label--fault"
          x="310"
          y="36"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: stage >= 1 ? 1 : 0 }}
          transition={{ duration: duration ?? 0.4, delay: reducedMotion ? 0 : 0.5 }}
        >
          checkout 5xx 0.8% → 12.6%
        </motion.text>

        <motion.g
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: stage >= 2 ? 1 : 0 }}
          transition={{ duration: duration ?? 0.45, ease: EASE }}
        >
          <motion.path
            className="scene__hairline scene__hairline--drop"
            d="M 470 86 L 470 104"
            pathLength="1"
            initial={reducedMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: stage >= 2 ? 1 : 0.001 }}
            transition={{ duration: duration ?? 0.42, ease: EASE }}
          />
          <motion.text
            className="scene__label"
            x="480"
            y="110"
            initial={reducedMotion ? false : { y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: stage >= 2 ? 1 : 0 }}
            transition={{ duration: duration ?? 0.5, ease: EASE, delay: reducedMotion ? 0 : 0.18 }}
          >
            TypeError · applyCoupon
          </motion.text>
        </motion.g>

        <motion.g
          initial={false}
          animate={{ opacity: showStripe ? (ruleOutStripe ? 0.28 : 0.72) : 0 }}
          transition={{
            duration: reducedMotion ? 0 : ruleOutStripe ? 0.7 : 0.45,
            delay: reducedMotion || ruleOutStripe ? 0 : 0.22,
            ease: EASE,
          }}
        >
          <text className="scene__label" x="596" y="50">
            Stripe p95 342ms · baseline
          </text>
          <motion.line
            className="scene__rule-out"
            x1="592"
            y1="46"
            x2="736"
            y2="46"
            pathLength="1"
            initial={reducedMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: ruleOutStripe ? 1 : 0.001 }}
            transition={{ duration: duration ?? 0.5, ease: EASE }}
          />
        </motion.g>

        <motion.g
          animate={{ x: LENS_STOPS[stage] - LENS_STOPS[0] }}
          transition={{ duration: duration ?? 1.1, ease: EASE }}
        >
          <circle className="scene__lens-halo" cx={LENS_STOPS[0]} cy="86" r="13" />
          <circle className="scene__lens" cx={LENS_STOPS[0]} cy="86" r="9" />
          <path
            className="scene__lens-highlight"
            d={`M ${LENS_STOPS[0] - 5} 83 A 6 6 0 0 1 ${LENS_STOPS[0] + 1} 80`}
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
            R42 caused checkout failures <span>·</span> Stripe healthy
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
