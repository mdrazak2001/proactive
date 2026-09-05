import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import './GlassSurface.css';

// Minimal adaptation of React Bits' GlassSurface:
// https://github.com/DavidHDev/react-bits/blob/main/src/content/Components/GlassSurface/GlassSurface.jsx

type GlassSurfaceStyle = CSSProperties & {
  '--glass-surface-filter': string;
};

export interface GlassSurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children?: ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  /** Subtle, achromatic backdrop displacement in CSS pixels. */
  displacement?: number;
}

function supportsSvgBackdropFilter(filterId: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.CSS?.supports) {
    return false;
  }

  const browserSignature = window.navigator.userAgent.toLowerCase();
  const isFirefox = browserSignature.includes('firefox');
  const isSafari = browserSignature.includes('safari')
    && !browserSignature.includes('chrome')
    && !browserSignature.includes('chromium');
  if (isFirefox || isSafari) return false;

  const filterValue = `url("#${filterId}")`;
  const supportsProperty = window.CSS.supports('backdrop-filter', filterValue)
    || window.CSS.supports('-webkit-backdrop-filter', filterValue);
  if (!supportsProperty) return false;

  const probe = document.createElement('div');
  probe.style.setProperty('backdrop-filter', filterValue);
  probe.style.setProperty('-webkit-backdrop-filter', filterValue);

  return probe.style.getPropertyValue('backdrop-filter') !== ''
    || probe.style.getPropertyValue('-webkit-backdrop-filter') !== '';
}

export default function GlassSurface({
  children,
  className = '',
  width = 44,
  height = 44,
  borderRadius = 22,
  displacement = 4,
  style,
  ...rest
}: GlassSurfaceProps) {
  const reactId = useId().replace(/:/g, '');
  const filterId = `evidence-lens-${reactId}`;
  const [svgFilterSupported, setSvgFilterSupported] = useState(false);

  useEffect(() => {
    setSvgFilterSupported(supportsSvgBackdropFilter(filterId));
  }, [filterId]);

  const surfaceStyle: GlassSurfaceStyle = {
    width,
    height,
    borderRadius,
    ...style,
    '--glass-surface-filter': `url("#${filterId}")`,
  };

  return (
    <div
      {...rest}
      className={`glass-surface glass-surface--${svgFilterSupported ? 'svg' : 'fallback'} ${className}`.trim()}
      style={surfaceStyle}
    >
      <svg className="glass-surface__filter" aria-hidden="true" focusable="false">
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018 0.024"
              numOctaves="1"
              seed="8"
              result="displacementMap"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="displacementMap"
              scale={displacement}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <span className="glass-surface__content">{children}</span>
    </div>
  );
}
