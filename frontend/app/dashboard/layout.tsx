import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard Studio',
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
