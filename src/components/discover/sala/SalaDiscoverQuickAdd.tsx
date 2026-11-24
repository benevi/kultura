"use client";

// ============================================================
// KULTURA — SalaDiscoverQuickAdd (fase 8.5 D1, banderas SALA_DESCUBRIR y QUICK_ADD)
// El «+» de las tarjetas de Descubrir en «Sala»: un `SalaButton` de solo
// icono, fuera del enlace de la tarjeta. El comportamiento es el de hoy
// (`useQuickAdd`); los avisos van por el `SalaToastProvider` de la vista.
//
// - 48 × 48, discreto sobre la portada como el lápiz de la biblioteca (B1).
// - Guardando, «carga»: no se puede volver a pulsar y se anuncia.
// - Ya en la biblioteca: el dibujo pasa a una marca y el nombre lo dice
//   («Matrix está en tu biblioteca»); la forma, no solo el color.
// ============================================================

import { useTranslations } from "next-intl";
import { SalaButton } from "@/components/sala/SalaButton";
import { useSalaToast } from "@/components/sala/SalaToast";
import { useQuickAdd } from "@/components/media/useQuickAdd";

/** Lo mismo que el lápiz de la biblioteca (#291): fondo al 75 % con desenfoque y tinta encima. */
const DISCRETO = [
  "bg-[color-mix(in_srgb,var(--sala-background)_75%,transparent)] backdrop-blur-sm",
  "sala-focused:border-sala-ink sala-focused:bg-sala-ink sala-focused:text-sala-background",
].join(" ");

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="h-5 w-5">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" className="h-5 w-5">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export function SalaDiscoverQuickAdd({ mediaId, title }: { mediaId: string; title: string }) {
  const tCommon = useTranslations("common");
  const { phase, inLibrary, add, label } = useQuickAdd(mediaId, title, useSalaToast());
  return (
    <SalaButton
      variant="quiet"
      icon={inLibrary ? <CheckIcon /> : <PlusIcon />}
      label={label}
      onClick={add}
      loading={phase === "saving"}
      loadingLabel={tCommon("loading")}
      // Ya está en la biblioteca: pulsarlo no hace nada, y se dice.
      aria-disabled={inLibrary || undefined}
      data-state={phase}
      className={DISCRETO}
    />
  );
}
