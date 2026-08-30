'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Play, Pause, X } from 'lucide-react';

interface VideoTrimmerProps {
  videoSrc: string;       // blob URL of the original footage
  fileName: string;
  clipDuration?: number;  // how many seconds to clip (default 10)
  onConfirm: (clippedFile: File) => void;
  onCancel: () => void;
}

export function VideoTrimmer({ videoSrc, fileName, clipDuration = 10, onConfirm, onCancel }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxStart = Math.max(0, duration - clipDuration);

  // When metadata loads, set duration
  const handleLoaded = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    videoRef.current.currentTime = 0;
  };

  // Keep currentTime in sync
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const ct = videoRef.current.currentTime;
    setCurrentTime(ct);
    // Auto-stop at end of clip window
    if (ct >= startTime + clipDuration) {
      videoRef.current.pause();
      videoRef.current.currentTime = startTime;
      setIsPlaying(false);
    }
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      v.currentTime = startTime;
      v.play();
      setIsPlaying(true);
    }
  }, [isPlaying, startTime]);

  // When startTime changes, seek to it
  useEffect(() => {
    const v = videoRef.current;
    if (!v || isPlaying) return;
    v.currentTime = startTime;
    setCurrentTime(startTime);
  }, [startTime, isPlaying]);

  // Progress bar: percentage within the selected clip
  const clipProgress = duration > 0
    ? Math.min(100, Math.max(0, ((currentTime - startTime) / clipDuration) * 100))
    : 0;

  const handleConfirm = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;

    // Pause and seek to start
    v.pause();
    v.currentTime = startTime;
    setIsPlaying(false);
    setRecording(true);
    setProgress(0);

    // We'll capture using MediaRecorder on the video stream
    let stream: MediaStream;
    try {
      // @ts-ignore – captureStream is supported in all modern browsers
      stream = v.captureStream();
    } catch {
      alert('Browser Anda tidak mendukung fitur perekaman video. Coba gunakan Chrome atau Edge terbaru.');
      setRecording(false);
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const blob = new Blob(chunks, { type: mimeType });
      const ext = mimeType.includes('mp4') ? '.mp4' : '.webm';
      const baseName = fileName.replace(/\.[^.]+$/, '');
      const file = new File([blob], `${baseName}_clip${ext}`, { type: mimeType });
      setRecording(false);
      onConfirm(file);
    };

    recorder.start();
    v.play();

    // Track progress
    const startTs = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTs) / 1000;
      setProgress(Math.min(100, (elapsed / clipDuration) * 100));
    }, 100);

    // Stop after clipDuration
    setTimeout(() => {
      recorder.stop();
      v.pause();
    }, clipDuration * 1000 + 200); // small buffer

  }, [startTime, clipDuration, fileName, onConfirm]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-xl rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--gold-dark)]">Editor Klip Video</p>
            <h2 className="mt-1 font-serif text-2xl">Pilih Bagian Video</h2>
            <p className="mt-1 text-xs text-gray-500">Geser slider untuk memilih {clipDuration} detik yang ingin ditampilkan kepada klien.</p>
          </div>
          <button onClick={onCancel} disabled={recording} className="rounded-full border border-gray-200 p-2 hover:bg-gray-50">
            <X className="h-4 w-4" />
          </button>
        </div>

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
          {/* Clip progress bar overlay */}
          {isPlaying && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${clipProgress}%` }} />
            </div>
          )}
        </div>

        {/* Play button and time info */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={recording || duration === 0}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-white shadow transition hover:opacity-90 disabled:opacity-50"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Mulai: <strong>{startTime.toFixed(1)}s</strong></span>
              <span>Akhir: <strong>{Math.min(duration, startTime + clipDuration).toFixed(1)}s</strong></span>
              <span>Total footage: <strong>{duration.toFixed(1)}s</strong></span>
            </div>
            {/* Timeline range slider */}
            <input
              type="range"
              min={0}
              max={maxStart}
              step={0.1}
              value={startTime}
              onChange={(e) => { setStartTime(Number(e.target.value)); setIsPlaying(false); }}
              disabled={recording || duration === 0}
              className="w-full accent-[var(--gold)]"
            />
          </div>
        </div>

        {/* Clip selection visual indicator */}
        {duration > 0 && (
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[var(--gold)]/30 border-2 border-[var(--gold)] transition-all"
              style={{
                marginLeft: `${(startTime / duration) * 100}%`,
                width: `${(Math.min(clipDuration, duration - startTime) / duration) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Recording progress */}
        {recording && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--gold-dark)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Merekam klip... {Math.round(progress)}%
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[var(--gold)] transition-all duration-100" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} disabled={recording} className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold hover:bg-gray-50 disabled:opacity-50">
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={recording || duration === 0}
            className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-[var(--gold)] px-4 py-3 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-50"
          >
            {recording ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Merekam...</>
            ) : (
              <><Check className="h-4 w-4" /> Gunakan Klip {clipDuration}s Ini</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
