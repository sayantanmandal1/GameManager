import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { WEB_ORIGIN, WEB_URL } from '../config';
import { colors } from '../theme';
import type { GuestSession, WebDestination } from '../types';
import { isGuestSession } from '../services/auth';
import { MAX_SAVE_BASE64_LENGTH, parseSaveFileRequest, shareGeneratedFile } from '../services/nativeFiles';

/** Bumped whenever the native bridge gains capabilities the website can use. */
const NATIVE_BRIDGE_VERSION = 2;
const NATIVE_CAPABILITIES = ['save-file'] as const;
const HEADER_HEIGHT = 52;
const MAX_AUTH_MESSAGE_LENGTH = 12_000;

interface GameWebViewProps {
  readonly destination: WebDestination;
  readonly session: GuestSession;
  readonly onSessionChange: (session: GuestSession) => Promise<void>;
  readonly onClose: () => void;
}

export function GameWebView({ destination, session, onSessionChange, onClose }: GameWebViewProps) {
  const webView = useRef<WebView>(null);
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const headerHeight = landscape ? 0 : HEADER_HEIGHT;
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const uri = useMemo(() => `${WEB_URL}${safeRoute(destination.route)}`, [destination.route]);
  const authScript = useMemo(() => createAuthInjection(session), [session]);
  const authFallbackScript = useMemo(() => createAuthFallbackInjection(session), [session]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webView.current?.goBack();
      } else {
        onClose();
      }
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack, onClose]);

  const handleNavigation = (navigation: WebViewNavigation) => {
    setCanGoBack(navigation.canGoBack);
  };

  const allowNavigation = (request: { url: string }): boolean => {
    if (request.url === 'about:blank' || request.url.startsWith(WEB_ORIGIN)) return true;
    if (request.url.startsWith('https://')) Linking.openURL(request.url).catch(() => undefined);
    return false;
  };

  const shareFile = async (payload: unknown) => {
    const request = parseSaveFileRequest(payload);
    if (!request || sharing) return;
    setSharing(true);
    try {
      await shareGeneratedFile(request);
    } catch (error) {
      Alert.alert('Could not save the file', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleMessage = (raw: string) => {
    if (raw.length > MAX_SAVE_BASE64_LENGTH + 2_000) return;
    try {
      const message = JSON.parse(raw) as { type?: unknown; session?: unknown; file?: unknown };
      if (message.type === 'auth-session' && raw.length <= MAX_AUTH_MESSAGE_LENGTH && isGuestSession(message.session)) {
        void onSessionChange(message.session);
      } else if (message.type === 'save-file') {
        void shareFile(message.file);
      }
    } catch {
      // Ignore non-JSON messages from game pages.
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar style="light" hidden={landscape} />
      {!landscape && (
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Close game">
            <Text style={styles.icon}>×</Text>
          </Pressable>
          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={styles.title}>{destination.title}</Text>
            <Text style={styles.crossplay}>LIVE CROSSPLAY</Text>
          </View>
          <Pressable
            onPress={() => webView.current?.reload()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Reload game"
          >
            <Text style={styles.reload}>↻</Text>
          </Pressable>
        </View>
      )}

      <WebView
        ref={webView}
        source={{ uri }}
        style={styles.webView}
        injectedJavaScriptBeforeContentLoaded={authScript}
        injectedJavaScript={authFallbackScript}
        applicationNameForUserAgent={`GameVerseApp/${NATIVE_BRIDGE_VERSION}`}
        textZoom={100}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        originWhitelist={[`${WEB_ORIGIN}/*`]}
        onShouldStartLoadWithRequest={allowNavigation}
        onNavigationStateChange={handleNavigation}
        onMessage={(event) => {
          // Only the trusted GameVerse origin may use the native bridge.
          if (!event.nativeEvent.url?.startsWith(WEB_ORIGIN)) return;
          handleMessage(event.nativeEvent.data);
        }}
        onLoadStart={() => {
          setLoading(true);
          setLoadError(null);
        }}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setLoadError('The game page could not be loaded.');
        }}
        onRenderProcessGone={() => webView.current?.reload()}
        renderError={() => <View />}
      />

      {loading && (
        <View style={[styles.overlay, { top: headerHeight }]} pointerEvents="none">
          <ActivityIndicator color={colors.mint} size="large" />
          <Text style={styles.loadingText}>Opening table…</Text>
        </View>
      )}
      {sharing && (
        <View style={[styles.overlay, styles.sharingOverlay, { top: headerHeight }]} pointerEvents="none">
          <ActivityIndicator color={colors.mint} size="large" />
          <Text style={styles.loadingText}>Preparing your file…</Text>
        </View>
      )}
      {loadError && (
        <View style={[styles.errorOverlay, { top: headerHeight }]}>
          <Text style={styles.errorTitle}>Connection problem</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable onPress={() => webView.current?.reload()} style={styles.retryButton} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.secondaryButton} accessibilityRole="button">
            <Text style={styles.secondaryText}>Back to games</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function createAuthInjection(session: GuestSession): string {
  const storageValue = serializedWebSession(session);
  const native = { platform: 'android', bridge: NATIVE_BRIDGE_VERSION, capabilities: NATIVE_CAPABILITIES };
  return `
    (function () {
      try {
        window.__GAMEVERSE_NATIVE__ = ${JSON.stringify(native)};
        window.localStorage.setItem('auth-storage', ${JSON.stringify(storageValue)});
      } catch (_) {}
    })();
    true;
  `;
}

function createAuthFallbackInjection(session: GuestSession): string {
  const storageValue = serializedWebSession(session);
  return `
    (function () {
      try {
        var expected = ${JSON.stringify(storageValue)};
        if (!window.localStorage.getItem('auth-storage')) {
          window.localStorage.setItem('auth-storage', expected);
          window.location.reload();
        }
      } catch (_) {}
    })();
    true;
  `;
}

function serializedWebSession(session: GuestSession): string {
  return JSON.stringify({
    state: {
      user: session.user,
      token: session.token,
      isAuthenticated: true,
    },
    version: 0,
  });
}

function safeRoute(route: string): string {
  if (!/^\/(games(?:\/[a-z0-9-]+)*(?:\?[a-zA-Z0-9=&_-]+)?|lobby\/\d{6})$/.test(route)) {
    return '/games';
  }
  return route;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { height: HEADER_HEIGHT, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  pressed: { opacity: 0.6 },
  icon: { color: colors.text, fontSize: 30, lineHeight: 32, fontWeight: '400' },
  reload: { color: colors.text, fontSize: 24, fontWeight: '700' },
  titleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },
  crossplay: { color: colors.mint, fontSize: 9, fontWeight: '600', marginTop: 3, letterSpacing: 1.2 },
  webView: { flex: 1, backgroundColor: colors.background },
  overlay: { position: 'absolute', right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  sharingOverlay: { backgroundColor: 'rgba(11, 13, 18, 0.95)' },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 14 },
  errorOverlay: { position: 'absolute', right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background },
  errorTitle: { color: colors.text, fontSize: 26, fontWeight: '600', letterSpacing: -0.7 },
  errorText: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 8 },
  retryButton: { minHeight: 48, minWidth: 150, borderRadius: 16, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', marginTop: 24, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: '#17201a', fontWeight: '900' },
  secondaryButton: { minHeight: 48, minWidth: 150, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 20, paddingVertical: 12 },
  secondaryText: { color: colors.text, fontWeight: '800' },
});