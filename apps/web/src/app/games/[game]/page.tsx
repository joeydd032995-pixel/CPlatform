import { notFound } from 'next/navigation';
import { isGameName } from '@/lib/games';
import { GamePage } from '@/components/GamePage';

export default async function GameRoutePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;

  if (!isGameName(game)) {
    notFound();
  }

  return <GamePage game={game} />;
}
