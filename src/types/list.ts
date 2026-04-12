// ============================================================
// KULTURA — Tipos de Listas
// Una lista solo puede contener un tipo de contenido (DEC-008)
// ============================================================

import type { MediaType, MediaItem } from "./media";
import type { UserProfile } from "./user";

// Re-export para conveniencia
export type { UserProfile };

/** Lista de títulos (pública o colaborativa) */
export interface List {
  id: string;
  ownerId: string;
  name: string;
  /** Un solo tipo de contenido por lista — DEC-008 */
  mediaType: MediaType;
  isCollaborative: boolean;
  createdAt: string;
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
