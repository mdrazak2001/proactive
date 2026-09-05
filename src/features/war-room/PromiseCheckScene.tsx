import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SceneProps } from './sceneRegistry';

const EASE = [0.23, 1, 0.32, 1] as const;
const MONTHS = [
  { x: 160, label: 'JUL' },
  { x: 300, label: 'AUG' },
  { x: 440, label: 'SEP' },
  { x: 580, label: 'OCT' },
];

/**
 * One spoken question becomes one pass over the account's commitment history:
 * the SSO promise resolves on the October tick, the SCIM lane ends empty.
 */
export default function PromiseCheckScene({ beat, reducedMotion }: SceneProps) {
  const [contracted, setContracted] = useState(false);
  const searched = beat >= 1;

  useEffect(() => {
    if (!searched) {
      setContracted(false);
      return;
    }
    if (reducedMotion) {
      setContracted(true);
      return;
    }
    const timer = window.setTimeout(() => setContracted(true), 2400);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, searched]);

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
        <line className="scene__hairline" x1="120" y1="64" x2="700" y2="64" />
        {MONTHS.map(month => (
          <g key={month.label}>
            <line className="scene__hairline" x1={month.x} y1="60" x2={month.x} y2="68" />
            <text className="scene__label scene__label--axis" x={month.x - 12} y="82">
              {month.label}
            </text>
          </g>
        ))}

        <text className="scene__label" x="40" y="30">
          SSO
        </text>
        <line className="scene__hairline" x1="120" y1="26" x2="580" y2="26" />
        <motion.g
          initial={reducedMotion ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: searched ? 1 : 0, scale: searched ? 1 : 0.5 }}
          transition={{ duration: duration ?? 0.4, ease: EASE, delay: reducedMotion ? 0 : 1.1 }}
        >
          <circle className="scene__node scene__node--pass" cx="580" cy="26" r="4.5" />
          <text className="scene__label scene__label--signal" x="600" y="30">
            committed in writing · October
          </text>
        </motion.g>
        <motion.path
          className="scene__hairline scene__hairline--drop"
          d="M 580 26 L 580 60"
          pathLength="1"
          initial={reducedMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: searched ? 1 : 0.001 }}
          transition={{ duration: duration ?? 0.5, ease: EASE, delay: reducedMotion ? 0 : 1.2 }}
        />

        <text className="scene__label" x="40" y="112">
          SCIM
        </text>
        <line className="scene__hairline scene__hairline--dashed" x1="120" y1="108" x2="520" y2="108" />
        <motion.g
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: searched ? 1 : 0 }}
          transition={{ duration: duration ?? 0.44, delay: reducedMotion ? 0 : 1.7 }}
        >
          <circle className="scene__node scene__node--open" cx="520" cy="108" r="4.5" />
          <text className="scene__label scene__label--review" x="540" y="112">
            no commitment found
          </text>
        </motion.g>

        <motion.g
          initial={reducedMotion ? false : { x: 0 }}
          animate={{ x: searched ? 460 : 0, opacity: searched ? [0, 1, 1, 0.2] : 0 }}
          transition={{ duration: reducedMotion ? 0 : 1.5, ease: EASE }}
        >
          <circle className="scene__lens-halo" cx="120" cy="64" r="13" />
          <circle className="scene__lens" cx="120" cy="64" r="9" />
          <path className="scene__lens-highlight" d="M 115 61 A 6 6 0 0 1 121 58" />
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
            SSO in October <span>·</span> SCIM not committed
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
