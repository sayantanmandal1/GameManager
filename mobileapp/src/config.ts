const DEFAULT_API_URL = 'https://gamemanager-8icc.onrender.com';
const DEFAULT_WEB_URL = 'https://game-manager-two.vercel.app';

export const API_URL = requireHttpsUrl(
  process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL,
  'EXPO_PUBLIC_API_URL',
);

export const WEB_URL = requireHttpsUrl(
  process.env.EXPO_PUBLIC_WEB_URL ?? DEFAULT_WEB_URL,
  'EXPO_PUBLIC_WEB_URL',
);

export const WEB_ORIGIN = new URL(WEB_URL).origin;

function requireHttpsUrl(raw: string, variableName: string): string {
  const normalized = raw.trim().replace(/\/$/, '');
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${variableName} must be a valid URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${variableName} must use HTTPS`);
  }
  return normalized;
}