import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Paket dan Booking Foto Wisuda',
  description: 'Pilih paket, tanggal, jam, dan lokasi sesi foto wisuda Kleiora Grads. Booking dan pembayaran dilakukan secara online.',
  alternates: { canonical: '/booking' },
  openGraph: {
    title: 'Paket dan Booking Foto Wisuda',
    description: 'Pilih paket foto wisuda, jadwal sesi, dan lokasi secara online.',
    url: '/booking',
    images: [{ url: '/images/hero-home.jpg', width: 1200, height: 630, alt: 'Paket foto wisuda Kleiora Grads' }],
  },
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
