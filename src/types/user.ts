// ============================================================
// KULTURA — Tipos de Usuario y Social
// ============================================================

import type { MediaItem, MediaStatus } from "./media";

/** Perfil público de usuario (refleja la tabla `users`) */
export interface UserProfile {
  id: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  createdAt: string;
}

/**
 * Entrada de biblioteca personal.
 * Combina los datos de `user_media` con el `MediaItem` embebido
 * para evitar joins adicionales en los componentes.
 */
export interface UserMedia {
  id: string;
  userId: string;
  mediaId: string;
  status: MediaStatus;
  score?: number; // 1-5
  watchedAt?: string; // ISO date
  episodeProgress?: EpisodeProgress;
  createdAt: string;
  /** MediaItem embebido — disponible cuando se hace join con la tabla media */
  media?: MediaItem;
}

/** Progreso de episodios para series y anime */
export interface EpisodeProgress {
  season?: number;
  episode: number;
}

/** Estado de una amistad */
export type FriendshipStatus = "pending" | "accepted";

/** Amistad entre dos usuarios */
export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  createdAt: string;
  /** Perfil del otro usuario — disponible cuando se hace join */
  otherUser?: UserProfile;
}

/** Recomendación directa de un usuario a otro */
export interface Recommendation {
  id: string;
  fromUserId: string;
  toUserId: string;
  mediaId: string;
  message?: string;
  readAt?: string;
  createdAt: string;
  /** Datos embebidos — disponibles cuando se hace join */
  fromUser?: UserProfile;
  media?: MediaItem;
}

/** Tipo de notificación */
export type NotificationType = "recommendation" | "list_invite";

/** Notificación in-app */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}
