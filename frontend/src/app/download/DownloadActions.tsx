'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import qrcode from 'qrcode-generator';
import { ArrowRight, Check, Copy, Download, Globe, Smartphone } from 'lucide-react';
import { copyText, useDevicePlatform, useIsNativeApp } from '@/lib/nativeApp';

/** Stable link that redirects to the newest APK (see app/download/android/route.ts). */
export const ANDROID_DOWNLOAD_PATH = '/download/android';

const noopSubscribe = () => () => undefined;

export function PrimaryDownloadActions({ meta, align = 'start' }: Readonly<{ meta: string; align?: 'start' | 'center' }>) {
  const platform = useDevicePlatform();
  const inNativeApp = useIsNativeApp();
  const justify = align === 'center' ? 'justify-center' : 'justify-center sm:justify-start';

  if (inNativeApp) {
    return (
      <div className={`flex flex-wrap items-center gap-3 ${justify}`}>
        <p className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-game-mint/40 bg-game-mint/10 px-4 text-sm font-bold text-game-mint">
          <Check className="h-4 w-4" aria-hidden="true" /> You&apos;re playing in the GameVerse app
        </p>
      </div>
    );
  }

  if (platform === 'ios') {
    return (
      <div className="space-y-3">
        <div className={`flex flex-wrap items-center gap-3 ${justify}`}>
          <Link href="/" className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-game-sun px-6 text-base font-black text-[#171912] shadow-[0_14px_34px_rgba(242,201,76,0.28)] transition hover:bg-[#ffdc63]">
            <Globe className="h-5 w-5" aria-hidden="true" /> Play in Safari
          </Link>
        </div>
        <p className={`text-sm text-white/75 ${align === 'center' ? 'text-center' : 'text-center sm:text-left'}`}>
          The GameVerse app is Android-only for now. On iPhone, every game plays instantly in Safari — use Share → Add to Home Screen for an app-like icon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`flex flex-wrap items-center gap-3 ${justify}`}>
        <a
          href={ANDROID_DOWNLOAD_PATH}
          className="group inline-flex min-h-14 items-center gap-2.5 rounded-xl bg-game-mint px-6 text-base font-black text-[#0f241a] shadow-[0_16px_40px_rgba(99,213,164,0.35)] transition hover:-translate-y-0.5 hover:bg-[#7ee0b7]"
        >
          <Download className="h-5 w-5 transition group-hover:translate-y-0.5" aria-hidden="true" />
          Download for Android
        </a>
        <Link href="/" className="inline-flex min-h-14 items-center gap-2 rounded-xl border border-white/20 px-5 text-base font-bold text-white transition hover:bg-white/5">
          Play in browser <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <p className={`text-sm text-white/70 ${align === 'center' ? 'text-center' : 'text-center sm:text-left'}`}>
        {meta}
        {platform === 'desktop' && ' · Scan the QR code to install on your phone'}
      </p>
    </div>
  );
}

export function DownloadQrCode({ path = '/download' }: Readonly<{ path?: string }>) {
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => null);
  const target = origin ? `${origin}${path}` : null;
  const qr = useMemo(() => {
    if (!target) return null;
    const code = qrcode(0, 'M');
    code.addData(target);
    code.make();
    const size = code.getModuleCount();
    let pathData = '';
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (code.isDark(row, column)) pathData += `M${column} ${row}h1v1h-1z`;
      }
    }
    return { size, pathData };
  }, [target]);

  if (!qr || !target) {
    return <div className="h-44 w-44 animate-pulse rounded-2xl bg-white/10" aria-hidden="true" />;
  }
  return (
    <svg
      viewBox={`-3 -3 ${qr.size + 6} ${qr.size + 6}`}
      role="img"
      aria-label={`QR code that opens ${target}`}
      className="h-44 w-44 rounded-2xl bg-white shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
      shapeRendering="crispEdges"
    >
      <path d={qr.pathData} fill="#101310" />
    </svg>
  );
}

export function CopyChecksum({ value }: Readonly<{ value: string }>) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!(await copyText(value))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-semibold text-white/85 transition hover:bg-white/5"
      aria-label={copied ? 'SHA-256 checksum copied' : 'Copy SHA-256 checksum'}
    >
      {copied ? <Check className="h-4 w-4 text-game-mint" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function PhoneHint() {
  const platform = useDevicePlatform();
  if (platform !== 'android') return null;
  return (
    <p className="inline-flex items-center gap-2 text-sm text-white/75">
      <Smartphone className="h-4 w-4 text-game-mint" aria-hidden="true" />
      You&apos;re on Android — the download starts right away.
    </p>
  );
}
