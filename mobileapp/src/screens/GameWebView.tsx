import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { WEB_ORIGIN, WEB_URL } from '../config';
import { colors } from '../theme';
import type { GuestSession, WebDestination } from '../types';
import { isGuestSession } from '../services/auth';

interface GameWebViewProps {
  readonly destination: WebDestination;
  readonly session: GuestSession;
  readonly onSessionChange: (session: GuestSession) => Promise<void>;
  readonly onClose: () => void;
}

export function GameWebView({ destination, session, onSessionChange, onClose }: GameWebViewProps) {
  const webView = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const uri = useMemo(() => `${WEB_URL}${safeRoute(destination.route)}`, [destination.route]);
  const authScript = useMemo(() => createAuthInjection(session), [session]);
  const authFallbackScript = useMemo(() => createAuthFallbackInjection(session), [session]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO).catch(
      () => undefined,
    );
  }, []);

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

  const handleMessage = (raw: string) => {
    if (raw.length > 12_000) return;
    try {
      const message = JSON.parse(raw) as { type?: unknown; session?: unknown };
      if (message.type === 'auth-session' && isGuestSession(message.session)) {
        void onSessionChange(message.session);
      }
    } catch {
      // Ignore non-JSON messages from game pages.
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.iconButton} accessibilityLabel="Close game">
          <Text style={styles.icon}>×</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={styles.title}>{destination.title}</Text>
          <Text style={styles.crossplay}>LIVE CROSSPLAY</Text>
        </View>
        <Pressable
          onPress={() => webView.current?.reload()}
          style={styles.iconButton}
          accessibilityLabel="Reload game"
        >
          <Text style={styles.reload}>↻</Text>
        </Pressable>
      </View>

      <WebView
        ref={webView}
        source={{ uri }}
        style={styles.webView}
        injectedJavaScriptBeforeContentLoaded={authScript}
        injectedJavaScript={authFallbackScript}
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
        onMessage={(event) => handleMessage(event.nativeEvent.data)}
        onLoadStart={() => {
          setLoading(true);
          setLoadError(null);
        }}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setLoadError('The game page could not be loaded.');
        }}
        renderError={() => <View />}
      />

      {loading && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.mint} size="large" />
          <Text style={styles.loadingText}>Opening table…</Text>
        </View>
      )}
      {loadError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Connection problem</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable onPress={() => webView.current?.reload()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function createAuthInjection(session: GuestSession): string {
  const storageValue = serializedWebSession(session);
  return `
    (function () {
      try {
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
  header: { height: 58, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  iconButton: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  icon: { color: colors.text, fontSize: 30, lineHeight: 32, fontWeight: '400' },
  reload: { color: colors.text, fontSize: 24, fontWeight: '700' },
  titleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  crossplay: { color: colors.mint, fontSize: 8, fontWeight: '900', marginTop: 2 },
  webView: { flex: 1, backgroundColor: colors.background },
  overlay: { position: 'absolute', top: 58, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 14 },
  errorOverlay: { position: 'absolute', top: 58, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background },
  errorTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  errorText: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 8 },
  retryButton: { minHeight: 48, minWidth: 130, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  retryText: { color: '#17201a', fontWeight: '900' },
});