import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GameVerse — Multiplayer Gaming Platform',
  description: 'Play Bingo and more with friends in real-time!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-game-text min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
