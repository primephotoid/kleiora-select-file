'use client';

import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { CropArea as CropAreaResult } from 'react-easy-crop';
import { Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import getCroppedImg from '@/lib/cropImage';

interface ImageCropperProps {
  /** Data URL or Object URL of the source image to crop */
  imageSrc: string;
  /** Aspect ratio of the crop area (e.g. 3/4 for portrait, 3/2 for landscape) */
  aspect: number;
  /** Label shown in the modal header */
  title?: string;
  /** Called with the cropped File when user confirms */
  onCropConfirm: (file: File) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Original file name, used to name the output file */
  fileName?: string;
}

export function ImageCropper({
  imageSrc,
  aspect,
  title = 'Sesuaikan Foto',
  onCropConfirm,
  onCancel,
  fileName = 'cropped.jpg',
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropAreaResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: CropAreaResult, croppedPixels: CropAreaResult) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const file = await getCroppedImg(imageSrc, croppedAreaPixels, fileName, mimeType);
      onCropConfirm(file);
    } catch {
      // If crop fails, just cancel
      onCancel();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/80 backdrop-blur-sm p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--gold-dark)]">Penyesuaian Foto</p>
            <h2 className="mt-0.5 font-serif text-xl font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] transition hover:bg-[var(--surface2)] disabled:opacity-50"
            aria-label="Batal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cropper area */}
        <div className="relative h-80 bg-[#111]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={true}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: '2px solid #c9a97a', borderRadius: '8px' },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 border-t border-[var(--line)] bg-[var(--surface2)] px-6 py-4">
          <ZoomOut className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--line)] accent-[var(--gold)]"
            aria-label="Zoom"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <span className="w-10 shrink-0 text-right text-[11px] font-bold text-[var(--muted)]">
            {zoom.toFixed(1)}×
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-[var(--line)] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="btn-secondary flex-1 px-5 py-3 text-sm"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing}
            className="btn-primary flex-[1.5] px-5 py-3 text-sm disabled:opacity-50"
          >
            {processing ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {processing ? 'Memproses...' : 'Crop & Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
