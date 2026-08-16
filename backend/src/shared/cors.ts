const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

export function getCorsOrigins(raw = process.env.CORS_ORIGIN): string | string[] {
  const origins = (raw || DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) return DEFAULT_CORS_ORIGIN;
  return origins.length === 1 ? origins[0] : origins;
}