# GameVerse Mobile

Expo SDK 57 Android/iOS shell for the GameVerse platform. The app provides:

- native guest authentication stored with `expo-secure-store`;
- a native, touch-focused game library loaded live from the shared REST catalog (with search, player counts and play-mode badges), plus global six-digit room joining. Catalog validation is structural, so new games appear without an app update;
- full crossplay by opening the production GameVerse routes in a restricted same-origin WebView;
- synchronized guest-session renewal between the WebView and `expo-secure-store`;
- microphone and camera support for voice chat and Photobooth, requested only when a game asks for them;
- a native save/share sheet for files generated in the web app (Photobooth strips), which Android WebView cannot download itself;
- edge-to-edge safe-area handling, fixed 100% text zoom, an immersive landscape mode and automatic recovery if the WebView renderer is killed;
- reproducible Android APK builds from GitHub Actions.

The website detects the app through its `GameVerseApp/<bridge>` user-agent suffix and the injected `window.__GAMEVERSE_NATIVE__` capabilities, hides duplicate browser chrome and download prompts, and routes file downloads through the native bridge.

Players install the APK from the website's `/download` page.

The native login, library, loading, and WebView chrome use the same graphite-and-pearl palette as the website, defined in `src/theme.ts`. Game identity stays in the accent marks; text uses platform fonts. Native press feedback uses opacity rather than animated movement, and the library adapts to phones and tablets.

## Requirements

- Node.js 22.13 or newer (required by Expo SDK 57)
- npm
- Android Studio/JDK 17 only for local native builds

## Configuration

Copy `.env.example` to `.env.local` when overriding production endpoints:

```text
EXPO_PUBLIC_API_URL=https://gamemanager-8icc.onrender.com
EXPO_PUBLIC_WEB_URL=https://game-manager-two.vercel.app
```

Both values must use HTTPS. These are public application endpoints, not secrets.

Gameplay uses the shared web route in the same-origin WebView, so rule controls, rematch state, accessibility, and visual fixes remain identical on web and mobile.

## Development

```powershell
npm ci
npm run typecheck
npm start
```

The `android/` project is committed intentionally. Do not run `expo prebuild --clean` casually: it regenerates native files and can overwrite the CI signing/version configuration in `android/app/build.gradle`.

## APK signing in CI

`master` builds are signed with the permanent GameVerse release key, so each new APK installs over the previous one. The key is provided by these GitHub Actions secrets (already configured for `sayantanmandal1/GameManager`):

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Keep an offline backup of the keystore and its passwords. If the key is lost, installed apps can no longer be updated in place and every player would have to uninstall and reinstall. Never commit the keystore or passwords. Builds without these secrets (pull requests, other branches) use a short-lived random key; those APKs are installable but cannot update one another.

Optional GitHub Actions variables:

- `MOBILE_API_URL`
- `MOBILE_WEB_URL`

Every pushed commit receives a `mobile-<commit SHA>` prerelease with the APK attached, and the workflow run also retains the APK as an artifact. Pushes to `master` additionally refresh the rolling `mobile-latest` release with a stable `GameVerse.apk` asset that the website download page links to.

## Dependency audit note

`npm audit --omit=dev` currently reports advisories through Expo 57's Metro/config toolchain. npm's suggested remediation is a forced downgrade to Expo 53 and React Native 0.72, which is incompatible with this SDK 57 Android project. Keep Expo SDK patches current and review the audit after Expo publishes a compatible Metro/config fix; do not apply `npm audit fix --force`.