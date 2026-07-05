import { Badge } from '@/components/ui/badge';
import type { RevealPhase } from './reveal-phase';

const LABELS: Record<RevealPhase, string> = {
  idle: 'Ready',
  dealing: 'Dealing…',
  revealing: 'Revealing…',
  done: 'Complete',
  'awaiting-decision': 'Your move',
  'action-pending': 'Working…',
};

const VARIANTS: Record<RevealPhase, 'secondary' | 'default' | 'outline'> = {
  idle: 'outline',
  dealing: 'secondary',
  revealing: 'secondary',
  done: 'default',
  'awaiting-decision': 'default',
  'action-pending': 'secondary',
};

export function PhaseBadge({ phase }: { phase: RevealPhase }) {
  return (
    <Badge variant={VARIANTS[phase]} className="tabular-nums">
      {LABELS[phase]}
    </Badge>
  );
}