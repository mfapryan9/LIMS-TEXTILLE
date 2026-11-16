"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, ImageIcon, Loader2, RotateCcw, RotateCw, X } from "lucide-react";

/** Tombol "Lihat foto hasil uji" → penampil foto dengan pilihan putar kiri / kanan (hanya tampilan, foto asli tidak diubah). */
export function PhotoLink({ id, label }: { id: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
        <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Lihat foto hasil uji
      </button>
      {open && <PhotoViewer id={id} label={label} onClose={() => setOpen(false)} />}
    </>
  );
}

function PhotoViewer({ id, label, onClose }: { id: string; label?: string; onClose: () => void }) {
  const [deg, setDeg] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const sideways = deg % 180 !== 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setDeg((d) => (d + 90) % 360);
      if (e.key === "ArrowLeft") setDeg((d) => (d + 270) % 360);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tool = "inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20";
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Foto hasil uji" className="fixed inset-0 z-50 flex flex-col bg-ink/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-white">Foto hasil uji{label ? ` · ${label}` : ""}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={tool} onClick={() => setDeg((d) => (d + 270) % 360)} title="Putar ke kiri (←)"><RotateCcw className="h-4 w-4" aria-hidden />Putar kiri</button>
          <button type="button" className={tool} onClick={() => setDeg((d) => (d + 90) % 360)} title="Putar ke kanan (→)"><RotateCw className="h-4 w-4" aria-hidden />Putar kanan</button>
          <a className={tool} href={`/hasil/${id}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden />Buka asli</a>
          <button type="button" className={tool} onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" aria-hidden /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        {!loaded && <Loader2 className="absolute h-8 w-8 animate-spin text-white" aria-hidden />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/hasil/${id}`}
          alt="Foto hasil uji"
          onLoad={() => setLoaded(true)}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `rotate(${deg}deg)`,
            // Saat diputar 90°/270°, batas lebar & tinggi ditukar agar foto tetap muat di layar
            maxWidth: sideways ? "calc(100dvh - 7rem)" : "100%",
            maxHeight: sideways ? "calc(100vw - 2rem)" : "100%",
          }}
          className="rounded-lg object-contain shadow-2xl transition-transform duration-200"
        />
      </div>
    </div>,
    document.body,
  );
}
