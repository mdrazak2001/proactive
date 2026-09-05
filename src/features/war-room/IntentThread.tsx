import { AnimatePresence, motion } from 'motion/react';

export interface IntentThreadProps {
  /** The spoken instruction the aperture is currently acting on. */
  intent: string | undefined;
  reducedMotion: boolean;
}

export default function IntentThread({ intent, reducedMotion }: IntentThreadProps) {
  const open = Boolean(intent);

  return (
    <div className={`intent-thread${open ? ' is-open' : ''}`}>
      <div className="intent-thread__row">
        <span className="intent-thread__caret" aria-hidden="true" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={intent ?? 'idle'}
            className="intent-thread__sentence"
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
          >
            {intent ?? 'Listening for a spoken instruction.'}
          </motion.p>
        </AnimatePresence>
      </div>
      <svg
        className="intent-thread__tether"
        width="72"
        height="18"
        viewBox="0 0 72 18"
        aria-hidden="true"
        focusable="false"
      >
        <motion.path
          d="M 5 0 C 5 11, 30 6, 30 18"
          pathLength="1"
          initial={reducedMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: open ? 1 : 0.001 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.44, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
    </div>
  );
}
