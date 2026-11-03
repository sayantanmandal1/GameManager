const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const config = require('../src/config.ts');

function createScreen() {
  const slots = [];
  let cursor = 0;
  let reloads = 0;
  const slot = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return index;
  };
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: {
      useState: (initial) => {
        const index = slot(initial);
        return [slots[index], (value) => { slots[index] = value; }];
      },
      useRef: (initial) => slots[slot({ current: initial })],
      useMemo: (factory) => factory(),
      useEffect: () => {},
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', View: 'View',
      StyleSheet: { create: (styles) => styles },
      useWindowDimensions: () => ({ width: 412, height: 800, fontScale: 1 }),
      Linking: { openURL: () => Promise.resolve() },
    },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-webview': { WebView: 'WebView' },
    '../config': config,
    '../theme': { colors: {} },
    '../services/auth': { isGuestSession: () => false },
    '../services/nativeFiles': { MAX_SAVE_BASE64_LENGTH: 1000 },
  };
  const compiled = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/screens/GameWebView.tsx'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(output, {
    exports: compiled.exports,
    require: (name) => {
      assert(name in mocks, `Unexpected screen dependency: ${name}`);
      return mocks[name];
    },
  });
  const flatten = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
    ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
  const render = () => {
    cursor = 0;
    const nodes = flatten(compiled.exports.GameWebView({
      destination: { route: '/games/liars-deck', title: "Liar's Deck" },
      session: { user: { id: 'qa', username: 'QA' }, token: 'test-only' },
      onSessionChange: async () => {}, onClose: () => {},
    }));
    const web = nodes.find((node) => node.type === 'WebView').props;
    web.ref.current = { reload: () => { reloads++; } };
    return {
      web, nodes,
      loading: nodes.some((node) => node.type === 'Text' && node.props.children === 'Opening table…'),
      error: nodes.some((node) => node.type === 'Text' && node.props.children === 'Connection problem'),
    };
  };
  return { render, reloads: () => reloads };
}

test('completed pages stay visible across Android SPA history events', () => {
  const screen = createScreen();
  assert(screen.render().loading);
  screen.render().web.onLoadEnd();
  assert(!screen.render().loading);
  const web = screen.render().web;
  assert.equal(web.onLoadStart, undefined);
  web.onNavigationStateChange({ canGoBack: true, loading: true });
  assert(!screen.render().loading);
});

test('top-frame loads show the overlay; progress and navigation completion clear it', () => {
  const screen = createScreen();
  screen.render().web.onLoadEnd();
  assert(screen.render().web.onShouldStartLoadWithRequest({ url: `${config.WEB_ORIGIN}/games`, isTopFrame: false }));
  assert(!screen.render().loading);
  assert(screen.render().web.onShouldStartLoadWithRequest({ url: `${config.WEB_ORIGIN}/games`, isTopFrame: true }));
  assert(screen.render().loading);
  screen.render().web.onLoadProgress({ nativeEvent: { progress: 0.9 } });
  assert(screen.render().loading);
  screen.render().web.onLoadProgress({ nativeEvent: { progress: 1 } });
  assert(!screen.render().loading);
  screen.render().web.onShouldStartLoadWithRequest({ url: `${config.WEB_ORIGIN}/games`, isTopFrame: true });
  screen.render().web.onNavigationStateChange({ canGoBack: true, loading: false });
  assert(!screen.render().loading);
});

test('failed loads stay explicit and both retry controls reset the error', () => {
  const screen = createScreen();
  for (const control of ['Try again', 'Reload game']) {
    screen.render().web.onError();
    assert(screen.render().error);
    assert(!screen.render().loading);
    const button = screen.render().nodes.find((node) => node.type === 'Pressable'
      && (node.props.accessibilityLabel === control || node.props.children?.props.children === control));
    button.props.onPress();
    assert(!screen.render().error);
    assert(screen.render().loading);
  }
  assert.equal(screen.reloads(), 2);
});

test('renderer recovery reloads explicitly without preserving a stale error', () => {
  const screen = createScreen();
  screen.render().web.onError();
  screen.render().web.onRenderProcessGone();
  assert(!screen.render().error);
  assert(screen.render().loading);
  assert.equal(screen.reloads(), 1);
});
