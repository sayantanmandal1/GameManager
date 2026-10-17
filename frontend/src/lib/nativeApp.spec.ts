import {
  copyText,
  detectPlatform,
  hasNativeCapability,
  isNativeApp,
  saveFileWithNativeApp,
} from './nativeApp';

type TestWindow = Window & {
  ReactNativeWebView?: { postMessage: jest.Mock };
  __GAMEVERSE_NATIVE__?: { capabilities?: string[] };
};

const testWindow = window as TestWindow;

function setUserAgent(value: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

describe('nativeApp', () => {
  const originalAgent = window.navigator.userAgent;

  afterEach(() => {
    delete testWindow.ReactNativeWebView;
    delete testWindow.__GAMEVERSE_NATIVE__;
    setUserAgent(originalAgent);
    jest.restoreAllMocks();
  });

  it('detects the Android app from its bridge or user agent', () => {
    expect(isNativeApp()).toBe(false);
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/155 Mobile GameVerseApp/2');
    expect(isNativeApp()).toBe(true);
    setUserAgent(originalAgent);
    testWindow.ReactNativeWebView = { postMessage: jest.fn() };
    expect(isNativeApp()).toBe(true);
  });

  it('only hands files to the app when it advertises the capability', () => {
    const postMessage = jest.fn();
    testWindow.ReactNativeWebView = { postMessage };
    const file = { filename: 'strip.png', mimeType: 'image/png', base64: 'AAAA' };

    expect(hasNativeCapability('save-file')).toBe(false);
    expect(saveFileWithNativeApp(file)).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();

    testWindow.__GAMEVERSE_NATIVE__ = { capabilities: ['save-file'] };
    expect(saveFileWithNativeApp(file)).toBe(true);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({ type: 'save-file', file });
  });

  it('classifies device platforms', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7)');
    expect(detectPlatform()).toBe('android');
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    expect(detectPlatform()).toBe('ios');
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(detectPlatform()).toBe('desktop');
  });

  it('falls back to execCommand when the Clipboard API is unavailable', async () => {
    Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true });
    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });

    await expect(copyText('123456')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
