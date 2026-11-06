// ============================================================
// KULTURA — UI v2 · /lists (F0: prueba del interruptor `ui_v2`)
//
// Pantalla mínima para comprobar el mecanismo de punta a punta, NO el diseño
// v2 (llega en F2/F3 con brief y rúbrica). Recibe los mismos datos que la
// vieja (`ListsClient`) para que el conmutador de `page.tsx` sea solo un `if`.
// ============================================================

import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { List } from "@/types/list";

export async function ListsScreen({ lists }: { lists: List[] }) {
  const t = await getTranslations("uiV2");
  const locale = await getLocale();
  // Enlace normal (<a>), no del router: es una ruta de API que redirige.
  const exitHref = `/api/ui-v2?v=0&next=${encodeURIComponent(`/${locale}/lists`)}`;

  return (
    // Sin ancho ni márgenes propios: la retícula la pone el armazón (DIS-8).
    <main data-ui="v2" className="py-8 md:py-12">
      <p className="text-sm text-white/60">{t("badge")}</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">{t("listsTitle")}</h1>

      {lists.length === 0 ? (
        <p className="mt-6 text-white/70">{t("listsEmpty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-white/10">
          {lists.map((list) => (
            <li key={list.id}>
              <Link href={`/lists/${list.id}`} className="block py-3 text-white hover:underline">
                {list.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <a href={exitHref} className="mt-10 inline-block text-sm text-white/70 underline">
        {t("exit")}
      </a>
    </main>
  );
}
