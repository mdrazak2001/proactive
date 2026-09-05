import { useEffect, useRef } from 'react';
import { rmsFromAnalyser } from './preparedVoice';

const SAMPLES = 26;
const WIDTH = 72;
const HEIGHT = 18;
const MID = HEIGHT / 2;
const STEP = WIDTH / (SAMPLES - 1);
const CEILING = MID - 1.2;

function envelopePath(levels: number[]): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let index = 0; index < levels.length; index += 1) {
    const x = (index * STEP).toFixed(2);
    const amplitude = Math.min(1, (levels[index] ?? 0) * 5.6) * CEILING;
    top.push(`${x},${(MID - amplitude).toFixed(2)}`);
    bottom.unshift(`${x},${(MID + amplitude).toFixed(2)}`);
  }
  return `M ${top.join(' L ')} L ${bottom.join(' L ')} Z`;
}

const QUIET_PATH = envelopePath(new Array<number>(SAMPLES).fill(0));

export interface SpeakerEdgeProps {
  name: string;
  role: string;
  active: boolean;
  reducedMotion: boolean;
  /** Live AnalyserNode from the prepared clip player, or undefined when idle. */
  getAnalyser: () => AnalyserNode | undefined;
}

export default function SpeakerEdge({
  name,
  role,
  active,
  reducedMotion,
  getAnalyser,
}: SpeakerEdgeProps) {
  const pathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    path.setAttribute('d', QUIET_PATH);
    if (!active || reducedMotion) return;

    const levels = new Array<number>(SAMPLES).fill(0);
    let frame = window.requestAnimationFrame(function tick() {
      const analyser = getAnalyser();
      levels.shift();
      levels.push(analyser ? rmsFromAnalyser(analyser) : 0);
      path.setAttribute('d', envelopePath(levels));
      frame = window.requestAnimationFrame(tick);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      path.setAttribute('d', QUIET_PATH);
    };
  }, [active, getAnalyser, reducedMotion]);

  return (
    <div className={`speaker-edge${active ? ' is-active' : ''}`}>
      <span className="speaker-edge__state" aria-hidden="true" />
      <span className="speaker-edge__id">
        <strong>{name}</strong>
        <small>{role}</small>
      </span>
      <svg
        className="speaker-edge__envelope"
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        aria-hidden="true"
        focusable="false"
      >
        <line x1="0" y1={MID} x2={WIDTH} y2={MID} />
        <path ref={pathRef} d={QUIET_PATH} />
      </svg>
    </div>
  );
}
