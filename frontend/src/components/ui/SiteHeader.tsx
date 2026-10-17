'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useIsNativeApp } from '@/lib/nativeApp';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();
  const inNativeApp = useIsNativeApp();
  const isPlayRoute = /\/(play|offline|bot)(\/|$)/.test(pathname);

  // The Android app supplies its own native navigation chrome.
  if (!isAuthenticated || inNativeApp || pathname === '/' || pathname.startsWith('/download') || isPlayRoute) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#101310]/90 backdrop-blur-xl [@media(max-height:520px)]:static">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/games" className="flex min-h-11 shrink-0 items-center gap-2 text-white">
            <Image src="/gameverse-mark.svg" alt="" width={30} height={30} priority />
            <span className="font-display text-base font-bold">GameVerse</span>
          </Link>
          <nav aria-label="Primary" className="hidden sm:block">
            <Link
              href="/games"
              className="rounded-md px-3 py-2 text-sm font-semibold text-game-muted transition-colors hover:bg-white/5 hover:text-white"
            >
              Games
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/download"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-game-mint/40 bg-game-mint/10 px-3 text-sm font-bold text-game-mint transition-colors hover:bg-game-mint/20"
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            <span>Get app</span>
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-white">{user?.username}</p>
            <p className="text-xs text-game-muted">Guest player</p>
          </div>
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#252923] text-lg min-[400px]:flex" aria-hidden="true">
            {user?.avatar ?? 'G'}
          </span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-game-muted transition-colors hover:bg-white/5 hover:text-white sm:px-3"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}