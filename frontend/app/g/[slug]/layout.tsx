import type { Metadata } from 'next';

interface GalleryMetadata {
  slug: string;
  title: string;
  client_name: string;
  photos?: Array<{
    drive_file_id: string;
    file_name: string;
  }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kleioragrads.com';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${siteUrl.replace(/\/$/, '')}/api/v1`;

async function getGallery(slug: string): Promise<GalleryMetadata | null> {
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/galleries/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return null;
    return response.json() as Promise<GalleryMetadata>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const gallery = await getGallery(params.slug);
  if (!gallery) {
    return {
      title: 'Galeri Foto — Kleiora.grads',
      description: 'Lihat dan pilih foto favoritmu dari sesi bersama Kleiora.grads.',
    };
  }

  const title = `${gallery.title} — Kleiora.grads`;
  const description = gallery.client_name
    ? `Halo ${gallery.client_name}, galeri fotomu sudah siap. Lihat dan pilih foto yang ingin diedit sesuai kuota paket.`
    : 'Galeri fotomu sudah siap. Lihat dan pilih foto yang ingin diedit sesuai kuota paket.';
  const galleryUrl = `${siteUrl.replace(/\/$/, '')}/g/${gallery.slug}`;
  const cover = gallery.photos?.[0];
  const imageUrl = cover
    ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(cover.drive_file_id)}=w1200`
    : `${siteUrl.replace(/\/$/, '')}/images/hero-home.jpg`;

  return {
    title,
    description,
    alternates: { canonical: galleryUrl },
    openGraph: {
      type: 'website',
      locale: 'id_ID',
      siteName: 'Kleiora.grads',
      title,
      description,
      url: galleryUrl,
      images: [{
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: cover?.file_name || gallery.title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
