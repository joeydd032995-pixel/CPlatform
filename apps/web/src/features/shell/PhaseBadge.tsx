import { Badge } from '@/components/ui/badge';
import type { RevealPhase } from './reveal-phase';

const LABELS: Record<RevealPhase, string> = {
  idle: 'Ready',
  dealing: 'Dealing…',
  revealing: 'Revealing…',
  done: 'Complete',
};

const VARIANTS: Record<RevealPhase, 'secondary' | 'default' | 'outline'> = {
  idle: 'outline',
  dealing: 'secondary',
  revealing: 'secondary',
  done: 'default',
};

export function PhaseBadge({ phase }: { phase: RevealPhase }) {
  return (
    <Badge variant={VARIANTS[phase]} className="tabular-nums">
      {LABELS[phase]}
    </Badge>
  );
}