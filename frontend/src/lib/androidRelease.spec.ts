import {
  ANDROID_STABLE_APK_URL,
  formatApkSize,
  getLatestAndroidRelease,
} from './androidRelease';

const SHA = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);

function respond(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

describe('getLatestAndroidRelease', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reads version, checksum and signing from the rolling latest release', async () => {
    global.fetch = jest.fn().mockImplementation(() => respond({
      tag_name: 'mobile-latest',
      name: 'GameVerse for Android 1.0.42',
      body: `Version: 1.0.42\nCommit: ${COMMIT}\nSHA-256: ${SHA}\nSigning: production\n`,
      assets: [{ name: 'GameVerse.apk', size: 37_714_335, updated_at: '2026-10-17T10:00:00Z', browser_download_url: 'https://example.test/GameVerse.apk' }],
    })) as unknown as typeof fetch;

    await expect(getLatestAndroidRelease()).resolves.toEqual({
      downloadUrl: ANDROID_STABLE_APK_URL,
      version: '1.0.42',
      publishedAt: '2026-10-17T10:00:00Z',
      sizeBytes: 37_714_335,
      sha256: SHA,
      commit: COMMIT,
      signedForUpdates: true,
      source: 'latest',
    });
  });

  it('falls back to the newest per-commit build before the first rolling release', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => respond({ message: 'Not Found' }, false))
      .mockImplementationOnce(() => respond([
        { tag_name: 'v1-web', assets: [] },
        {
          tag_name: `mobile-${COMMIT}`,
          name: 'GameVerse Android bbbbbbb',
          body: `Automated installable Android APK. Signing mode: ephemeral. SHA-256: ${SHA}.`,
          assets: [{ name: 'GameVerse-bbbbbbb.apk', size: 1_048_576, browser_download_url: 'https://example.test/commit.apk' }],
        },
      ])) as unknown as typeof fetch;

    const release = await getLatestAndroidRelease();
    expect(release).toMatchObject({
      downloadUrl: 'https://example.test/commit.apk',
      version: null,
      commit: COMMIT,
      sha256: SHA,
      signedForUpdates: false,
      source: 'commit',
    });
  });

  it('never throws and keeps the stable link when GitHub is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(getLatestAndroidRelease()).resolves.toMatchObject({
      downloadUrl: ANDROID_STABLE_APK_URL,
      source: 'fallback',
    });
  });

  it('formats APK sizes in megabytes', () => {
    expect(formatApkSize(37_714_335)).toBe('36.0 MB');
    expect(formatApkSize(null)).toBeNull();
  });
});
