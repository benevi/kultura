"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { IconFriends } from "@/components/icons";
import type { ListShelfItem } from "@/lib/social/lists";
import type { List } from "@/types/list";
import { formatVar } from "../Blocks";
import { Shelf } from "./Shelf";
import "./lists.css";

// El diálogo solo viaja a quien va a crear una lista.
const CreateListModal = dynamic(() =>
  import("@/components/social/CreateListModal").then((m) => m.CreateListModal),
);

// ============================================================
// KULTURA v2 — Mis listas
//
// Un índice de baldas: cada lista, su nombre y sus obras de pie, de modo que se
// reconoce por lo que tiene dentro. Recibe los mismos datos que la pantalla vieja
// y, además, los lomos (`getListShelves`).
// ============================================================

/** Las dos primeras baldas se ven sin hacer scroll. */
const EAGER_SHELVES = 2;

export function ListsScreen({
  lists,
  shelves,
  currentUserId,
  mixedEnabled = false,
}: {
  lists: List[];
  shelves: Record<string, ListShelfItem[]>;
  currentUserId: string;
  /** MIXED_LISTS (F-25): plantillas y listas de varios formatos al crear. */
  mixedEnabled?: boolean;
}) {
  const t = useTranslations("lists");
  const tf = useTranslations("filters");
  const [creating, setCreating] = useState(false);

  const newList = (
    <button type="button" className="k2-btn" onClick={() => setCreating(true)}>
      {t("newList")}
    </button>
  );

  return (
    <main className="k2l page-grid">
      <header className="k2l-head">
        <h1 className="k2l-title">{t("title")}</h1>
        {lists.length > 0 ? newList : null}
      </header>

      {lists.length === 0 ? (
        <div className="k2l-empty">
          <span className="k2l-shelf" aria-hidden="true" />
          <h2>{t("noLists")}</h2>
          <p>{t("noListsHint")}</p>
          {newList}
        </div>
      ) : (
        <ul className="k2l-index">
          {lists.map((list, index) => {
            const format = list.mediaType === "mixed" ? t("mediaTypeMixed") : tf(list.mediaType);
            const someoneElse = list.owner && list.ownerId !== currentUserId ? list.owner.username : null;
            return (
              <li key={list.id}>
                <Link href={`/lists/${list.id}`} className="k2l-row">
                  <span className="k2l-row__text">
                    <span className="k2l-row__name">{list.name}</span>
                    <span
                      className="k2l-meta"
                      style={{ "--c": list.mediaType === "mixed" ? "var(--k-bone)" : formatVar(list.mediaType) } as React.CSSProperties}
                    >
                      <i aria-hidden="true" />
                      <span>
                        {format}
                        {list.template ? ` · ${t(`template.${list.template}`)}` : ""}
                        {` · ${t("itemCount", { count: list.itemCount ?? 0 })}`}
                        {someoneElse ? ` · ${someoneElse}` : ""}
                      </span>
                      {list.isCollaborative ? (
                        <span className="k2l-meta__icon" title={t("collaborative")}>
                          <IconFriends aria-hidden="true" className="h-4 w-4" />
                          <span className="sr-only">{t("collaborative")}</span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <Shelf items={shelves[list.id] ?? []} eager={index < EAGER_SHELVES} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        // Límite propio: sin él, cargar el diálogo ocultaría la página y el foco se perdería.
        <Suspense fallback={null}>
          <CreateListModal mixedEnabled={mixedEnabled} onClose={() => setCreating(false)} />
        </Suspense>
      ) : null}
    </main>
  );
}
