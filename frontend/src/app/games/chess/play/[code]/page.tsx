import ChessPlayClient from './ChessPlayClient';

/**
 * Server component wrapper for the chess match screen. Extracts the dynamic
 * `[code]` path parameter and delegates to the client component.
 */
export default async function ChessPlayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  // Defensive: only pass 6-digit numeric codes downstream (matches server rules).
  const safeCode = /^\d{6}$/.test(code) ? code : '';
  return <ChessPlayClient code={safeCode} />;
}
