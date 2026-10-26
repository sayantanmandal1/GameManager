import type { Metadata } from 'next';
import { SiteHeader } from '@/components/ui/SiteHeader';
import { MotionProvider } from '@/components/ui/MotionProvider';
import './globals.css';

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
      <body className="min-h-screen bg-game-bg text-game-text">
        <MotionProvider>
          <SiteHeader />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
