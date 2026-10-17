import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeCheck,
  Bot,
  ChevronDown,
  Globe,
  Hash,
  Mic,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { AppShowcase } from '@/components/download/AppShowcase';
import { ALL_GAME_CHIPS, GAME_COUNT } from '@/lib/gameShowcase';
import {
  ANDROID_MIN_VERSION,
  ANDROID_RELEASES_PAGE,
  formatApkSize,
  getLatestAndroidRelease,
} from '@/lib/androidRelease';
import { ANDROID_DOWNLOAD_PATH, CopyChecksum, DownloadQrCode, PhoneHint, PrimaryDownloadActions } from './DownloadActions';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Download GameVerse for Android',
  description: `Install the GameVerse Android app: ${GAME_COUNT} multiplayer games with voice chat and live crossplay with friends on the web.`,
  openGraph: {
    title: 'GameVerse for Android',
    description: `${GAME_COUNT} multiplayer games, voice chat and live crossplay — free, no ads, no sign-up.`,
    type: 'website',
  },
};

const FEATURES = [
  { icon: Globe, title: 'Live crossplay', body: 'Android and web players share the same rooms, cards and turns in real time.' },
  { icon: Mic, title: 'Voice chat', body: 'Talk to your table with built-in voice chat. The microphone is only used when you join.' },
  { icon: RefreshCw, title: 'Rejoin instantly', body: 'Switched apps or lost signal? Come back to the same seat, hand and score.' },
  { icon: Hash, title: 'Room codes', body: 'Share a six-digit code and friends land straight in your lobby.' },
  { icon: Bot, title: 'Bots & solo play', body: 'Fill Monopoly seats with bots, take on Tic Tac Toe and Connect Four AIs, or unwind with Sudoku.' },
  { icon: Zap, title: 'Always up to date', body: 'New games and fixes reach the app automatically — no reinstall needed for game updates.' },
] as const;

const STEPS = [
  { title: 'Download the APK', body: 'Tap “Download for Android”. Your browser may ask you to confirm because the file is an app — choose Download.' },
  { title: 'Allow the install', body: 'Open GameVerse.apk from your notifications or Downloads. If Android asks, allow your browser to install apps.' },
  { title: 'Install GameVerse', body: 'Tap Install. Play Protect may flag apps from outside the Play Store — choose More details → Install anyway.' },
  { title: 'Pick a name & play', body: 'Enter a player name, join a friend’s room code or start a new table. No account needed.' },
] as const;

const FAQS = [
  { q: 'Is GameVerse free?', a: 'Yes. Every game is free to play, with no ads, no in-app purchases and no sign-up — you just pick a player name.' },
  { q: 'Is the APK safe to install?', a: 'Every APK is built automatically from the public GameVerse source code on GitHub and signed with the GameVerse release key. You can compare the SHA-256 checksum on this page with your download.' },
  { q: 'Why does Android show a warning?', a: 'Android asks for confirmation for any app installed outside the Play Store. That prompt is expected — allow your browser to install apps, then tap Install.' },
  { q: 'Can I play with friends on the website?', a: 'Yes. The app and the website share the same tables, so Android players and browser players join the same rooms with the same room code.' },
  { q: 'How do updates work?', a: 'Games, rules and fixes update automatically inside the app. When a new app version is released, download it here and install it over the existing app.' },
  { q: 'Is there an iPhone app?', a: 'Not yet. On iPhone and iPad, every game plays in Safari — use Share → Add to Home Screen for an app-like icon.' },
] as const;

function formatReleaseDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export default async function DownloadPage() {
  const release = await getLatestAndroidRelease();
  const size = formatApkSize(release.sizeBytes);
  const released = formatReleaseDate(release.publishedAt);
  const meta = [
    release.version ? `Version ${release.version}` : 'Latest build',
    size,
    `${ANDROID_MIN_VERSION} or newer`,
  ].filter(Boolean).join(' · ');
  const marqueeChips = [...ALL_GAME_CHIPS, ...ALL_GAME_CHIPS];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#101310] text-white">
      <nav aria-label="Download page" className="sticky top-0 z-40 border-b border-white/10 bg-[#101310]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2">
            <Image src="/gameverse-mark.svg" alt="" width={30} height={30} priority />
            <span className="font-display text-base font-bold">GameVerse</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white sm:inline-flex">
              Play in browser
            </Link>
            <a href={ANDROID_DOWNLOAD_PATH} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-game-mint px-4 text-sm font-black text-[#0f241a] hover:bg-[#7ee0b7]">
              <Smartphone className="h-4 w-4" aria-hidden="true" /> Get the app
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="tabletop-scene relative overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-game-mint/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-game-sun/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:py-20">
          <div className="text-center sm:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-game-mint/35 bg-game-mint/10 px-3 py-1.5 text-xs font-black uppercase text-game-mint">
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> GameVerse for Android
            </p>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] sm:text-5xl lg:text-6xl">
              Every game night, <span className="text-game-sun">in your pocket.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/80 sm:mx-0 sm:text-lg">
              {GAME_COUNT} multiplayer games — Contract Bridge, Monopoly, UNO, Chess and dozens more — with voice chat, instant rejoin and live crossplay with friends on the web.
            </p>
            <div className="mt-8">
              <PrimaryDownloadActions meta={meta} />
            </div>
            <ul className="mt-8 grid gap-3 text-left text-sm text-white/80 sm:grid-cols-3">
              <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 shrink-0 text-game-sun" aria-hidden="true" />Free, no ads</li>
              <li className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0 text-game-sun" aria-hidden="true" />No sign-up, just a name</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-game-sun" aria-hidden="true" />Signed builds + checksum</li>
            </ul>
          </div>
          <AppShowcase />
        </div>
      </section>

      {/* Stats */}
      <section aria-label="GameVerse at a glance" className="border-b border-white/10 bg-[#141813]">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
          {[
            [String(GAME_COUNT), 'games to play'],
            ['1–10', 'players per table'],
            ['Web + Android', 'one shared table'],
            ['0', 'ads or sign-ups'],
          ].map(([value, label]) => (
            <div key={label} className="bg-[#141813] px-4 py-6 text-center sm:py-8">
              <dt className="sr-only">{label}</dt>
              <dd className="font-display text-2xl font-black text-white sm:text-3xl">{value}</dd>
              <dd className="mt-1 text-sm text-white/70">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="features-title">
        <p className="text-sm font-black uppercase text-game-coral">Built for game night</p>
        <h2 id="features-title" className="mt-2 max-w-2xl text-3xl font-black sm:text-4xl">Everything the table needs, nothing it doesn&apos;t.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-[#1a1e19] p-6 transition hover:border-white/20">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-game-mint/15 text-game-mint" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Game marquee */}
      <section aria-labelledby="games-title" className="border-y border-white/10 bg-[#141813] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="games-title" className="text-2xl font-black sm:text-3xl">All {GAME_COUNT} games, one app</h2>
          <p className="mt-2 text-white/75">Cards, boards, dice and party classics — every table on the web is in the app too.</p>
        </div>
        <div className="marquee-mask mt-8 overflow-hidden">
          <ul className="marquee-track flex w-max" aria-label="Games available in the app">
            {marqueeChips.map((game, index) => (
              <li
                key={`${game.name}-${index}`}
                aria-hidden={index >= ALL_GAME_CHIPS.length ? true : undefined}
                className="mr-3 flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-[#1f241e] px-4 py-2 text-sm font-semibold text-white/90"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: game.accent }} />
                {game.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Install steps + release */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" aria-labelledby="install-title">
        <div>
          <p className="text-sm font-black uppercase text-game-coral">Install in a minute</p>
          <h2 id="install-title" className="mt-2 text-3xl font-black sm:text-4xl">Four quick steps</h2>
          <div className="mt-3"><PhoneHint /></div>
          <ol className="mt-8 space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 rounded-2xl border border-white/10 bg-[#1a1e19] p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-game-sun font-display text-lg font-black text-[#171912]">{index + 1}</span>
                <div>
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-white/75">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex gap-3 rounded-2xl border border-game-blue/30 bg-game-blue/10 p-5 text-sm leading-6 text-white/85">
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-game-blue" aria-hidden="true" />
            <p>
              <strong className="text-white">Updating?</strong>{' '}
              {release.signedForUpdates
                ? 'Install the new APK over the existing app — it updates in place and keeps you signed in. If you installed an early test build, uninstall that one once first; early builds used temporary signing keys.'
                : 'This build uses a temporary signing key, so uninstall any older GameVerse app before installing it.'}
            </p>
          </div>
        </div>

        <aside className="space-y-6" aria-label="Release details">
          <div className="rounded-2xl border border-white/10 bg-[#1a1e19] p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-game-sun/15 text-game-sun" aria-hidden="true"><PackageCheck className="h-5 w-5" /></span>
              <div>
                <h2 className="text-lg font-bold">Latest release</h2>
                <p className="text-sm text-white/70">GameVerse.apk</p>
              </div>
            </div>
            <dl className="mt-5 divide-y divide-white/10 text-sm">
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-white/70">Version</dt><dd className="font-semibold">{release.version ?? 'Latest build'}</dd></div>
              {released && <div className="flex justify-between gap-4 py-2.5"><dt className="text-white/70">Released</dt><dd className="font-semibold">{released}</dd></div>}
              {size && <div className="flex justify-between gap-4 py-2.5"><dt className="text-white/70">Download size</dt><dd className="font-semibold">{size}</dd></div>}
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-white/70">Requires</dt><dd className="font-semibold">{ANDROID_MIN_VERSION} or newer</dd></div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-white/70">Signature</dt>
                <dd className="flex items-center gap-1.5 font-semibold">{release.signedForUpdates && <BadgeCheck className="h-4 w-4 text-game-mint" aria-hidden="true" />}{release.signedForUpdates ? 'GameVerse release key' : 'Temporary build key'}</dd>
              </div>
            </dl>
            {release.sha256 && (
              <div className="mt-4 rounded-xl bg-black/25 p-3">
                <p className="text-xs font-bold uppercase text-white/70">SHA-256 checksum</p>
                <p className="mt-1 break-all font-mono text-xs leading-5 text-white/90">{release.sha256}</p>
                <div className="mt-2"><CopyChecksum value={release.sha256} /></div>
              </div>
            )}
            <a href={ANDROID_DOWNLOAD_PATH} className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-game-mint text-base font-black text-[#0f241a] hover:bg-[#7ee0b7]">
              Download APK
            </a>
            <a href={ANDROID_RELEASES_PAGE} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white">
              All releases on GitHub
            </a>
          </div>

          <div className="hidden items-center gap-5 rounded-2xl border border-white/10 bg-[#1a1e19] p-6 md:flex">
            <DownloadQrCode />
            <div>
              <h2 className="text-lg font-bold">On a computer?</h2>
              <p className="mt-2 text-sm leading-6 text-white/75">Scan with your Android phone&apos;s camera to open this page and install GameVerse there.</p>
            </div>
          </div>
        </aside>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/10 bg-[#141813]" aria-labelledby="faq-title">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 id="faq-title" className="text-center text-3xl font-black sm:text-4xl">Questions, answered</h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-white/10 bg-[#1a1e19] px-5 open:border-white/20">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-white/70 transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="pb-5 text-sm leading-6 text-white/80">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-white/10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,213,164,0.18),transparent_60%)]" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="text-3xl font-black sm:text-5xl">Deal yourself in.</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">Install GameVerse, share a room code and start playing in under a minute.</p>
          <div className="mt-8"><PrimaryDownloadActions meta={meta} align="center" /></div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-white/65 sm:flex-row sm:px-6">
          <p>© GameVerse · Play together, anywhere.</p>
          <div className="flex gap-2">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-lg px-3 hover:bg-white/5 hover:text-white">Home</Link>
            <a href={ANDROID_RELEASES_PAGE} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg px-3 hover:bg-white/5 hover:text-white">Releases</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
