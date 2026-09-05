import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import GlassSurface from './GlassSurface';

export interface ActionApertureProps {
  icon?: LucideIcon;
  /** Provider and access boundary for the action running inside the aperture. */
  scope?: string;
  open: boolean;
  children: ReactNode;
}

/**
 * The single glass opening of the stage. Nothing else on the stage is glass.
 */
export default function ActionAperture({ icon: Icon, scope, open, children }: ActionApertureProps) {
  return (
    <GlassSurface
      className={`action-aperture${open ? ' is-open' : ''}`}
      width="100%"
      height="100%"
      borderRadius={14}
      displacement={3}
    >
      <div className="action-aperture__frame">
        <div className="action-aperture__receipt">
          <span className="action-aperture__glyph" aria-hidden="true">
            {Icon ? <Icon size={13} strokeWidth={1.6} /> : <i className="action-aperture__lens" />}
          </span>
          <span>{scope ?? 'standing by · no action authorised'}</span>
        </div>
        <div className="action-aperture__stage">{children}</div>
      </div>
    </GlassSurface>
  );
}
