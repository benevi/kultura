// ============================================================
// KULTURA — «Así se llena el álbum» (campo amarillo)
//
// El ritual del álbum contado con sus propias piezas, de izquierda a
// derecha: buscar → apuntar en su hueco (pendiente) → pegar al terminar
// (puesto mientras vas, pegado al acabar) → compartir tu página. Cada paso
// es el componente real que verás dentro (`Slot`, `Cromo`, `StatusBand`),
// con portadas reales del catálogo; sin portadas, los mismos huecos.
// ============================================================

import { AlbumPage } from "@/components/album/AlbumPage";
import { Cromo } from "@/components/album/Cromo";
import { Slot } from "@/components/album/Slot";
import { StatusBand } from "@/components/album/StatusBand";
import { LandingCromo } from "@/components/landing/LandingCromo";
import { LandingPosterImage } from "@/components/landing/LandingPosterImage";
import type { AlbumCromo } from "@/lib/landing/album";
import type { MediaType } from "@/types/media";

export const RITUAL_STEPS = ["find", "slot", "paste", "share"] as const;
export type RitualStep = (typeof RITUAL_STEPS)[number];
export const RITUAL_STATUSES = ["pending", "in_progress", "completed"] as const;
export type RitualStatus = (typeof RITUAL_STATUSES)[number];

export interface RitualProps {
  heading: string;
  steps: Record<RitualStep, { title: string; desc: string }>;
  /** Nombre de los tres estados que enseña el ritual (namespace `status`). */
  status: Record<RitualStatus, string>;
  format: Record<MediaType, string>;
  locale: string;
  /** Portadas reales (la muestra del catálogo); vacío = huecos. */
  covers: AlbumCromo[];
}

const SIZES = "96px";

function Mini({ item, seed }: { item?: AlbumCromo; seed: string }) {
  return item ? (
    <LandingCromo title={item.title} seed={item.id} poster={item.poster} sizes={SIZES} still />
  ) : (
    <Slot number={seed} title="" />
  );
}

export function Ritual({ heading, steps, status, format, locale, covers }: RitualProps) {
  const [a, b, c, d, e, f, g] = covers;
  const art: Record<RitualStep, React.ReactNode> = {
    find: (
      <div className="flex w-full max-w-[16rem] items-end gap-2">
        {[a, b, c].map((it, i) => (
          <div key={i} className="min-w-0 flex-1">
            <Mini item={it} seed={String(i + 1)} />
          </div>
        ))}
      </div>
    ),
    slot: (
      <div className="w-24">
        <Slot
          number={12}
          title={d?.title ?? ""}
          format={d?.type}
          formatLabel={d ? format[d.type] : undefined}
          band={<StatusBand status="pending" label={status.pending} locale={locale} />}
        />
      </div>
    ),
    paste: (
      <div className="flex items-end gap-3">
        <div className="w-24">
          {e ? (
            <Cromo title={e.title} seed={e.id} sizes={SIZES} state="placed" format={e.type} progress={0.4} still>
              <LandingPosterImage src={e.poster} sizes={SIZES} className="object-cover" />
              <span className="sr-only">{e.title}</span>
            </Cromo>
          ) : (
            <Slot number={13} title="" />
          )}
          <StatusBand status="in_progress" label={status.in_progress} locale={locale} className="mt-1.5" />
        </div>
        <div className="w-24">
          <Mini item={f} seed="14" />
          <StatusBand status="completed" label={status.completed} locale={locale} className="mt-1.5" />
        </div>
      </div>
    ),
    share: (
      <div className="w-full max-w-[16rem] rounded-2xl border-2 border-album-navy bg-album-white p-3">
        <div className="grid grid-cols-3 gap-2">
          {[g, a, b].map((it, i) => (
            <Mini key={i} item={it} seed={String(i + 1)} />
          ))}
        </div>
      </div>
    ),
  };

  return (
    <AlbumPage tone="yellow" aria-labelledby="ritual-title" className="py-16 md:py-24">
      <h2 id="ritual-title" className="mb-10 text-balance font-display text-3xl text-text-primary md:mb-14 md:text-4xl">
        {heading}
      </h2>
      <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {RITUAL_STEPS.map((key) => (
          <li key={key} className="flex flex-col gap-5">
            <div aria-hidden="true" className="flex min-h-48 items-end">
              {art[key]}
            </div>
            <div>
              <h3 className="font-display text-2xl text-text-primary">{steps[key].title}</h3>
              <p className="mt-2 max-w-[34ch] text-base text-text-primary">{steps[key].desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </AlbumPage>
  );
}
