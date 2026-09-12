"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import type { MediaItem } from "@/types/media";

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
}

export function SearchBar({
  defaultValue = "",
  placeholder,
  className,
  mode = "navigate",
  onSubmit,
  onClear,
}: SearchBarProps) {
  const t = useTranslations("search");
  const router = useRouter();

  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(inputValue)}`
        );
        if (res.ok) {
          const data: MediaItem[] = await res.json();
          setSuggestions(data);
          setOpen(data.length > 0);
        }
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
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
    setInputValue(value);
    // Vaciar el input en inline = volver al catálogo, sin tener que pulsar Enter.
    if (mode === "inline" && value.trim().length === 0) onClear?.();
  }

  const resolvedPlaceholder = placeholder ?? t("placeholder");

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <input
        type="search"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
        // Tokens del DS (antes: `bg-surface`/`border-border`/`ring-accent`
        // legacy, que desentonaban dentro de la barra de Descubrir ya migrada).
        className="w-full rounded-button bg-surface-elevated border border-surface-border px-4 py-2 pr-10 text-sm text-text-primary placeholder:text-text-tertiary transition-colors hover:border-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-positive focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
      />
      {loading && (
        <Spinner
          size="sm"
          className="absolute right-3 top-1/2 -translate-y-1/2"
        />
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full mt-1 w-full bg-surface-default border border-surface-border rounded-card shadow-xl z-50 overflow-hidden">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="flex items-center gap-3 px-4 py-2 hover:bg-surface-elevated w-full text-left transition-colors"
              >
                {item.poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.poster}
                    alt=""
                    className="w-8 h-12 object-cover rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">{item.title}</p>
                  {item.year && (
                    <p className="text-xs text-muted">{item.year}</p>
                  )}
                </div>
                <Badge variant="default">{item.type}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
