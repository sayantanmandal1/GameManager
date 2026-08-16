import type { Metadata } from 'next';
import { DM_Sans, Space_Grotesk } from 'next/font/google';
import { SiteHeader } from '@/components/ui/SiteHeader';
import './globals.css';

const bodyFont = DM_Sans({ subsets: ['latin'], variable: '--font-body' });
const displayFont = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'GameVerse | Play Together',
  description: 'Real-time tabletop games for friends on web and mobile.',
  icons: {
    icon: '/gameverse-mark.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen bg-game-bg text-game-text`}>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
