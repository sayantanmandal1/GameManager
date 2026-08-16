import TicTacToePlayClient from './TicTacToePlayClient';

export default async function TicTacToePlayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <TicTacToePlayClient code={/^\d{6}$/.test(code) ? code : ''} />;
}