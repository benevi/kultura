// ============================================================
// KULTURA — Tipos de Listas
// Una lista contiene un solo formato (DEC-008) o, con F-25 (MIXED_LISTS),
// varios (`mixed`): «Franquicia» = libro + películas + juego.
// ============================================================

import type { MediaType, MediaItem } from "./media";
import type { UserProfile } from "./user";

// Re-export para conveniencia
export type { UserProfile };

/** Formato de una lista: uno de los siete o `mixed` (F-25). */
export type ListMediaType = MediaType | "mixed";

/** Plantilla con la que se creó la lista (F-25). */
export type ListTemplate = "franchise" | "ranking";

/** Lista de títulos (pública o colaborativa) */
export interface List {
  id: string;
  ownerId: string;
  name: string;
  /** Un solo tipo de contenido por lista — DEC-008 — o `mixed` (F-25) */
  mediaType: ListMediaType;
  isCollaborative: boolean;
  /** Visible sin sesión en la colección pública del dueño */
  isPublic: boolean;
  createdAt: string;
  /** F-25: texto libre del dueño. */
  description?: string | null;
  /** F-25: «Ranking personal» numera los títulos. */
  template?: ListTemplate | null;
  /** Datos embebidos */
  owner?: UserProfile;
  itemCount?: number;
}

/** Item dentro de una lista */
export interface ListItem {
  id: string;
  listId: string;
  mediaId: string;
  addedBy?: string;
  addedAt: string;
  /** F-25: orden manual (0 = primero). Ausente sin la migración. */
  position?: number | null;
  /** F-25: nota de quien edita la lista. */
  note?: string | null;
  /** MediaItem embebido — disponible cuando se hace join */
  media?: MediaItem;
  /** Perfil de quien añadió el item */
  addedByUser?: UserProfile;
}

/** Miembro de una lista colaborativa */
export interface ListMember {
  listId: string;
  userId: string;
  /** Perfil del miembro — disponible cuando se hace join */
  user?: UserProfile;
}
