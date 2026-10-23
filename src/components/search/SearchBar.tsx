"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { IconSearch } from "@/components/icons";
import type { MediaItem } from "@/types/media";
import { posterLoader } from "@/lib/images/poster-url";
import { posterGradient } from "@/lib/images/poster-gradient";

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
  const locale = useLocale();
  const router = useRouter();

  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  // ACC-14: opción resaltada con las flechas (-1 = ninguna, el foco sigue en
  // el campo y Enter busca lo escrito).
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-opt-${index}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Petición de sugerencias en curso: se cancela al seguir escribiendo, para
  // que una respuesta lenta de "nar" no pise a la de "naruto".
  const abortRef = useRef<AbortController | null>(null);
  // ¿Ha escrito el usuario en ESTA instancia? Con `defaultValue` (Descubrir
  // rellena el input con la query activa de la URL), el efecto de debounce se
  // disparaba al montar y el desplegable de sugerencias aparecía solo, tapando
  // la barra al entrar en /discover?q=…  Solo se piden sugerencias cuando hay
  // escritura real.
  const hasTypedRef = useRef(false);

  // Debounce: fetch suggestions 400ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!hasTypedRef.current) return;

    if (inputValue.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        // F-06 (DAT-1): idioma en la URL (la ruta no puede deducirlo y la
        // caché de borde no debe mezclar idiomas). F-13 (DAT-8): y la familia.
        const params = new URLSearchParams({ q: inputValue, locale });
        if (type && type !== "all") params.set("type", type);
        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data: MediaItem[] = await res.json();
          if (controller.signal.aborted) return;
          setSuggestions(data);
          setActiveIndex(-1);
          setOpen(data.length > 0);
        }
      } catch {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, locale, type]);

  // Al desmontar, ninguna petición queda viva.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Click outside → close dropdown
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  /** Submit unificado: en `inline` delega; en `navigate` sigue empujando ruta. */
  function submit(query: string, type?: MediaItem["type"]) {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    setOpen(false);
    if (mode === "inline") {
      onSubmit?.(trimmed);
      return;
    }
    router.push(
      `/search?q=${encodeURIComponent(trimmed)}&type=${type ?? "all"}`
    );
  }

  const expanded = open && suggestions.length > 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      if (!expanded) {
        setOpen(true);
        setActiveIndex(step === 1 ? 0 : suggestions.length - 1);
        return;
      }
      // Recorrido circular; pasar del último vuelve al campo (-1).
      setActiveIndex((i) => {
        const next = i + step;
        if (next < -1) return suggestions.length - 1;
        if (next >= suggestions.length) return -1;
        return next;
      });
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      if (expanded && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeIndex]);
        return;
      }
      submit(inputValue);
    }
  }

  function handleSelectSuggestion(item: MediaItem) {
    // En inline se busca por el TÍTULO de la sugerencia (el tipo lo gobierna el
    // selector de tipo de Descubrir, que el usuario ya tiene a la vista).
    setInputValue(item.title);
    submit(item.title, item.type);
  }

  function handleChange(value: string) {
    // Escritura real: a partir de aquí sí se piden sugerencias. Sin esta línea
    // el efecto de debounce salía siempre y el autocompletado no llamaba nunca
    // a /api/search.
    hasTypedRef.current = true;
    setInputValue(value);
    setActiveIndex(-1);
    // Vaciar el input en inline = volver al catálogo, sin tener que pulsar Enter.
    if (mode === "inline" && value.trim().length === 0) onClear?.();
  }

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
        className="absolute top-full mt-2 w-full bg-surface-elevated border border-border rounded-card shadow-xl z-50 overflow-hidden py-1"
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
                index === activeIndex ? "bg-surface2" : "hover:bg-surface2"
              )}
            >
                {/* Miniatura de 36×48: se pide al CDN a ese tamaño
                    (E-PORTADAS-RAPIDAS); antes bajaba la portada original —
                    con RAWG, una captura de 1920 px por sugerencia. Gradiente
                    detrás por si no hay portada o no carga. */}
                <span
                  aria-hidden="true"
                  className="relative w-9 h-12 rounded-md overflow-hidden flex-shrink-0"
                  style={{ background: posterGradient(item.id || item.title) }}
                >
                  {item.poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={posterLoader({ src: item.poster, width: 96 })}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-text-primary truncate">{item.title}</p>
                  {item.year ? (
                    <p className="text-xs text-text-tertiary">{item.year}</p>
                  ) : null}
                </div>
                <Badge variant="default">{tMedia(item.type)}</Badge>
            </li>
          ))}
      </ul>
    </div>
  );
}
