// ============================================================
// KULTURA — TrailerEmbed
// Embed de tráiler de YouTube via iframe.
// Server Component (sin "use client").
// ============================================================

interface TrailerEmbedProps {
  youtubeKey: string;
  title: string;
}

export function TrailerEmbed({ youtubeKey, title }: TrailerEmbedProps) {
  return (
    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-surface2">
      <iframe
        src={`https://www.youtube.com/embed/${youtubeKey}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        loading="lazy"
      />
    </div>
  );
}
