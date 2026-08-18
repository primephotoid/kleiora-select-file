export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

export interface PackageItem {
  id: number;
  code: string;
  name: string;
  description: string;
  price: number;
  duration_hours: number;
  duration_label?: string;

  location_count: number;
  edited_photos: number;
  includes_print?: string;
  includes_teaser: boolean;
  image_path: string;
}

export interface BookingItem {
  id: number;
  code: string;
  package_id: number;
  package: PackageItem;
  full_name: string;
  campus_name: string;
  whatsapp: string;
  session_date: string;
  session_hour: string;
  session_location: string;
  payment_type: 'full' | 'dp';
  amount_due: number;
  payment_status: string;
  status: string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
  gallery?: { id: number; slug: string; title: string; status: string; drive_folder_id?: string; selection?: { total_selected: number } };
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: init?.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Permintaan tidak dapat diproses.');
  }
  return payload as T;
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}
