import { motion } from 'motion/react';
import type { StageSegment } from './sceneRegistry';

/** Words the recogniser may still revise stay visually provisional. */
const REVISABLE_WORDS = 2;

function splitInterim(interimText: string): { settled: string; tail: string } {
  const words = interimText.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { settled: '', tail: '' };
  const cut = Math.max(0, words.length - REVISABLE_WORDS);
  return { settled: words.slice(0, cut).join(' '), tail: words.slice(cut).join(' ') };
}

export interface StreamingLineProps {
  segment: StageSegment;
  active: boolean;
  reducedMotion: boolean;
}

export default function StreamingLine({ segment, active, reducedMotion }: StreamingLineProps) {
  const [name, role] = segment.speaker.split(' · ');
  const { settled, tail } = splitInterim(segment.interimText);
  const classes = [
    'streaming-line',
    segment.relevant ? 'is-question' : '',
    active && !segment.isFinal ? 'is-live' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.li
      className={classes}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.34, ease: [0.23, 1, 0.32, 1] }}
    >
      <span className="streaming-line__meta">
        <strong>{name}</strong>
        {role && <small>{role}</small>}
      </span>
      <p className="streaming-line__text">
        {segment.text && <span>{segment.text}</span>}
        {segment.text && settled ? ' ' : null}
        {settled && <span>{settled}</span>}
        {(segment.text || settled) && tail ? ' ' : null}
        {tail && <span className="streaming-line__tail">{tail}</span>}
      </p>
    </motion.li>
  );
}
