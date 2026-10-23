// ============================================================
// KULTURA — TrailerEmbed
// Embed de tráiler de YouTube via iframe.
// Server Component (sin "use client").
//
// Dominio `youtube-nocookie.com` (modo de privacidad mejorada): la ficha es
// pública y el reproductor no deja cookies de YouTube hasta que se pulsa
// "play" (ePrivacy, D-12: sin banner). La CSP ya admite este origen.
// ============================================================

interface TrailerEmbedProps {
  youtubeKey: string;
  title: string;
}

export function TrailerEmbed({ youtubeKey, title }: TrailerEmbedProps) {
  return (
    <div className="relative aspect-video w-full rounded-[24px] overflow-hidden bg-surface-elevated">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeKey)}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        loading="lazy"
      />
    </div>
  );
}
