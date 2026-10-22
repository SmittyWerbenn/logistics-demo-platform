import { X, ZoomIn } from "lucide-react";
import { useEffect } from "react";

interface ImageLightboxProps {
  src: string | null;
  caption?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, caption, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Tutup"
      >
        <X size={22} />
      </button>
      <figure
        className="flex max-h-full max-w-4xl flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={caption ?? "Foto dokumentasi"}
          className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl"
        />
        {caption && (
          <figcaption className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-white">
            {caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

interface PhotoThumbProps {
  src: string;
  alt: string;
  onClick: () => void;
  className?: string;
}

export function PhotoThumb({ src, alt, onClick, className = "" }: PhotoThumbProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-lg border border-slate-200 ${className}`}
      type="button"
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/30 group-hover:opacity-100">
        <ZoomIn size={20} className="text-white drop-shadow" />
      </span>
    </button>
  );
}
