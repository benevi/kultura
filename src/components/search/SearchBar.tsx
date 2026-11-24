"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/index";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { IconSearch } from "@/components/icons";
import { PosterFrame } from "@/components/media/PosterFrame";
import { GOOGLE_BOOKS_LOGO, googleBooksVolumeId } from "@/lib/media/google-books";
import { useSearchSuggestions } from "./useSearchSuggestions";

export interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /**
   * E-DISCOVER-SEARCH-MERGE: qué hace el submit (Enter o clic en una sugerencia).
   *  - `"navigate"` (default): navega a `/search?q=…` — comportamiento histórico,
   *    que hoy usa `/discover` como destino vía el redirect de `/search`.
   *  - `"inline"`: NO navega; delega en `onSubmit` para que el consumidor
   *    actualice sus propios query params. Es el modo que usa Descubrir, donde
   *    buscar debe quedarse en la misma pantalla (mismo grid, misma paginación).
   */
  mode?: "navigate" | "inline";
  /** Requerido en `mode="inline"`. Recibe la query ya trimeada. */
  onSubmit?: (query: string) => void;
  /** Se llama al vaciar el input en `mode="inline"` (volver al catálogo). */
  onClear?: () => void;
  /**
   * F-13 (DAT-8): familia activa en Descubrir (`movie`, `manga`…). Con ella
   * las sugerencias salen de ESA familia; sin ella (o con `all`), de cine y
   * series.
   */
  type?: string;
}

export function SearchBar({
  defaultValue = "",
  placeholder,
  className,
  mode = "navigate",
  onSubmit,
  onClear,
  type,
}: SearchBarProps) {
  const t = useTranslations("search");
  const tMedia = useTranslations("media");
  const {
    inputValue,
    suggestions,
    loading,
    expanded,
    activeIndex,
    setActiveIndex,
    listboxId,
    optionId,
    containerRef,
    handleKeyDown,
    handleSelectSuggestion,
    handleChange,
  } = useSearchSuggestions({ defaultValue, mode, onSubmit, onClear, type });

  const resolvedPlaceholder = placeholder ?? t("placeholder");

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="relative">
        <IconSearch
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
          aria-hidden="true"
        />
        {/* ACC-14: patrón ARIA combobox con lista de sugerencias. */}
        <input
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          aria-label={resolvedPlaceholder}
          enterKeyHint="search"
          autoComplete="off"
          className="w-full bg-surface-elevated border border-field-border rounded-pill pl-11 pr-11 py-3 text-base md:text-sm font-body text-text-primary placeholder:text-text-tertiary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring transition-colors"
        />
        {loading && (
          <Spinner
            size="sm"
            className="absolute right-4 top-1/2 -translate-y-1/2"
          />
        )}
      </div>

      {/* Recuento anunciado al aparecer las sugerencias (región que existe
          siempre: un lector no anuncia la que nace ya con texto). */}
      <p role="status" aria-live="polite" className="sr-only">
        {expanded ? t("suggestionsCount", { count: suggestions.length }) : ""}
      </p>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={t("suggestionsLabel")}
        hidden={!expanded}
        className="absolute top-full mt-2 w-full bg-surface-elevated border border-border rounded-2xl shadow-soft z-50 overflow-hidden py-1"
      >
          {expanded && suggestions.map((item, index) => (
            <li
              key={item.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              // El foco se queda en el campo: el ratón no debe robárselo.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectSuggestion(item)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 min-h-11 w-full text-left cursor-pointer transition-colors",
                // Opción activa (WCAG 2.4.7): `surface2` era el mismo fondo del
                // listbox y no se veía. Fondo más oscuro + contorno del anillo
                // de foco del sistema (pink, ≥ 5:1 contra la lista).
                index === activeIndex
                  ? "bg-surface-default [outline-style:solid] outline-2 -outline-offset-2 outline-focus-ring"
                  : "hover:bg-surface-default"
              )}
            >
                {/* Miniatura de 36×48 (C14): `PosterFrame`, que pide la
                    portada al CDN al tamaño justo con `posterLoader`
                    (E-PORTADAS-RAPIDAS) y deja el gradiente detrás por si no
                    hay portada o no carga. Medidas fijas: manda el 3:4 de
                    `w-9 h-12`, no el 2:3 del marco. */}
                <PosterFrame
                  as="span"
                  aria-hidden="true"
                  seed={item.id}
                  title={item.title}
                  poster={item.poster}
                  sizes="36px"
                  radius="sm"
                  initials={false}
                  zoom={false}
                  elevated={false}
                  className="w-9 h-12 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-text-primary truncate">{item.title}</p>
                  {item.year ? (
                    <p className="text-xs text-text-tertiary">{item.year}</p>
                  ) : null}
                </div>
                {/* Sugerencia que viene de Google Books (respaldo de libros y
                    cómic): su logo va junto al resultado (normas de marca). */}
                {googleBooksVolumeId(item) && (
                  <span className="inline-flex shrink-0 items-center rounded-lg bg-white px-1 py-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- PNG estático de 3 KB */}
                    <img
                      src={GOOGLE_BOOKS_LOGO.src}
                      alt={GOOGLE_BOOKS_LOGO.alt}
                      width={GOOGLE_BOOKS_LOGO.width}
                      height={GOOGLE_BOOKS_LOGO.height}
                      className="h-5 w-auto"
                      loading="lazy"
                    />
                  </span>
                )}
                <Badge variant="default">{tMedia(item.type)}</Badge>
            </li>
          ))}
      </ul>
    </div>
  );
}
