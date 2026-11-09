"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { IconChevronDown } from "@/components/icons";
import type { FilterGroup } from "@/components/ui/FilterBar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { useRadioGroupKeys } from "@/components/ui/useRadioGroupKeys";

type Change = (key: string, value: string | string[]) => void;

// Los mismos filtros que la barra vieja y con los mismos `data-testid`, para las
// pruebas. Es otro componente porque las listas se pintan en un portal, fuera de
// la pantalla, y tienen que llevarse el color del formato.

function Trigger({
  group,
  open,
  active,
  count,
  children,
}: {
  group: FilterGroup;
  open: boolean;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className="k2d-filter"
        data-active={active || undefined}
        data-end={group.align === "end" || undefined}
        aria-expanded={open}
        data-testid={`filter-trigger-${group.key}`}
      >
        {children}
        {count ? (
          <b data-testid={`badge-${group.key}`}>
            {count}
          </b>
        ) : null}
        <IconChevronDown className="k2d-filter__caret" aria-hidden="true" />
      </button>
    </PopoverTrigger>
  );
}

function Single({
  group,
  value,
  accent,
  onChange,
}: {
  group: FilterGroup;
  value: string;
  accent: string;
  onChange: Change;
}) {
  const [open, setOpen] = useState(false);
  const sort = group.variant === "sort";
  const current = group.options.find((o) => o.value === value);
  // Un orden siempre hay: sin elegir, el primero. Un filtro sí se puede quitar.
  const shown = current ?? (sort ? group.options[0] : undefined);
  const active = value !== "" && value !== "all";
  const { getItemProps } = useRadioGroupKeys(
    group.options.map((o) => o.value),
    shown?.value,
    (v) => onChange(group.key, v)
  );

  function select(next: string) {
    onChange(group.key, !sort && next === value ? "all" : next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Trigger group={group} open={open} active={active}>
        {sort ? (
          <>
            <span className="k2d-filter__prefix">{group.sortLabel ?? group.label}:</span> {shown?.label}
          </>
        ) : (
          (current?.label ?? group.label)
        )}
      </Trigger>
      <PopoverContent className="k2 k2d-pop" style={{ "--k-accent": accent } as React.CSSProperties}>
        <div role="radiogroup" aria-label={group.sortLabel ?? group.label}>
          {group.options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              className="k2d-opt"
              {...getItemProps(option.value, index)}
              data-testid={`filter-opt-${group.key}-${option.value}`}
              onClick={() => select(option.value)}
            >
              <i aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Multi({
  group,
  searchable,
  value,
  accent,
  onChange,
}: {
  group: FilterGroup;
  searchable: boolean;
  value: string[];
  accent: string;
  onChange: Change;
}) {
  const tV = useTranslations("discover.v2");
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const options = searchable
    ? group.options.filter((o) => o.label.toLowerCase().includes(needle.trim().toLowerCase()))
    : group.options;

  function toggle(option: string) {
    onChange(group.key, value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Trigger group={group} open={open} active={value.length > 0} count={value.length}>
        {group.label}
      </Trigger>
      <PopoverContent className="k2 k2d-pop" style={{ "--k-accent": accent } as React.CSSProperties}>
        {searchable ? (
          <input
            type="search"
            className="k2d-pop__search"
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder={group.label}
            aria-label={group.label}
          />
        ) : null}
        <div role="group" aria-label={group.label}>
          {options.map((option) => (
            <label key={option.value} className="k2d-opt k2d-opt--check" data-testid={`filter-opt-${group.key}-${option.value}`}>
              <input type="checkbox" checked={value.includes(option.value)} onChange={() => toggle(option.value)} />
              {option.label}
            </label>
          ))}
          {options.length === 0 ? <p className="k2d-pop__none">{tV("noOption")}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Filters({
  groups,
  active,
  accent,
  hasActive,
  onChange,
  onReset,
}: {
  groups: FilterGroup[];
  active: Record<string, string | string[]>;
  accent: string;
  hasActive: boolean;
  onChange: Change;
  onReset: () => void;
}) {
  const tF = useTranslations("filters");

  return (
    <div className="k2d-filters" role="group" aria-label={tF("filters")}>
      {groups.map((group) => {
        const raw = active[group.key];
        const kind = group.kind ?? "single";
        if (kind === "single") {
          return (
            <Single
              key={group.key}
              group={group}
              value={Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "")}
              accent={accent}
              onChange={onChange}
            />
          );
        }
        return (
          <Multi
            key={group.key}
            group={group}
            searchable={kind === "searchable"}
            value={Array.isArray(raw) ? raw : raw ? [raw] : []}
            accent={accent}
            onChange={onChange}
          />
        );
      })}
      {hasActive ? (
        <button type="button" className="k2d-reset" onClick={onReset}>
          {tF("reset")}
        </button>
      ) : null}
    </div>
  );
}
