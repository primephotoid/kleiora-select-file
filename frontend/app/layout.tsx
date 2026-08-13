import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kleiora Grads — Pilih Foto Kamu Sekarang',
  description: 'Buat galeri dari Google Drive, bagikan linknya, klien memilih sendiri — hasilnya langsung rapi dan siap kamu proses.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
