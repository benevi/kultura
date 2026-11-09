import { useTranslations } from "next-intl";
import "./lists.css";

const PULSE = "motion-safe:animate-pulse k2l-skel";

// Esqueletos con el mismo CSS que las pantallas: al llegar los datos, nada salta.
export function ListsSkeleton() {
  const t = useTranslations("common");
  return (
    <main className="k2l page-grid" aria-busy="true">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" className="k2l-skelwrap">
        <div className="k2l-head">
          <div className={`${PULSE} k2l-skel--title`} />
          <div className={`${PULSE} k2l-skel--button`} />
        </div>
        <div className="k2l-index">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="k2l-row">
              <div className="k2l-row__text">
                <div className={`${PULSE} k2l-skel--name`} />
                <div className={`${PULSE} k2l-skel--line`} />
              </div>
              <div className={`${PULSE} k2l-skel--shelf`} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function ListSkeleton() {
  const t = useTranslations("common");
  return (
    <main className="k2l k2l--one page-grid" aria-busy="true">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" className="k2l-side">
        <div className={`${PULSE} k2l-skel--title`} />
        <div className={`${PULSE} k2l-skel--line`} />
        <div className={`${PULSE} k2l-skel--button k2l-add`} />
      </div>
      <div aria-hidden="true" className="k2l-items">
        <div className="k2l-items__head">
          <div className={`${PULSE} k2l-skel--line`} />
        </div>
        <div className="k2l-list">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="k2l-item">
              <div className={`${PULSE} k2l-skel--cover`} />
              <div className="k2l-item__text">
                <div className={`${PULSE} k2l-skel--name`} />
                <div className={`${PULSE} k2l-skel--line`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
