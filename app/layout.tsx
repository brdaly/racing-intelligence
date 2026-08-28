import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://racing.dalyventures.com'),
  title: 'Racing Intelligence | Daly Ventures',
  description: 'A verification-first Horse Club dashboard for ranked races, horses, performance and learning.',
  openGraph: {
    title: 'Daly Ventures Racing Intelligence',
    description: 'Signal over noise. Every race day.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Daly Ventures Racing Intelligence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Daly Ventures Racing Intelligence',
    description: 'Signal over noise. Every race day.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
