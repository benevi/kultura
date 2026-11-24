"use client";

// ============================================================
// KULTURA — SalaDiscoverSearch (fase 8.5 D1, bandera SALA_DESCUBRIR)
// El buscador de Descubrir en «Sala»: `SalaInput` de tipo búsqueda con su
// etiqueta a la vista y las sugerencias del buscador de hoy
// (`useSearchSuggestions`, patrón combobox de ACC-14).
//
// - **Una sola ×.** El aspa propia del navegador está quitada (`SalaInput`) y
//   ya no hay chip con otra: borrar es un `SalaButton` de solo icono dentro
//   del campo, que solo sale con texto y devuelve el foco al campo.
// - **No se vuelve a montar al buscar** (el de hoy lleva `key={query}`): el
//   foco se queda en el campo. El texto se sincroniza con la URL.
// - Las miniaturas de las sugerencias son `SalaPoster`: si la portada no
//   llega o falla, el campo de color, nunca la imagen rota.
// - `role="search"`: un punto de referencia para llegar desde el lector.
// ============================================================

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/index";
import { SalaInput } from "@/components/sala/SalaInput";
import { SalaButton } from "@/components/sala/SalaButton";
import { SalaPoster } from "@/components/sala/SalaPoster";
import { SalaCloseIcon } from "@/components/sala/SalaStatusIcon";
import { useSearchSuggestions } from "@/components/search/useSearchSuggestions";
import { GOOGLE_BOOKS_LOGO, googleBooksVolumeId } from "@/lib/media/google-books";

export interface SalaDiscoverSearchProps {
  /** La búsqueda de la URL (`q`). */
  query: string;
  /** Familia activa: las sugerencias salen de ella. */
  type: string;
  onSearch: (query: string) => void;
  /** Vaciar el campo vuelve al catálogo. */
  onClear: () => void;
  className?: string;
}

/** Lupa de trazo recto, de adorno. */
function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M8.5 3.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12.5 12.5 17 17" />
    </svg>
  );
}

export function SalaDiscoverSearch({ query, type, onSearch, onClear, className }: SalaDiscoverSearchProps) {
  const t = useTranslations("search");
  const tS = useTranslations("discover.sala");
  const tType = useTranslations("discoverFilters.typeBadge");
  const input = useRef<HTMLInputElement>(null);
  const {
    inputValue,
    setInputValue,
    suggestions,
    expanded,
    activeIndex,
    setActiveIndex,
    listboxId,
    optionId,
    containerRef,
    handleKeyDown,
    handleSelectSuggestion,
    handleChange,
  } = useSearchSuggestions({ defaultValue: query, mode: "inline", onSubmit: onSearch, onClear, type });

  // La URL manda: al volver al catálogo (o atrás en el historial) el campo la sigue.
  useEffect(() => {
    setInputValue(query);
  }, [query, setInputValue]);

  function clear() {
    handleChange("");
    input.current?.focus();
  }

  return (
    <div role="search" ref={containerRef} className={cn("relative min-w-0", className)}>
      <SalaInput
        ref={input}
        type="search"
        label={tS("searchLabel")}
        placeholder={t("placeholder")}
        leading={<SearchIcon />}
        trailing={
          inputValue.length > 0 ? (
            <SalaButton variant="quiet" icon={<SalaCloseIcon />} label={tS("clearSearch")} onClick={clear} />
          ) : null
        }
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        enterKeyHint="search"
        autoComplete="off"
      />

      {/* Recuento de sugerencias: región que existe siempre (un lector no anuncia la que nace con texto). */}
      <p role="status" className="sr-only">
        {expanded ? t("suggestionsCount", { count: suggestions.length }) : ""}
      </p>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={t("suggestionsLabel")}
        hidden={!expanded}
        className={cn("absolute left-0 right-0 top-full z-50 mt-1 border-2 border-sala-ink bg-sala-background", !expanded && "hidden")}
      >
        {expanded &&
          suggestions.map((item, index) => (
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
                "flex min-h-sala-target cursor-pointer items-center gap-3 px-3 py-2",
                index === activeIndex ? "bg-sala-ink text-sala-background" : "text-sala-ink"
              )}
            >
              <span className="w-8 shrink-0" aria-hidden="true">
                <SalaPoster src={item.poster ?? null} alt="" title={item.title} format={item.type} ratio="2/3" sizes="2rem" fallback="plain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate sala-type-label">{item.title}</span>
                <span className="block sala-type-small">
                  {tType(item.type)}
                  {item.year ? ` · ${item.year}` : ""}
                </span>
              </span>
              {/* Sugerencia de Google Books (respaldo de libros y cómic): su logo junto al resultado (normas de marca). */}
              {googleBooksVolumeId(item) ? (
                <span className="inline-flex shrink-0 items-center bg-white px-1 py-0.5">
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
              ) : null}
            </li>
          ))}
      </ul>
    </div>
  );
}
