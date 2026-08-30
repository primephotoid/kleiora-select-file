'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Play, Pause, X, Film } from 'lucide-react';

interface VideoTrimmerProps {
  videoSrc: string;      // blob URL of the video to preview
  fileName: string;
  originalFile: File;    // original File to pass through on confirm
  maxDuration?: number;  // max seconds allowed (default 60)
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

export function VideoTrimmer({ videoSrc, fileName, originalFile, maxDuration = 60, onConfirm, onCancel }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState('');

  const handleLoaded = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    setDuration(dur);
    if (dur > maxDuration + 1) {
      setError(`Durasi video (${Math.round(dur)}s) melebihi batas ${maxDuration} detik. Harap potong videonya terlebih dahulu menggunakan aplikasi video editor, lalu upload kembali.`);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) { v.pause(); setIsPlaying(false); }
    else { v.play(); setIsPlaying(true); }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnded = () => setIsPlaying(false);
    v.addEventListener('ended', onEnded);
    return () => v.removeEventListener('ended', onEnded);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const tooLong = duration > maxDuration + 1;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center overflow-hidden bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-xl rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--gold-dark)]">Preview Video</p>
            <h2 className="mt-1 font-serif text-2xl">Konfirmasi Video</h2>
            <p className="mt-1 text-xs text-gray-500">Pastikan video yang Anda pilih sudah sesuai sebelum mengupload.</p>
          </div>
          <button onClick={onCancel} className="rounded-full border border-gray-200 p-2 hover:bg-gray-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-700">
            <strong className="block mb-1">⚠ Video Terlalu Panjang</strong>
            {error}
          </div>
        )}

        {/* Video Preview */}
        <div className="relative mt-5 overflow-hidden rounded-2xl bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full max-h-64 object-contain"
            onLoadedMetadata={handleLoaded}
            onTimeUpdate={handleTimeUpdate}
            preload="metadata"
            playsInline
          />
        </div>

        {/* Controls */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={duration === 0}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-white shadow transition hover:opacity-90 disabled:opacity-40"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex-1">
            <div className="mb-1 flex justify-between text-[10px] text-gray-500">
              <span>{formatTime(currentTime)}</span>
              <span className={duration > maxDuration + 1 ? 'font-bold text-red-600' : ''}>
                {duration > 0 ? `${formatTime(duration)} total` : '—'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[var(--gold)] transition-all duration-150" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* File Info */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <Film className="h-5 w-5 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-gray-700">{fileName}</p>
            <p className="text-[10px] text-gray-400">
              {(originalFile.size / (1024 * 1024)).toFixed(1)} MB
              {duration > 0 && ` · ${Math.round(duration)} detik`}
            </p>
          </div>
          {!tooLong && duration > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">✓ Valid</span>
          )}
          {tooLong && (
            <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">Terlalu panjang</span>
          )}
        </div>

        {/* Tip */}
        <p className="mt-3 text-center text-[10px] text-gray-400">
          💡 Potong video menggunakan CapCut, iMovie, atau Premiere Pro sebelum upload untuk hasil terbaik.
        </p>

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold hover:bg-gray-50">
            Batal
          </button>
          <button
            onClick={() => onConfirm(originalFile)}
            disabled={tooLong || duration === 0}
            className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-[var(--gold)] px-4 py-3 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" />
            {tooLong ? 'Video Terlalu Panjang' : 'Upload Video Ini'}
          </button>
        </div>
      </div>
    </div>
  );
}
