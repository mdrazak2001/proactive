import type { ComponentType } from 'react';
import { FileSearch, Mail, SquareTerminal, type LucideIcon } from 'lucide-react';
import CodePatchScene from './CodePatchScene';
import EvidenceWakeScene from './EvidenceWakeScene';
import MailDispatchScene from './MailDispatchScene';
import PromiseCheckScene from './PromiseCheckScene';

/** The subset of a SpacetimeDB transcript_segment row the stage reads. */
export interface StageSegment {
  id: bigint;
  sequence: number;
  speaker: string;
  text: string;
  interimText: string;
  isFinal: boolean;
  relevant: boolean;
}

export interface SceneProps {
  /**
   * How many transcript lines have committed since the scene's phrase was
   * spoken. Scene beats advance on row arrival, never on a local loop.
   * Evidence-wake Stripe appears on beat 2 (after Cliff), and is ruled out
   * on beat 3 (Sienna), so the graph leads the spoken confirmation.
   */
  beat: number;
  reducedMotion: boolean;
}

export interface SceneDefinition {
  id: string;
  /** Lowercase fragment of the spoken sentence that opens this scene. */
  phrase: string;
  /** The spoken instruction, restated as the aperture's intent. */
  intent: string;
  /** Provider and access boundary, shown as a receipt inside the aperture. */
  scope: string;
  outcome: string;
  icon?: LucideIcon;
  component: ComponentType<SceneProps>;
}

export const sceneRegistry: SceneDefinition[] = [
  {
    id: 'evidence-wake',
    phrase: 'is it us, or is stripe degrading',
    intent: 'Is it us, or is Stripe degrading?',
    scope: 'checkout-api · read-only',
    outcome: 'R42 caused checkout failures · Stripe healthy',
    component: EvidenceWakeScene,
  },
  {
    id: 'code-patch',
    phrase: 'patch the missing retry guard',
    intent: 'Patch the missing retry guard, run the focused tests, prepare a draft PR.',
    scope: 'checkout-api · branch only · no merge',
    outcome: 'Retry patched · 3 tests passed · draft PR ready',
    icon: SquareTerminal,
    component: CodePatchScene,
  },
  {
    id: 'mail-dispatch',
    phrase: 'email hr and legal the rollout status',
    intent: 'Email HR and Legal the rollout status, attach the policy, flag the training gap.',
    scope: 'workspace mail · approved recipients',
    outcome: 'HR + Legal · policy attached · training gap flagged',
    icon: Mail,
    component: MailDispatchScene,
  },
  {
    id: 'promise-check',
    phrase: 'check whether acme was promised sso or scim',
    intent: 'Check whether Acme was promised SSO or SCIM by October.',
    scope: 'account history · read-only',
    outcome: 'SSO in October · SCIM not committed',
    icon: FileSearch,
    component: PromiseCheckScene,
  },
];

export interface ResolvedScene {
  definition: SceneDefinition;
  /** Sequence of the transcript line that spoke the phrase. */
  triggerSequence: number;
}

function spokenText(segment: StageSegment): string {
  return `${segment.text} ${segment.interimText}`.replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Reads the live transcript in spoken order and returns the scenes whose phrase
 * has already been heard. An interim tail matches as soon as it has grown past
 * the phrase, so a one-minute recording never needs an extra click.
 */
export function resolveScenes(segments: StageSegment[]): ResolvedScene[] {
  const resolved: ResolvedScene[] = [];
  for (const segment of segments) {
    const heard = spokenText(segment);
    if (!heard.trim()) continue;
    for (const definition of sceneRegistry) {
      if (resolved.some(entry => entry.definition.id === definition.id)) continue;
      if (heard.includes(definition.phrase)) {
        resolved.push({ definition, triggerSequence: segment.sequence });
      }
    }
  }
  return resolved;
}

/** Committed lines at or after the trigger drive the scene's beats. */
export function beatForScene(segments: StageSegment[], triggerSequence: number): number {
  return segments.filter(segment => segment.sequence >= triggerSequence && segment.isFinal).length;
}
