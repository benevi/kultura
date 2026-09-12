"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { IconSearch } from "@/components/icons";
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
      <div className="relative">
        <IconSearch
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          type="search"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          aria-label={resolvedPlaceholder}
          className="w-full bg-surface-elevated border border-transparent rounded-pill pl-11 pr-11 py-3 text-sm font-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-positive transition-colors"
        />
        {loading && (
          <Spinner
            size="sm"
            className="absolute right-4 top-1/2 -translate-y-1/2"
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full mt-2 w-full bg-surface-elevated border border-border rounded-card shadow-xl z-50 overflow-hidden py-1">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 w-full text-left transition-colors"
              >
                {item.poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.poster}
                    alt=""
                    className="w-9 h-12 object-cover rounded-md flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-text-primary truncate">{item.title}</p>
                  {item.year && (
                    <p className="text-xs text-text-tertiary">{item.year}</p>
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
