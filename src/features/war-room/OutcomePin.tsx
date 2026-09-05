import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

export interface OutcomePinProps {
  icon?: LucideIcon;
  outcome: string;
  reducedMotion: boolean;
}

/** A completed scene, collapsed to one receipt line. */
export default function OutcomePin({ icon: Icon, outcome, reducedMotion }: OutcomePinProps) {
  return (
    <motion.li
      className="outcome-pin"
      initial={reducedMotion ? false : { opacity: 0, y: -6, scaleY: 0.86 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.36, ease: [0.23, 1, 0.32, 1] }}
    >
      <span className="outcome-pin__glyph" aria-hidden="true">
        {Icon ? <Icon size={11} strokeWidth={1.7} /> : <i className="outcome-pin__lens" />}
      </span>
      <span className="outcome-pin__text">{outcome}</span>
      <span className="outcome-pin__seal" aria-hidden="true" />
    </motion.li>
  );
}
