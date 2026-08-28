import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kleiora Grads — Booking Foto Wisuda Makassar',
  description: 'Booking sesi foto wisuda Kleiora Grads dan pilih hasil foto favoritmu dalam satu tempat.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
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
