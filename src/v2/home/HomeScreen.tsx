import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Parte, type ParteItem } from "./Parte";
import "./home.css";

// ============================================================
// KULTURA v2 — Inicio
//
// Abre con el parte de lo que llevas a medias: una obra grande y el resto en
// filas, cada una con su +1. Recibe los mismos datos que la pantalla vieja, para
// que el conmutador de `page.tsx` sea solo un `if`. Las demás secciones llegan ya
// montadas como `children`: conservan su lógica y aquí solo se les da sitio.
// ============================================================

export async function HomeScreen({
  items,
  fullProgress,
  notice,
  children,
}: {
  items: ParteItem[];
  fullProgress: boolean;
  notice?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = await getTranslations("home.v2");

  return (
    <main className="k2h page-grid">
      {notice ? <div className="k2h-notice">{notice}</div> : null}
      {items.length > 0 ? (
        <section aria-labelledby="k2h-title">
          <h1 id="k2h-title" className="k2h-title">
            {t("title")}
          </h1>
          <Parte items={items} fullProgress={fullProgress} />
        </section>
      ) : (
        <section className="k2h-empty" aria-labelledby="k2h-title">
          <h1 id="k2h-title" className="k2h-title">
            {t("emptyTitle")}
          </h1>
          <p>{t("emptyText")}</p>
          <div className="k2h-empty__actions">
            <Link href="/discover" className="k2-btn">
              {t("emptyDiscover")}
            </Link>
            <Link href="/settings/import" className="k2h-link">
              {t("emptyImport")}
            </Link>
          </div>
        </section>
      )}
      <div className="k2h-rest">{children}</div>
    </main>
  );
}
