// Server-side helper: only imported by the /download route segment.
const RELEASE_REPO = process.env.ANDROID_RELEASE_REPO || 'sayantanmandal1/GameManager';
const LATEST_TAG = 'mobile-latest';
const STABLE_ASSET = 'GameVerse.apk';
const REVALIDATE_SECONDS = 600;

export const ANDROID_RELEASES_PAGE = `https://github.com/${RELEASE_REPO}/releases`;
/** Stable URL that always serves the newest master build (see mobile-apk.yml). */
export const ANDROID_STABLE_APK_URL = `https://github.com/${RELEASE_REPO}/releases/latest/download/${STABLE_ASSET}`;
export const ANDROID_MIN_VERSION = 'Android 7.0';

export interface AndroidRelease {
  readonly downloadUrl: string;
  readonly version: string | null;
  readonly publishedAt: string | null;
  readonly sizeBytes: number | null;
  readonly sha256: string | null;
  readonly commit: string | null;
  readonly signedForUpdates: boolean;
  readonly source: 'latest' | 'commit' | 'fallback';
}

interface GithubAsset {
  name?: unknown;
  size?: unknown;
  updated_at?: unknown;
  browser_download_url?: unknown;
}

interface GithubRelease {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  draft?: unknown;
  published_at?: unknown;
  assets?: unknown;
}

const FALLBACK_RELEASE: AndroidRelease = {
  downloadUrl: ANDROID_STABLE_APK_URL,
  version: null,
  publishedAt: null,
  sizeBytes: null,
  sha256: null,
  commit: null,
  signedForUpdates: true,
  source: 'fallback',
};

async function githubJson(path: string): Promise<unknown> {
  const response = await fetch(`https://api.github.com/repos/${RELEASE_REPO}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'GameVerse-download-page',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(6_000) : undefined,
  });
  if (!response.ok) return null;
  return response.json();
}

function apkAsset(release: GithubRelease): GithubAsset | null {
  if (!Array.isArray(release.assets)) return null;
  const assets = release.assets as GithubAsset[];
  return assets.find((asset) => asset.name === STABLE_ASSET) ??
    assets.find((asset) => typeof asset.name === 'string' && asset.name.endsWith('.apk')) ??
    null;
}

function describe(release: GithubRelease, asset: GithubAsset, source: AndroidRelease['source']): AndroidRelease {
  const body = typeof release.body === 'string' ? release.body : '';
  const name = typeof release.name === 'string' ? release.name : '';
  const tag = typeof release.tag_name === 'string' ? release.tag_name : '';
  const sha256 = body.match(/SHA-256:\s*([a-f0-9]{64})/i)?.[1]?.toLowerCase() ?? null;
  const commit = body.match(/Commit:\s*([a-f0-9]{40})/i)?.[1] ??
    tag.match(/^mobile-([a-f0-9]{40})$/i)?.[1] ??
    null;
  const signing = body.match(/Signing(?: mode)?:\s*([a-z]+)/i)?.[1]?.toLowerCase() ?? null;
  const downloadUrl = source === 'latest'
    ? ANDROID_STABLE_APK_URL
    : typeof asset.browser_download_url === 'string' ? asset.browser_download_url : ANDROID_STABLE_APK_URL;
  return {
    downloadUrl,
    version: name.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null,
    publishedAt: typeof asset.updated_at === 'string'
      ? asset.updated_at
      : typeof release.published_at === 'string' ? release.published_at : null,
    sizeBytes: typeof asset.size === 'number' ? asset.size : null,
    sha256,
    commit,
    signedForUpdates: signing === 'production',
    source,
  };
}

/**
 * Release metadata for the download page. Prefers the rolling `mobile-latest`
 * release, falls back to the newest per-commit build, and never throws.
 */
export async function getLatestAndroidRelease(): Promise<AndroidRelease> {
  try {
    const latest = (await githubJson(`/releases/tags/${LATEST_TAG}`)) as GithubRelease | null;
    const latestAsset = latest ? apkAsset(latest) : null;
    if (latest && latestAsset) return describe(latest, latestAsset, 'latest');

    const releases = await githubJson('/releases?per_page=15');
    if (Array.isArray(releases)) {
      for (const release of releases as GithubRelease[]) {
        if (release.draft || typeof release.tag_name !== 'string' || !release.tag_name.startsWith('mobile-')) continue;
        const asset = apkAsset(release);
        if (asset) return describe(release, asset, 'commit');
      }
    }
  } catch {
    // Network failures and rate limits fall through to the stable URL.
  }
  return FALLBACK_RELEASE;
}

export function formatApkSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
