// Prototipo fase 8.3 — bloques de contenido de la ficha, sin estilo propio.
// Server Components: todo el texto sale en el HTML. Cada dirección decide
// dónde van y cómo se ven (clases `kp-*`); también puede no usarlos y pintar
// `FichaData` a su manera.

import type { ReactNode } from "react";
import type { Fact, FichaData } from "../types";

const GROUPS = ["flatrate", "free", "ads", "rent", "buy"] as const;

const safeHref = (url: string | undefined) => (url && /^https:\/\//.test(url) ? url : undefined);

/** Lista de datos (`dl`). */
export function FactList({ facts, className = "" }: { facts: Fact[]; className?: string }) {
  if (!facts.length) return null;
  return (
    <dl className={`kp-facts ${className}`}>
      {facts.map((f) => (
        <div key={f.key} className="kp-fact" data-fact={f.key}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Synopsis({ data, className = "" }: { data: FichaData; className?: string }) {
  return data.synopsis ? (
    <div className={`kp-synopsis ${className}`} lang={data.synopsisLang}>
      {data.synopsis
        .split(/\n{2,}|\r\n\r\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </div>
  ) : (
    <p className={`kp-synopsis kp-empty ${className}`}>{data.labels.noSynopsis}</p>
  );
}

export function Genres({ data, className = "" }: { data: FichaData; className?: string }) {
  if (!data.genres.length) return null;
  return (
    <ul className={`kp-genres ${className}`} aria-label={data.labels.genres}>
      {data.genres.map((g) => (
        <li key={g}>{g}</li>
      ))}
    </ul>
  );
}

export function Ratings({ data, className = "" }: { data: FichaData; className?: string }) {
  if (!data.ratings.length) return null;
  return (
    <dl className={`kp-ratings ${className}`} aria-label={data.labels.ratings}>
      {data.ratings.map((r) => (
        <div key={r.key} className="kp-rating">
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** «Dónde ver»: logos de TMDB agrupados por tipo de acceso. `null` si no hay. */
export function WhereToWatch({ data, heading }: { data: FichaData; heading: ReactNode }) {
  const groups = GROUPS.map((type) => ({
    type,
    items: data.providers.filter((p) => p.type === type).filter((p, i, arr) => arr.findIndex((x) => x.name === p.name) === i),
  })).filter((g) => g.items.length);
  if (!groups.length) return null;
  const link = safeHref(data.watchLink);
  return (
    <section className="kp-watch">
      {heading}
      <div className="kp-watch-groups">
        {groups.map((g) => (
          <div key={g.type} className="kp-watch-group">
            <h3>{data.labels.streamTypes[g.type]}</h3>
            <ul>
              {g.items.map((p) => (
                <li key={p.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.logoPath} alt="" width={40} height={40} loading="lazy" />
                  <span>{p.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {link && (
        <a className="kp-link" href={link} target="_blank" rel="noopener noreferrer">
          {data.labels.whereToWatchMore}
        </a>
      )}
    </section>
  );
}

/** Steam: precio, idiomas, enlace y capturas (por el optimizador, como en la app). */
export function SteamBlock({ data, heading }: { data: FichaData; heading: ReactNode }) {
  const s = data.steam;
  if (!s) return null;
  const l = data.labels;
  const shots = (s.screenshots ?? []).slice(0, 4);
  return (
    <section className="kp-steam">
      {heading}
      <p className="kp-steam-line">
        <span className="kp-steam-price">{s.isFree ? l.steamFree : s.price ?? ""}</span>
        {s.priceOriginal && s.discountPercent ? <s>{s.priceOriginal}</s> : null}
        <a className="kp-link" href={s.storeUrl} target="_blank" rel="noopener noreferrer">
          {l.steamOpen}
        </a>
      </p>
      {s.supportedLanguages?.length ? (
        <p className="kp-steam-langs">
          {l.steamLanguages}: {s.supportedLanguages.slice(0, 8).join(", ")}
        </p>
      ) : null}
      {shots.length > 0 && (
        <ul className="kp-shots" aria-label={l.screenshots}>
          {shots.map((shot, i) => (
            <li key={shot.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/_next/image?url=${encodeURIComponent(shot.thumb)}&w=640&q=70`}
                alt={`${l.screenshots} ${i + 1}`}
                loading="lazy"
                width={600}
                height={338}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Hueco del tráiler. NO se construye todavía (uso nuevo de datos de
 * proveedores, pendiente de legal: plan §7.1 punto 3). Solo marca el sitio.
 */
export function TrailerSlot({ data, heading }: { data: FichaData; heading: ReactNode }) {
  if (!data.trailerKey) return null;
  return (
    <section className="kp-trailer">
      {heading}
      <div className="kp-trailer-slot" data-kp-slot="trailer">
        <p>{data.labels.trailerSlot}</p>
      </div>
    </section>
  );
}

/** Cita de la fuente (los proveedores la exigen). */
export function SourceLine({ data, className = "" }: { data: FichaData; className?: string }) {
  if (!data.source) return null;
  return (
    <p className={`kp-source ${className}`}>
      {data.labels.source}{" "}
      <a className="kp-link" href={data.source.url} target="_blank" rel="noopener noreferrer">
        {data.source.name}
      </a>
      {data.steam ? (
        <>
          {" "}
          ·{" "}
          <a className="kp-link" href={data.steam.storeUrl} target="_blank" rel="noopener noreferrer">
            Steam
          </a>
        </>
      ) : null}
    </p>
  );
}
