'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Copy, Check, Eye, FolderPlus } from 'lucide-react';

export default function PhotographerDashboardPage() {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newDriveUrl, setNewDriveUrl] = useState('');
  const [selectedGalleryFiles, setSelectedGalleryFiles] = useState<string[]>([
    'WEDDING_AKAD_001.JPG',
    'WEDDING_RESEPSI_014.JPG',
    'WEDDING_RING_002.JPG',
  ]);

  const copyToClipboard = (text: string, formatName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatName);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pt-28 pb-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--gold)] mb-1">
              Dashboard Studio
            </div>
            <h1 className="font-serif text-3xl font-medium">Kelola Galeri & Rekap Seleksi</h1>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[var(--gold)] text-[var(--on-gold)] font-bold text-xs px-5 py-3 rounded-full inline-flex items-center gap-2 hover:brightness-105 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Buat Galeri Baru
          </button>
        </div>

        {/* GALLERY CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[var(--gold)] transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Seleksi Selesai
                </span>
                <span className="text-xs text-[var(--muted)]">12 Agu 2026</span>
              </div>
              <h3 className="font-bold text-lg mb-1">Album Pernikahan: Budi & Anisa</h3>
              <p className="text-xs text-[var(--muted)]">Klien: Anisa Putri</p>
            </div>

            <div className="text-xs text-[var(--muted)] space-y-1 pt-2 border-t border-[var(--line)]">
              <div>Total Foto Drive: <b>12 Foto</b></div>
              <div>Foto Dipilih Klien: <b className="text-[var(--gold)]">3 Foto</b></div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Link
                href="/g/wedding-budi-anisa"
                className="flex-1 text-center py-2 text-xs font-semibold rounded-full border border-[var(--line)] hover:border-[var(--gold)] hover:bg-[var(--surface2)] transition-all"
              >
                Lihat Galeri
              </Link>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex-1 py-2 text-xs font-bold rounded-full bg-[var(--gold)] text-[var(--on-gold)] hover:brightness-105 transition-all"
              >
                Ekspor Rekap
              </button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[var(--gold)] transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)] bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                  Aktif (Menunggu Klien)
                </span>
                <span className="text-xs text-[var(--muted)]">10 Agu 2026</span>
              </div>
              <h3 className="font-bold text-lg mb-1">Prewedding Outdoor: Dimas & Sarah</h3>
              <p className="text-xs text-[var(--muted)]">Klien: Dimas Anggara</p>
            </div>

            <div className="text-xs text-[var(--muted)] space-y-1 pt-2 border-t border-[var(--line)]">
              <div>Total Foto Drive: <b>24 Foto</b></div>
              <div>Foto Dipilih Klien: <b>0 Foto</b></div>
            </div>

            <div className="pt-2">
              <Link
                href="/g/wedding-budi-anisa"
                className="w-full block text-center py-2 text-xs font-semibold rounded-full border border-[var(--line)] hover:border-[var(--gold)] hover:bg-[var(--surface2)] transition-all"
              >
                Lihat Tampilan Klien
              </Link>
            </div>
          </div>
        </div>

        {/* EXPORT REKAP MODAL */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl max-w-lg w-full p-6 space-y-4">
              <h3 className="font-serif text-xl font-semibold">Rekap Seleksi (Adobe Lightroom Ready)</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Salin daftar nama file di bawah ini dan langsung tempel di kolom pencarian Adobe Lightroom atau Windows File Explorer.
              </p>

              <div>
                <label className="block text-xs font-semibold mb-1">Format Dipisah Koma (Search Lightroom):</label>
                <textarea
                  readOnly
                  value={selectedGalleryFiles.join(', ')}
                  rows={2}
                  className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 text-xs font-mono text-[var(--gold)] outline-none"
                />
                <button
                  onClick={() => copyToClipboard(selectedGalleryFiles.join(', '), 'comma')}
                  className="mt-2 text-xs font-bold text-[var(--gold)] flex items-center gap-1 hover:underline"
                >
                  {copiedFormat === 'comma' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedFormat === 'comma' ? 'Tersalin!' : 'Salin Format Koma'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Format Per Baris (Daftar Cetak):</label>
                <textarea
                  readOnly
                  value={selectedGalleryFiles.join('\n')}
                  rows={3}
                  className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 text-xs font-mono text-[var(--gold)] outline-none"
                />
                <button
                  onClick={() => copyToClipboard(selectedGalleryFiles.join('\n'), 'line')}
                  className="mt-2 text-xs font-bold text-[var(--gold)] flex items-center gap-1 hover:underline"
                >
                  {copiedFormat === 'line' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedFormat === 'line' ? 'Tersalin!' : 'Salin Per Baris'}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-5 py-2 rounded-full text-xs font-bold bg-[var(--gold)] text-[var(--on-gold)] hover:brightness-105"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE GALLERY MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="font-serif text-xl font-semibold">Buat Galeri Klien Baru</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Masukkan tautan folder Google Drive publik untuk membuat galeri seleksi interaktif bagi klien Anda.
              </p>

              <div>
                <label className="block text-xs font-semibold mb-1">Judul Album / Galeri</label>
                <input
                  type="text"
                  placeholder="Contoh: Graduation Photo — Siska & Friends"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 text-xs outline-none focus:border-[var(--gold)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Nama Klien</label>
                <input
                  type="text"
                  placeholder="Contoh: Siska Amelia"
                  value={newClient}
                  onChange={e => setNewClient(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 text-xs outline-none focus:border-[var(--gold)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Link Folder Google Drive (Publik)</label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={newDriveUrl}
                  onChange={e => setNewDriveUrl(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 text-xs outline-none focus:border-[var(--gold)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold border border-[var(--line)] hover:bg-[var(--surface2)]"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    alert('Galeri berhasil dibuat!');
                  }}
                  className="px-5 py-2 rounded-full text-xs font-bold bg-[var(--gold)] text-[var(--on-gold)] hover:brightness-105"
                >
                  Simpan & Buat Galeri
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
