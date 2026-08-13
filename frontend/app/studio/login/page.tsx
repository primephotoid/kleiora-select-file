'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Check, Loader2, MousePointerClick } from 'lucide-react';
import { apiRequest } from '@/lib/api';

const developmentCredentials = {
  email: 'admin@kleiora.local',
  password: 'KleioraAdmin2026!',
};

export default function StudioLoginPage() {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', studio_name: 'Kleiora Grads' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [credentialsFilled, setCredentialsFilled] = useState(false);

  function fillDevelopmentCredentials() {
    setForm(current => ({
      ...current,
      email: developmentCredentials.email,
      password: developmentCredentials.password,
    }));
    setCredentialsFilled(true);
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      if (register) await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      const result = await apiRequest<{ token: string; user: object }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) });
      localStorage.setItem('kleiora_token', result.token);
      localStorage.setItem('kleiora_user', JSON.stringify(result.user));
      router.push('/dashboard');
    } catch (err) { setError(err instanceof Error ? err.message : 'Tidak dapat masuk.'); }
    finally { setLoading(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[var(--surface2)] px-6 py-16"><div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-xl"><Link href="/" className="font-serif text-3xl font-semibold">Kleiora<span className="text-[var(--gold)]">.grads</span></Link><div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--text)] text-[var(--surface)]"><Camera className="h-5 w-5" /></div><h1 className="mt-5 font-serif text-3xl">{register ? 'Buat akun studio' : 'Masuk ke studio'}</h1><p className="mt-2 text-sm text-[var(--muted)]">Kelola booking, pembayaran, dan galeri pilihan klien.</p>{process.env.NODE_ENV === 'development' && !register && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-amber-800"><MousePointerClick className="h-4 w-4" />Akun development</div><div className="mt-3 space-y-2 font-mono text-xs"><button type="button" onClick={() => setForm(current => ({...current, email: developmentCredentials.email}))} className="block w-full rounded-lg bg-white px-3 py-2 text-left hover:bg-amber-100"><span className="font-sans text-[var(--muted)]">Email: </span>{developmentCredentials.email}</button><button type="button" onClick={() => setForm(current => ({...current, password: developmentCredentials.password}))} className="block w-full rounded-lg bg-white px-3 py-2 text-left hover:bg-amber-100"><span className="font-sans text-[var(--muted)]">Password: </span>{developmentCredentials.password}</button></div><button type="button" onClick={fillDevelopmentCredentials} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-800">{credentialsFilled ? <Check className="h-4 w-4" /> : <MousePointerClick className="h-4 w-4" />}{credentialsFilled ? 'Kredensial sudah terisi' : 'Isi otomatis'}</button></div>}{error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<form onSubmit={submit} className="mt-6 space-y-4">{register && <><label className="block text-sm font-bold">Nama lengkap<input required className="field mt-2" value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})}/></label><label className="block text-sm font-bold">Nama studio<input required className="field mt-2" value={form.studio_name} onChange={e => setForm({...form,studio_name:e.target.value})}/></label></>}<label className="block text-sm font-bold">Email<input required type="email" autoComplete="email" className="field mt-2" value={form.email} onChange={e => { setForm({...form,email:e.target.value}); setCredentialsFilled(false); }}/></label><label className="block text-sm font-bold">Password<input required minLength={8} type="password" autoComplete="current-password" className="field mt-2" value={form.password} onChange={e => { setForm({...form,password:e.target.value}); setCredentialsFilled(false); }}/></label><button disabled={loading} className="btn-primary w-full px-6 py-3.5 disabled:opacity-50">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{register ? 'Daftar & Masuk' : 'Masuk'}</button></form><button onClick={() => setRegister(v => !v)} className="mt-5 w-full text-center text-sm font-semibold text-[var(--gold-dark)]">{register ? 'Sudah punya akun? Masuk' : 'Belum punya akun studio? Daftar'}</button><style jsx>{`.field{width:100%;border:1px solid var(--line);border-radius:.75rem;background:var(--bg);padding:.8rem;font-weight:400;outline:none}.field:focus{border-color:var(--gold)}`}</style></div></main>;
}
