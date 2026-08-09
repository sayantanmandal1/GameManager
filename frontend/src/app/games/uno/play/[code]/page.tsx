import UnoPlayClient from './UnoPlayClient';

/**
 * Server wrapper for the UNO table. Validates the 6-digit room code before
 * handing it to the client component.
 */
export default async function UnoPlayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const safeCode = /^\d{6}$/.test(code) ? code : '';
  return <UnoPlayClient code={safeCode} />;
}
