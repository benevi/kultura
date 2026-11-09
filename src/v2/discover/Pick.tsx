"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { MediaItem } from "@/types/media";
import { formatVar } from "../Blocks";
import { Meta, Poster } from "./Results";

/** Margen para la barra de navegación inferior del móvil. */
const BOTTOM_NAV = 80;

// «Sorpréndeme»: una sola obra, en grande, en el sitio de la pared. Es el único
// momento con entrada propia de la pantalla: pasa pocas veces y es lo que se pidió.
export function Pick({
  item,
  onAgain,
  onClose,
  onFail,
}: {
  item: MediaItem;
  onAgain: () => void;
  onClose: () => void;
  onFail: (id: string) => void;
}) {
  const tS = useTranslations("search");
  const tV = useTranslations("discover.v2");
  const link = useRef<HTMLAnchorElement>(null);
  const titleId = useId();

  // Solo al abrir: con «Otra vez» el foco se queda ahí, para repetir sin moverse.
  // Quien la ha pedido con el teclado sigue desde la obra, no desde el botón. En
  // el móvil, «Ver ficha» caería bajo la barra inferior: se sube hasta verlo.
  useEffect(() => {
    const el = link.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (el.getBoundingClientRect().bottom > window.innerHeight - BOTTOM_NAV) {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, []);

  return (
    <section className="k2d-pick" style={{ "--c": formatVar(item.type) } as React.CSSProperties}>
      <Link href={`/media/${item.type}/${item.externalId}`} className="k2d-pick__cover" prefetch={false} aria-hidden="true" tabIndex={-1}>
        <Poster item={item} sizes="(max-width: 767px) 50vw, 320px" eager onFail={onFail} />
      </Link>
      <div>
        <h2 id={titleId} className="k2d-pick__title">{item.title}</h2>
        <Meta item={item} showType />
        <div className="k2d-pick__actions">
          <Link ref={link} href={`/media/${item.type}/${item.externalId}`} className="k2-btn" prefetch={false} aria-describedby={titleId}>
            {tV("open")}
          </Link>
          <button type="button" className="k2d-pick__again" onClick={onAgain}>
            {tS("randomizeAgain")}
          </button>
          <button type="button" className="k2d-reset" onClick={onClose}>
            {tV("backToList")}
          </button>
        </div>
      </div>
    </section>
  );
}
