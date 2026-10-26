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
    <header className="glass-chrome sticky top-0 z-40 [@media(max-height:520px)]:static">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/games" className="flex min-h-11 shrink-0 items-center gap-2 text-white">
            <Image src="/gameverse-mark.svg" alt="" width={30} height={30} priority />
            <span className="font-display text-base font-semibold">GameVerse</span>
          </Link>
          <nav aria-label="Primary" className="hidden sm:block">
            <Link
              href="/games"
              aria-current={pathname === '/games' ? 'page' : undefined}
              className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-medium text-game-text transition-colors hover:bg-white/10"
            >
              Games
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/download"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-game-text transition-colors hover:bg-white/10"
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            <span>Get app</span>
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-white">{user?.username}</p>
            <p className="text-xs text-game-muted">Guest player</p>
          </div>
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-game-card text-lg min-[400px]:flex" aria-hidden="true">
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