"use client";

// ============================================================
// KULTURA — Buscador con sugerencias: el comportamiento, sin el marcado.
// Lo comparten `SearchBar` (Descubrir de hoy) y `SalaDiscoverSearch`
// (Descubrir en «Sala», fase 8.5 D1). Patrón ARIA combobox (ACC-14): el foco
// se queda en el campo y las flechas recorren la lista.
// ============================================================

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { MediaItem } from "@/types/media";
import { ApiError, apiFetch } from "@/lib/api/client";

export interface SearchSuggestionsOptions {
  defaultValue?: string;
  /** `"navigate"`: va a `/search?q=…`. `"inline"`: llama a `onSubmit` (Descubrir). */
  mode?: "navigate" | "inline";
  onSubmit?: (query: string) => void;
  /** Se llama al vaciar el campo en `inline` (volver al catálogo). */
  onClear?: () => void;
  /** Familia activa de Descubrir: las sugerencias salen de ella (F-13). */
  type?: string;
}

export function useSearchSuggestions({ defaultValue = "", mode = "navigate", onSubmit, onClear, type }: SearchSuggestionsOptions) {
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
        const data = await apiFetch<MediaItem[]>(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSuggestions(data);
        setActiveIndex(-1);
        setOpen(data.length > 0);
      } catch (err) {
        if (controller.signal.aborted) return;
        // Una respuesta de error (p. ej. 429) deja las sugerencias que había;
        // solo un fallo de red las vacía.
        if (err instanceof ApiError && err.status > 0) return;
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
    router.push(`/search?q=${encodeURIComponent(trimmed)}&type=${type ?? "all"}`);
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

  return {
    inputValue,
    /** Para seguir a la URL sin volver a montar el campo (Descubrir en «Sala»). */
    setInputValue,
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
  };
}
