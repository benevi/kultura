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
}

export function SearchBar({
  defaultValue = "",
  placeholder,
  className,
}: SearchBarProps) {
  const t = useTranslations("search");
  const router = useRouter();

  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce: fetch suggestions 400ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && inputValue.trim().length > 0) {
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(inputValue.trim())}&type=all`);
    }
  }

  function handleSelectSuggestion(item: MediaItem) {
    setOpen(false);
    router.push(
      `/search?q=${encodeURIComponent(item.title)}&type=${item.type}`
    );
  }

  const resolvedPlaceholder = placeholder ?? t("placeholder");

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <input
        type="search"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
        className="bg-surface border border-border rounded-lg px-4 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-accent pr-10"
      />
      {loading && (
        <Spinner
          size="sm"
          className="absolute right-3 top-1/2 -translate-y-1/2"
        />
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full mt-1 w-full bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="flex items-center gap-3 px-4 py-2 hover:bg-surface2 w-full text-left"
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
