import './globals.css';
import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kleioragrads.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Jasa Foto Wisuda Profesional — Kleiora Grads',
    template: '%s | Kleiora Grads',
  },
  description: 'Jasa foto wisuda profesional untuk berbagai kota di Indonesia dengan booking online, pilihan paket transparan, dan galeri pribadi.',
  applicationName: 'Kleiora Grads',
  authors: [{ name: 'Kleiora Grads', url: siteUrl }],
  creator: 'Kleiora Grads',
  publisher: 'Kleiora Grads',
  category: 'Photography',
  keywords: [
    'jasa foto wisuda',
    'fotografer wisuda',
    'jasa foto wisuda Indonesia',
    'foto graduation',
    'foto wisuda outdoor',
    'paket foto wisuda',
    'studio foto wisuda',
    'Kleiora Grads',
  ],
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png', sizes: '512x512' }],
    shortcut: '/icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'Kleiora.grads',
    title: 'Jasa Foto Wisuda Profesional — Kleiora Grads',
    description: 'Booking jasa foto wisuda secara online dan pilih hasil foto favoritmu melalui galeri pribadi.',
    url: '/',
    images: [{
      url: '/images/hero-home.jpg',
      width: 1200,
      height: 630,
      alt: 'Kleiora Grads',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jasa Foto Wisuda Profesional — Kleiora Grads',
    description: 'Booking jasa foto wisuda secara online dan pilih hasil foto favoritmu melalui galeri pribadi.',
    images: ['/images/hero-home.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
