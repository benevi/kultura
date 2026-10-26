// KULTURA — Grupos de la barra de filtros de Descubrir para un tipo (R3, R6).
//
// Un grupo por trigger visible de TYPE_FILTERS[type], con icono y variante
// 'sort' para el pill "Ordenar: <valor>". Las etiquetas salen del namespace
// `discoverFilters`; el valor (slug canónico) NUNCA se toca. Lo que no tiene
// traducción (plataformas, editoriales, géneros no listados) cae a
// `humanizeSlug`: la clave i18n actúa de override.

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { FilterGroup } from "@/components/ui/FilterBar";
import { TYPE_FILTERS, type DiscoverType } from "@/lib/discover/type-filters";
import { getFilterOptions, humanizeSlug } from "@/lib/discover/filter-options";
import { FILTER_ICONS, buildYearBuckets } from "./discover-config";

export function useFilterGroups(type: DiscoverType): FilterGroup[] {
  const tF = useTranslations("filters");
  const tDF = useTranslations("discoverFilters");

  return useMemo(() => {
    const triggerLabel = (key: string) =>
      tDF.has(`trigger.${key}`) ? tDF(`trigger.${key}`) : humanizeSlug(key);
    const optionLabel = (key: string, value: string) =>
      tDF.has(`options.${key}.${value}`) ? tDF(`options.${key}.${value}`) : humanizeSlug(value);

    return TYPE_FILTERS[type].map((trigger) => {
      const isSort = trigger.key === "sort";
      // Año: buckets propios. Solo "classic" se traduce; el resto son números.
      const options =
        trigger.key === "year"
          ? buildYearBuckets().map((o) => (o.value === "classic" ? { value: o.value, label: tF("classic") } : o))
          : getFilterOptions(type, trigger.key).map((o) => ({
              value: o.value,
              label: optionLabel(trigger.key, o.value),
            }));
      return {
        key: trigger.key,
        kind: trigger.kind,
        align: trigger.align,
        icon: FILTER_ICONS[trigger.key],
        label: triggerLabel(trigger.key),
        ...(isSort ? { variant: "sort" as const, sortLabel: tF("sort") } : {}),
        options,
      };
    });
  }, [type, tF, tDF]);
}
