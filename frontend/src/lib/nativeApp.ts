'use client';

import { useSyncExternalStore } from 'react';

interface NativeBridgeInfo {
  platform?: string;
  bridge?: number;
  capabilities?: string[];
}

type NativeWindow = Window & {
  ReactNativeWebView?: { postMessage: (message: string) => void };
  __GAMEVERSE_NATIVE__?: NativeBridgeInfo;
};

const APP_USER_AGENT = /GameVerseApp\//;

function nativeWindow(): NativeWindow | null {
  return typeof window === 'undefined' ? null : (window as NativeWindow);
}

/** True when the page runs inside the GameVerse Android app's WebView. */
export function isNativeApp(): boolean {
  const current = nativeWindow();
  if (!current) return false;
  return Boolean(
    current.ReactNativeWebView ||
      current.__GAMEVERSE_NATIVE__ ||
      APP_USER_AGENT.test(current.navigator.userAgent),
  );
}

export function hasNativeCapability(capability: string): boolean {
  const current = nativeWindow();
  return Boolean(
    current?.ReactNativeWebView &&
      current.__GAMEVERSE_NATIVE__?.capabilities?.includes(capability),
  );
}

const noopSubscribe = () => () => undefined;

/** Hydration-safe hook: false during SSR and the first client render pass. */
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(noopSubscribe, isNativeApp, () => false);
}

export type DevicePlatform = 'android' | 'ios' | 'desktop' | 'unknown';

export function detectPlatform(): DevicePlatform {
  const current = nativeWindow();
  if (!current) return 'unknown';
  const agent = current.navigator.userAgent;
  if (/android/i.test(agent)) return 'android';
  if (/iphone|ipad|ipod/i.test(agent) || (/macintosh/i.test(agent) && current.navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  return 'desktop';
}

export function useDevicePlatform(): DevicePlatform {
  return useSyncExternalStore(noopSubscribe, detectPlatform, () => 'unknown');
}

/**
 * Hands a generated file to the Android app, which opens the system share
 * sheet. Android WebView cannot download in-page data:/blob: URLs itself.
 */
export function saveFileWithNativeApp(file: { filename: string; mimeType: string; base64: string }): boolean {
  const current = nativeWindow();
  if (!current?.ReactNativeWebView || !hasNativeCapability('save-file')) return false;
  current.ReactNativeWebView.postMessage(JSON.stringify({ type: 'save-file', file }));
  return true;
}

/** Copies text with the async Clipboard API and a WebView-safe fallback. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path (Android WebView, insecure contexts).
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    field.style.pointerEvents = 'none';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch {
    return false;
  }
}
