import PhotoboothPlayClient from './PhotoboothPlayClient';

/**
 * Server component wrapper for the photobooth session screen. Extracts the
 * dynamic `[code]` path param and hands a validated 6-digit code to the
 * client component (matches the server's lobby-code rules).
 */
export default async function PhotoboothPlayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const safeCode = /^\d{6}$/.test(code) ? code : '';
  return <PhotoboothPlayClient code={safeCode} />;
}
