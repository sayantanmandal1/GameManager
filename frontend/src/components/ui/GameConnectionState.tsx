'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from './Button';

interface Props {
  readonly connected?: boolean;
  readonly error?: string | null;
  readonly backHref: string;
}

export function GameConnectionState({ connected = false, error, backHref }: Props) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 8_000);
    return () => clearTimeout(timer);
  }, [connected]);

  return (
    <main className="tabletop-scene flex min-h-screen items-center justify-center p-4">
      <section className="premium-panel w-full max-w-md p-6 text-center sm:p-8">
        <p className="eyebrow">Your table</p>
        <h1 className="mt-3 text-2xl font-semibold text-game-text">
          {error ? 'Unable to open the table' : connected ? 'Restoring your match' : 'Connecting to your table'}
        </h1>
        <p role={error ? 'alert' : 'status'} className="mt-4 text-sm leading-6 text-game-muted">
          {error || (slow
            ? 'This is taking longer than expected. Check your connection, then retry to request the latest match state.'
            : connected ? 'We are requesting the latest match state from the server.' : 'We are connecting you to the match server.')}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => window.location.reload()}>Retry connection</Button>
          <Link href={backHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-game-text hover:bg-white/5">
            Back to games
          </Link>
        </div>
      </section>
    </main>
  );
}
