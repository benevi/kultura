"use client";

import { Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { CloseButton } from "@/components/ui/CloseButton";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { KButton } from "@/components/ui/KButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ShareLinkButton } from "@/components/social/ShareLinkButton";
import { createLogger } from "@/lib/logger";
import type { List, ListItem, ListMember } from "@/types/list";
import { formatVar } from "../Blocks";
import { Cover } from "../library/Cover";
import "./lists.css";

// Ordenar casi nunca se usa: no viaja con la página.
const ReorderableItems = dynamic(() =>
  import("@/app/[locale]/(app)/lists/[id]/ReorderableItems").then((m) => m.ReorderableItems),
);

// ============================================================
// KULTURA v2 — Una lista
//
// A la izquierda, la lista (qué es, quién la lleva, quién la ve); a la derecha,
// sus títulos en fila, porque aquí importan el orden y las notas. Mismos datos,
// mismas peticiones y mismos permisos que `ListDetail`; ordenar y anotar usa el
// mismo `ReorderableItems`.
// ============================================================

const log = createLogger("ListScreen");

const COVER_WIDTHS = [128, 256];
const EAGER_COVERS = 6;
const DESCRIPTION_MAX = 500;

type Friend = { id: string; username: string; avatarColor: string; avatarInitials: string };

export function ListScreen({
  list,
  items: initialItems,
  members: initialMembers,
  currentUserId,
  currentUserFriends,
  canEdit,
  mixedEnabled = false,
}: {
  list: List;
  items: ListItem[];
  members: ListMember[];
  currentUserId: string;
  currentUserFriends: Friend[];
  canEdit: boolean;
  /** MIXED_LISTS (F-25): ordenar, notas y descripción. */
  mixedEnabled?: boolean;
}) {
  const t = useTranslations("lists");
  const tf = useTranslations("filters");
  const tc = useTranslations("common");
  const tcol = useTranslations("collection");
  const tBadge = useTranslations("discoverFilters.typeBadge");
  const router = useRouter();

  const [items, setItems] = useState(initialItems);
  const [members, setMembers] = useState(initialMembers);
  const [removingItem, setRemovingItem] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  // Cada aviso, junto a lo que falló: en móvil las dos columnas quedan lejos.
  const [sideError, setSideError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(list.isPublic);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [description, setDescription] = useState(list.description ?? "");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState(false);

  const descriptionFieldId = useId();
  const descriptionHintId = useId();
  const inviteId = useId();
  const itemsHeading = useRef<HTMLHeadingElement>(null);
  const itemsSection = useRef<HTMLElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const refocusAt = useRef<number | null>(null);
  const onItemsChange = useCallback((next: ListItem[]) => setItems(next), []);

  // Tras quitar un título, sin mover la página: se puede seguir limpiando la lista.
  useEffect(() => {
    if (refocusAt.current === null) return;
    const rows = itemsSection.current?.querySelectorAll<HTMLButtonElement>(".k2l-item > button");
    const next = rows?.[Math.min(refocusAt.current, rows.length - 1)] ?? itemsHeading.current;
    refocusAt.current = null;
    next?.focus({ preventScroll: true });
  }, [items]);

  const ranked = list.template === "ranking";
  const canOrder = mixedEnabled && canEdit;
  const isOwner = list.ownerId === currentUserId;
  const isMixed = list.mediaType === "mixed";
  const publicPath = list.owner ? `/u/${list.owner.username}/l/${list.id}` : null;
  const format = isMixed ? t("mediaTypeMixed") : tf(list.mediaType as Parameters<typeof tf>[0]);
  const addHref = isMixed ? "/discover" : `/discover?type=${list.mediaType}`;

  const memberIds = new Set(members.map((m) => m.userId));
  memberIds.add(list.ownerId);
  const invitable = currentUserFriends.filter((f) => !memberIds.has(f.id));

  async function changeVisibility(value: string) {
    const next = value === "public";
    if (next === isPublic || savingVisibility) return;
    setSavingVisibility(true);
    setSideError(null);
    setIsPublic(next); // optimista: se revierte si falla
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      log.error("visibility change failed", { message: err instanceof Error ? err.message : String(err) });
      setIsPublic(!next);
      setSideError(tcol("visibilityError"));
    } finally {
      setSavingVisibility(false);
    }
  }

  async function deleteList() {
    setDeleting(true);
    setSideError(null);
    try {
      const res = await fetch("/api/lists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: list.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push("/lists");
      router.refresh();
    } catch (err) {
      log.error("delete failed", { message: err instanceof Error ? err.message : String(err) });
      setSideError(t("errorDelete"));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function removeItem(itemId: string) {
    setRemovingItem(itemId);
    setItemsError(null);
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // La fila con el botón pulsado desaparece: el foco pasa a la que ocupa su sitio.
      refocusAt.current = items.findIndex((i) => i.id === itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      log.error("remove failed", { message: err instanceof Error ? err.message : String(err) });
      setItemsError(t("removeError"));
    } finally {
      setRemovingItem(null);
    }
  }

  async function invite() {
    if (!inviteUserId) return;
    setInviting(true);
    setSideError(null);
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-action": "invite" },
        body: JSON.stringify({ userId: inviteUserId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSideError(data.error === "not_friends" ? t("inviteNotFriend") : t("inviteError"));
        return;
      }
      const friend = currentUserFriends.find((f) => f.id === inviteUserId);
      if (friend) {
        setMembers((prev) => [
          ...prev,
          {
            listId: list.id,
            userId: friend.id,
            user: {
              id: friend.id,
              username: friend.username,
              avatarColor: friend.avatarColor,
              avatarInitials: friend.avatarInitials,
              createdAt: "",
            },
          },
        ]);
      }
      setInviteUserId("");
    } catch (err) {
      log.error("invite failed", { message: err instanceof Error ? err.message : String(err) });
      setSideError(t("inviteError"));
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string) {
    setSideError(null);
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-action": "remove-member" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err) {
      log.error("remove member failed", { message: err instanceof Error ? err.message : String(err) });
      setSideError(t("removeMemberError"));
    }
  }

  async function saveDescription(e: React.FormEvent) {
    e.preventDefault();
    setSavingDescription(true);
    setDescriptionError(false);
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descriptionDraft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDescription(descriptionDraft.trim());
      setEditingDescription(false);
    } catch (err) {
      log.error("description save failed", { message: err instanceof Error ? err.message : String(err) });
      setDescriptionError(true);
    } finally {
      setSavingDescription(false);
    }
  }

  return (
    <main className="k2l k2l--one page-grid">
      <div className="k2l-side">
        <h1 className="k2l-title">{list.name}</h1>

        <p
          className="k2l-meta"
          style={{ "--c": isMixed ? "var(--k-bone)" : formatVar(list.mediaType) } as React.CSSProperties}
        >
          <i aria-hidden="true" />
          <span>
            {format}
            {list.template ? ` · ${t(`template.${list.template}`)}` : ""}
            {` · ${t("itemCount", { count: items.length })}`}
          </span>
        </p>

        {description && !editingDescription ? <p className="k2l-description">{description}</p> : null}

        {isOwner && mixedEnabled && !editingDescription ? (
          <button
            type="button"
            className="k2-link k2l-small"
            onClick={() => {
              setDescriptionDraft(description);
              setDescriptionError(false);
              setEditingDescription(true);
            }}
          >
            {description ? t("editDescription") : t("addDescription")}
          </button>
        ) : null}

        {isOwner && mixedEnabled && editingDescription ? (
          <form onSubmit={saveDescription} className="k2l-form">
            <label htmlFor={descriptionFieldId}>{t("descriptionLabel")}</label>
            <textarea
              id={descriptionFieldId}
              autoFocus
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              placeholder={t("descriptionPlaceholder")}
              aria-describedby={descriptionHintId}
              aria-invalid={descriptionError ? true : undefined}
            />
            <p id={descriptionHintId} className="k2l-small k2l-dim">
              {t("descriptionHint", { count: DESCRIPTION_MAX - descriptionDraft.length })}
            </p>
            {descriptionError ? (
              <p role="alert" className="k2l-error">
                {t("descriptionError")}
              </p>
            ) : null}
            <div className="k2l-form__actions">
              <KButton type="submit" size="sm" loading={savingDescription}>
                {t("descriptionSave")}
              </KButton>
              <KButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setEditingDescription(false)}
                disabled={savingDescription}
              >
                {t("cancel")}
              </KButton>
            </div>
          </form>
        ) : null}

        {canEdit ? (
          <Link href={addHref} className="k2-btn k2l-add">
            {t("addItem")}
          </Link>
        ) : null}

        {isOwner ? (
          <div className="k2l-group">
            <div className="k2l-visibility">
              <SegmentedControl
                ariaLabel={tcol("visibility")}
                value={isPublic ? "public" : "private"}
                onChange={changeVisibility}
                options={[
                  { value: "private", label: tcol("private") },
                  { value: "public", label: tcol("public") },
                ]}
              />
              {isPublic && publicPath ? (
                <ShareLinkButton path={publicPath} title={list.name} label={tcol("share")} />
              ) : null}
            </div>
            <p className="k2l-small k2l-dim">{isPublic ? tcol("publicHint") : tcol("privateHint")}</p>
          </div>
        ) : null}

        {list.isCollaborative && (list.owner || members.length > 0) ? (
          <section className="k2l-group">
            <h2 className="k2l-h2">{t("membersTitle")}</h2>
            <ul className="k2l-members">
              {list.owner ? (
                <li>
                  <Avatar initials={list.owner.avatarInitials} color={list.owner.avatarColor} size="sm" />
                  <Link href={`/profile/${list.owner.username}`} className="k2l-members__name">
                    {list.owner.username}
                  </Link>
                  <span className="k2l-small k2l-dim">{t("owner")}</span>
                </li>
              ) : null}
              {members.map((m) =>
                m.user ? (
                  <li key={m.userId}>
                    <Avatar initials={m.user.avatarInitials} color={m.user.avatarColor} size="sm" />
                    <Link href={`/profile/${m.user.username}`} className="k2l-members__name">
                      {m.user.username}
                    </Link>
                    {isOwner ? (
                      <CloseButton
                        size="sm"
                        label={`${t("removeMember")}: ${m.user.username}`}
                        onClick={() => removeMember(m.userId)}
                      />
                    ) : null}
                  </li>
                ) : null,
              )}
            </ul>
            {isOwner && invitable.length > 0 ? (
              <div className="k2l-invite">
                <label htmlFor={inviteId} className="sr-only">
                  {t("inviteMember")}
                </label>
                <select id={inviteId} value={inviteUserId} onChange={(e) => setInviteUserId(e.target.value)}>
                  <option value="">{t("selectFriend")}</option>
                  {invitable.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.username}
                    </option>
                  ))}
                </select>
                <KButton size="sm" loading={inviting} disabled={!inviteUserId} onClick={invite}>
                  {t("invite")}
                </KButton>
              </div>
            ) : null}
          </section>
        ) : null}

        {sideError ? (
          <p role="alert" className="k2l-error">
            {sideError}
          </p>
        ) : null}

        {isOwner ? (
          <button
            ref={deleteButton}
            type="button"
            className="k2-link k2l-small k2l-delete"
            onClick={() => setConfirmDelete(true)}
          >
            {t("deleteList")}
          </button>
        ) : null}
      </div>

      <section ref={itemsSection} className="k2l-items" aria-labelledby={`${inviteId}-items`}>
        <div className="k2l-items__head">
          <h2 id={`${inviteId}-items`} ref={itemsHeading} tabIndex={-1} className="k2l-h2">
            {t("itemsTitle")}
          </h2>
          {canOrder && items.length > 0 ? (
            <button
              type="button"
              className="k2l-toggle"
              aria-pressed={reordering}
              onClick={() => setReordering((v) => !v)}
            >
              {reordering ? t("reorderDone") : t("reorder")}
            </button>
          ) : null}
        </div>

        {itemsError ? (
          <p role="alert" className="k2l-error">
            {itemsError}
          </p>
        ) : null}

        {reordering && canOrder && items.length > 0 ? (
          // Límite propio: sin él, cargar este trozo ocultaría la página y el foco se perdería.
          <Suspense fallback={null}>
            <ReorderableItems listId={list.id} items={items} onItemsChange={onItemsChange} ranked={ranked} />
          </Suspense>
        ) : items.length === 0 ? (
          <div className="k2l-empty">
            <span className="k2l-shelf" aria-hidden="true" />
            <h3>{t("noItems")}</h3>
            {canEdit ? (
              <>
                <p>{t("noItemsHint")}</p>
                <Link href={addHref} className="k2-btn">
                  {t("noItemsDiscover")}
                </Link>
              </>
            ) : null}
          </div>
        ) : (
          // El orden es el de lectura; el número solo se pinta en un ranking.
          <ol className="k2l-list" data-ranked={ranked ? "true" : undefined}>
            {items.map((item, index) => {
              const title = item.media?.title ?? item.mediaId;
              const href = item.media ? `/media/${item.media.type}/${item.media.externalId}` : null;
              return (
                <li
                  key={item.id}
                  className="k2l-item"
                  style={{ "--c": item.media ? formatVar(item.media.type) : "var(--k-bone)" } as React.CSSProperties}
                >
                  {ranked ? (
                    <>
                      <span className="k2l-item__rank" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="sr-only">{t("rankPosition", { position: index + 1 })}</span>
                    </>
                  ) : null}
                  <span className="k2l-item__cover">
                    <Cover
                      poster={item.media?.poster}
                      title={title}
                      widths={COVER_WIDTHS}
                      sizes="72px"
                      loading={index < EAGER_COVERS ? "eager" : "lazy"}
                    />
                  </span>
                  <div className="k2l-item__text">
                    {href ? (
                      <Link href={href} className="k2l-item__title" prefetch={false}>
                        {title}
                      </Link>
                    ) : (
                      <span className="k2l-item__title">{title}</span>
                    )}
                    {item.media ? (
                      <p className="k2l-meta">
                        <i aria-hidden="true" />
                        <span>
                          {tBadge(item.media.type as Parameters<typeof tBadge>[0])}
                          {item.media.year ? ` · ${item.media.year}` : ""}
                        </span>
                      </p>
                    ) : null}
                    {mixedEnabled && item.note ? (
                      <p className="k2l-item__note">
                        <span className="sr-only">{t("noteFor", { title })}: </span>
                        {item.note}
                      </p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <CloseButton
                      label={t("removeItemNamed", { title })}
                      disabled={removingItem === item.id}
                      onClick={() => removeItem(item.id)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <ConfirmModal
        isOpen={confirmDelete}
        title={t("deleteListTitle")}
        message={t("deleteListConfirm")}
        confirmLabel={tc("confirm")}
        cancelLabel={tc("cancel")}
        isDestructive
        loading={deleting}
        finalFocusRef={deleteButton}
        onConfirm={deleteList}
        onCancel={() => setConfirmDelete(false)}
      />
    </main>
  );
}
