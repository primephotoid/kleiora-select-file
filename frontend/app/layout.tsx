import './globals.css';
import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kleioragrads.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Kleiora Grads — Booking Foto Wisuda Makassar',
  description: 'Booking sesi foto wisuda Kleiora Grads dan pilih hasil foto favoritmu dalam satu tempat.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'Kleiora.grads',
    title: 'Kleiora Grads — Booking Foto Wisuda Makassar',
    description: 'Booking sesi foto wisuda Kleiora Grads dan pilih hasil foto favoritmu dalam satu tempat.',
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
    title: 'Kleiora Grads — Booking Foto Wisuda Makassar',
    description: 'Booking sesi foto wisuda Kleiora Grads dan pilih hasil foto favoritmu dalam satu tempat.',
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
