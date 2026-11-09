"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { posterLoader } from "@/lib/images/poster-url";
import type { MediaItem } from "@/types/media";
import { formatVar } from "../Blocks";

/** Tamaños que acepta el optimizador (`imageSizes` y `deviceSizes` de Next). */
const WIDTHS = [256, 384, 640];

/** Lo que se ve sin hacer scroll: el resto carga al acercarse. */
const EAGER = 5;

const SKELETON = 20;

export function Poster({
  item,
  sizes,
  eager = false,
  onFail,
}: {
  item: MediaItem;
  sizes: string;
  eager?: boolean;
  onFail?: (id: string) => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const src = item.poster as string;

  // Una portada puede fallar antes de hidratar, y entonces `onError` ya no llega.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) onFail?.(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      className="k2d-poster"
      src={posterLoader({ src, width: WIDTHS[WIDTHS.length - 1] })}
      srcSet={WIDTHS.map((width) => `${posterLoader({ src, width })} ${width}w`).join(", ")}
      sizes={sizes}
      onError={() => onFail?.(item.id)}
      alt=""
      width={500}
      height={750}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
    />
  );
}

/** Formato (si se mezclan), año y nota: lo mínimo para decidir si abrirla. */
export function Meta({ item, showType }: { item: MediaItem; showType: boolean }) {
  const tBadge = useTranslations("discoverFilters.typeBadge");
  const locale = useLocale();
  const rating =
    item.rating !== undefined
      ? new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(item.rating)
      : null;

  return (
    <span className="k2d-meta">
      {showType ? (
        <span className="k2d-meta__type">
          <i aria-hidden="true" />
          {tBadge(item.type)}
        </span>
      ) : null}
      {item.year ? <span>{item.year}</span> : null}
      {rating ? <span>★ {rating}</span> : null}
    </span>
  );
}

export function Wall({
  items,
  showType,
  onFail,
  dim,
}: {
  items: MediaItem[];
  showType: boolean;
  onFail: (id: string) => void;
  dim: boolean;
}) {
  return (
    <ul className="k2d-wall" data-dim={dim || undefined} data-mixed={showType || undefined}>
      {items.map((item, index) => (
        <li key={item.id} className="k2d-work" style={{ "--c": formatVar(item.type) } as React.CSSProperties}>
          {/* Sin prefetch: una página son veinte fichas que nadie ha pedido aún. */}
          <Link href={`/media/${item.type}/${item.externalId}`} className="k2d-work__link" prefetch={false}>
            <span className="k2d-work__frame">
              <Poster
                item={item}
                sizes="(max-width: 499px) 50vw, (max-width: 767px) 33vw, (max-width: 1099px) 25vw, 204px"
                eager={index < EAGER}
                onFail={onFail}
              />
            </span>
            <h2 className="k2d-work__title">{item.title}</h2>
            <Meta item={item} showType={showType} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function WallSkeleton() {
  return (
    <div className="k2d-wall" aria-hidden="true">
      {Array.from({ length: SKELETON }, (_, i) => (
        <div key={i} className="k2d-work">
          <div className="k2d-skel k2d-skel--poster motion-safe:animate-pulse" />
          <div className="k2d-skel k2d-skel--line motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function Message({
  title,
  lead,
  hint,
  action,
  alert = false,
  testId,
}: {
  title?: string;
  lead?: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
  alert?: boolean;
  testId?: string;
}) {
  return (
    <section className="k2d-message" data-testid={testId}>
      {title ? <h2>{title}</h2> : null}
      {lead ? (
        <p className="k2d-message__lead" role={alert ? "alert" : undefined}>
          {lead}
        </p>
      ) : null}
      {hint ? <p>{hint}</p> : null}
      {action ? (
        <button type="button" className="k2-btn k2d-message__action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </section>
  );
}
