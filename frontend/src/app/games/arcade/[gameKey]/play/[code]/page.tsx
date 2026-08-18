import ArcadePlayClient from './ArcadePlayClient';

export default async function ArcadePlayPage({
  params,
}: {
  params: Promise<{ gameKey: string; code: string }>;
}) {
  const { gameKey, code } = await params;
  const validKey = /^[a-z0-9-]{2,64}$/.test(gameKey) ? gameKey : '';
  const validCode = /^\d{6}$/.test(code) ? code : '';
  return <ArcadePlayClient gameKey={validKey} code={validCode} />;
}
