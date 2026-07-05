import type { LucideIcon } from 'lucide-react';
import {
  Bomb,
  CircleDot,
  Dices,
  Disc3,
  Hash,
  Bird,
  Target,
  ArrowUpDown,
  Spade,
} from 'lucide-react';
import type { GameName } from './games';

export type GameMeta = {
  icon: LucideIcon;
  description: string;
  accent: string;
  accentBg: string;
  accentRing: string;
};

export const gameMeta: Record<GameName, GameMeta> = {
  mines: {
    icon: Bomb,
    description: 'Navigate the grid and avoid hidden mines',
    accent: 'text-amber-400',
    accentBg: 'bg-amber-500/10',
    accentRing: 'ring-amber-500/25 hover:ring-amber-500/50',
  },
  plinko: {
    icon: CircleDot,
    description: 'Drop the ball and chase the multipliers',
    accent: 'text-fuchsia-400',
    accentBg: 'bg-fuchsia-500/10',
    accentRing: 'ring-fuchsia-500/25 hover:ring-fuchsia-500/50',
  },
  dice: {
    icon: Dices,
    description: 'Roll over or under your target',
    accent: 'text-sky-400',
    accentBg: 'bg-sky-500/10',
    accentRing: 'ring-sky-500/25 hover:ring-sky-500/50',
  },
  roulette: {
    icon: Disc3,
    description: 'European wheel with multi-chip betting',
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10',
    accentRing: 'ring-emerald-500/25 hover:ring-emerald-500/50',
  },
  keno: {
    icon: Hash,
    description: 'Pick numbers and match the draw',
    accent: 'text-violet-400',
    accentBg: 'bg-violet-500/10',
    accentRing: 'ring-violet-500/25 hover:ring-violet-500/50',
  },
  chicken: {
    icon: Bird,
    description: 'Cross lanes before the cars arrive',
    accent: 'text-orange-400',
    accentBg: 'bg-orange-500/10',
    accentRing: 'ring-orange-500/25 hover:ring-orange-500/50',
  },
  darts: {
    icon: Target,
    description: 'Hit the board and land in the zone',
    accent: 'text-rose-400',
    accentBg: 'bg-rose-500/10',
    accentRing: 'ring-rose-500/25 hover:ring-rose-500/50',
  },
  hilo: {
    icon: ArrowUpDown,
    description: 'Guess higher or lower on each card',
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-500/10',
    accentRing: 'ring-cyan-500/25 hover:ring-cyan-500/50',
  },
  blackjack: {
    icon: Spade,
    description: 'Beat the dealer to 21',
    accent: 'text-lime-400',
    accentBg: 'bg-lime-500/10',
    accentRing: 'ring-lime-500/25 hover:ring-lime-500/50',
  },
};