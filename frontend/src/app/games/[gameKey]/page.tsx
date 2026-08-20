import { notFound } from 'next/navigation';
import { DistinctGameLanding } from '@/components/distinct/DistinctGameLanding';
import { isDistinctGameKey } from '@/shared';

export default async function DistinctGamePage({ params }: { params: Promise<{ gameKey: string }> }) {
  const { gameKey } = await params;
  if (!isDistinctGameKey(gameKey)) notFound();
  return <DistinctGameLanding gameKey={gameKey} />;
}