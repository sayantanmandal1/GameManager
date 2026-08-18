# GameVerse Mobile

Expo SDK 57 Android/iOS shell for the GameVerse platform. The app provides:

- native guest authentication stored with `expo-secure-store`;
- a native, searchable 100-multiplayer-game catalog loaded from the same authoritative backend response as web;
- category filters and a global six-digit room join flow;
- full crossplay by opening the production GameVerse routes in a restricted same-origin WebView;
- synchronized guest-session renewal between the WebView and `expo-secure-store`;
- microphone and camera support for voice chat and Photobooth;
- reproducible Android APK builds from GitHub Actions.

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

The native shell fetches `GET /games/catalog` and validates all 101 entries (100 multiplayer plus solo Sudoku) before rendering them. Gameplay uses the shared web route in the same-origin WebView, so rule controls, rematch state, accessibility, and visual fixes remain identical on web and mobile.

## Development

```powershell
npm ci
npm run typecheck
npm start
```

The `android/` project is committed intentionally. Do not run `expo prebuild --clean` casually: it regenerates native files and can overwrite the CI signing/version configuration in `android/app/build.gradle`.

## APK signing in CI

The APK workflow always creates an installable commit-specific release APK. For a production-signed APK, add these GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Generate and protect the upload key as described in Expo's Android release-build documentation. Never commit the keystore or passwords. Without these secrets, CI generates a short-lived random signing key and still creates a standalone release APK. Ephemeral-signed APKs are installable, but updating one ephemeral build with another requires uninstalling the previous build because their signatures differ.

Optional GitHub Actions variables:

- `MOBILE_API_URL`
- `MOBILE_WEB_URL`

Every pushed commit receives a `mobile-<commit SHA>` prerelease with the APK attached, and the workflow run also retains the APK as an artifact.

## Dependency audit note

`npm audit --omit=dev` currently reports advisories through Expo 57's Metro/config toolchain. npm's suggested remediation is a forced downgrade to Expo 53 and React Native 0.72, which is incompatible with this SDK 57 Android project. Keep Expo SDK patches current and review the audit after Expo publishes a compatible Metro/config fix; do not apply `npm audit fix --force`.