import { NextResponse } from 'next/server';
import { getLatestAndroidRelease } from '@/lib/androidRelease';

/**
 * Stable, shareable download link (used by the download page and its QR
 * code). Redirects to the newest published GameVerse APK.
 */
export async function GET() {
  const release = await getLatestAndroidRelease();
  const response = NextResponse.redirect(release.downloadUrl, 302);
  response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
  return response;
}
