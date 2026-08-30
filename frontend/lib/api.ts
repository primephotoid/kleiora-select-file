const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:4000/api/v1`;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
};

export const API_BASE_URL = getApiBaseUrl();

export function getImageUrl(path: string | undefined | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads/')) {
    const relativePath = path.slice('/uploads/'.length).split('/').map(encodeURIComponent).join('/');
    return `${API_BASE_URL.replace(/\/$/, '')}/media/${relativePath}`;
  }
  return path;
}

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
  is_active: boolean;
  sort_order: number;
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
  payment_type: 'full' | 'dp' | 'dp_custom';
  amount_due: number;
  payment_status: string;
  status: string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
  gallery?: { id: number; slug: string; title: string; status: string; drive_folder_id?: string; selection?: { total_selected: number } };
}

export interface PortfolioItem {
  id: number;
  title: string;
  image_path: string;
  is_active: boolean;
  sort_order: number;
}

export interface ReviewItem {
  id: number;
  client_name: string;
  rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: init?.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (error) {
    // Menangkap error jaringan seperti server mati atau masalah CORS
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('Failed to fetch')) {
      throw new Error('Gagal menghubungi server. Pastikan server backend sedang menyala (npm run dev/air) dan konfigurasi CORS sudah benar.');
    }
    throw new Error(`Koneksi ke server bermasalah: ${errMsg}`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Error ${response.status}: Permintaan tidak dapat diproses oleh server.`);
  }
  return payload as T;
}

export async function uploadPackageImage(file: File, token: string): Promise<{ message: string; path: string }> {
  const formData = new FormData();
  formData.append('image', file);
  return apiRequest<{ message: string; path: string }>('/studio/packages/upload-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

export async function reorderPackages(items: { id: number; sort_order: number }[], token: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/studio/packages/reorder', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(items),
  });
}

export async function uploadPortfolioImage(file: File, token: string): Promise<{ message: string; path: string }> {
  const formData = new FormData();
  formData.append('image', file);
  return apiRequest<{ message: string; path: string }>('/studio/portfolios/upload-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

export interface PathCount {
  path: string;
  count: number;
}

export interface AnalyticsSummary {
  total_views: number;
  unique_visits: number;
  views_by_path: PathCount[];
  recent_history: any[]; // Adjust type if needed
}

export async function trackEvent(sessionId: string, path: string, action = 'page_view') {
  return apiRequest('/analytics/track', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, path, action }),
  });
}

export async function getAnalyticsSummary(token: string): Promise<AnalyticsSummary> {
  return apiRequest<AnalyticsSummary>('/studio/analytics', {
    headers: { Authorization: `Bearer ${token}` }
  });
}
