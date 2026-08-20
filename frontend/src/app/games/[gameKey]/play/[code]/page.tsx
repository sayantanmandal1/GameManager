import { notFound } from 'next/navigation';
import { DistinctGamePlayClient } from '@/components/distinct/DistinctGamePlayClient';
import { isDistinctGameKey } from '@/shared';

export default async function DistinctGamePlayPage({ params }: { params: Promise<{ gameKey: string; code: string }> }) {
  const { gameKey, code } = await params;
  if (!isDistinctGameKey(gameKey) || !/^\d{6}$/.test(code)) notFound();
  return <DistinctGamePlayClient gameKey={gameKey} code={code} />;
}