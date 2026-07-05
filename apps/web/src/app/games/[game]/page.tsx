import { notFound } from 'next/navigation';
import { isGameName } from '@/lib/games';
import { GamePage } from '@/components/GamePage';
import { MinesRoundPage } from '@/features/shell/MinesRoundPage';
import { BlackjackRoundPage } from '@/features/shell/BlackjackRoundPage';

export default async function GameRoutePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;

  if (!isGameName(game)) {
    notFound();
  }

  // Mines and Blackjack diverge from every other game's one-shot
  // bet-then-reveal contract: they're multi-request rounds (cash-out /
  // real-time decisions), so they get dedicated page components instead of
  // the generic GamePage/BetForm shell. Every other game is unaffected.
  if (game === 'mines') return <MinesRoundPage />;
  if (game === 'blackjack') return <BlackjackRoundPage />;

  return <GamePage game={game} />;
}
