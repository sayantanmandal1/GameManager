import ConnectFourPlayClient from './ConnectFourPlayClient';

export default async function ConnectFourPlayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ConnectFourPlayClient code={/^\d{6}$/.test(code) ? code : ''} />;
}