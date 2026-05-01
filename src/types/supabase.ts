// ============================================================
// KULTURA — Tipos de base de datos Supabase
// Refleja exactamente las columnas de 001_initial_schema.sql
// Usa snake_case igual que PostgreSQL.
//
// NOTA: Estos tipos se escriben a mano siguiendo el esquema SQL.
// En Fase 6 se sincronizarán con `supabase gen types typescript`.
// ============================================================

/** Tabla: users */
export interface DbUser {
  id: string; // uuid
  username: string;
  avatar_color: string;
  avatar_initials: string;
  created_at: string; // timestamptz
  preferred_locale: string | null; // añadido en 010_settings_columns.sql
}

/** Tabla: media */
export interface DbMedia {
  id: string; // text — formato "{type}_{external_id}"
  external_id: string;
  type: "movie" | "tv" | "anime" | "book" | "comic" | "manga" | "game";
  title: string;
  poster: string | null;
  backdrop: string | null;
  year: number | null;
  synopsis: string | null; // añadida en 002_add_synopsis.sql
  metadata: Record<string, unknown> | null; // jsonb
  updated_at: string; // timestamptz
}

/** Tabla: user_media */
export interface DbUserMedia {
  id: string; // uuid
  user_id: string; // uuid → users.id
  media_id: string; // text → media.id
  status: "completed" | "in_progress" | "pending" | "abandoned";
  score: number | null; // smallint 1-5
  watched_at: string | null; // date
  episode_progress: { season?: number; episode: number } | null; // jsonb
  created_at: string; // timestamptz
  updated_at: string; // timestamptz — set by trigger on UPDATE (migración 006)
}

/** Tabla: friendships */
export interface DbFriendship {
  id: string; // uuid
  requester_id: string; // uuid → users.id
  receiver_id: string; // uuid → users.id
  status: "pending" | "accepted";
  created_at: string; // timestamptz
}

/** Tabla: recommendations */
export interface DbRecommendation {
  id: string; // uuid
  from_user_id: string; // uuid → users.id
  to_user_id: string; // uuid → users.id
  media_id: string; // text → media.id
  message: string | null;
  read_at: string | null; // timestamptz
  created_at: string; // timestamptz
}

/** Tabla: lists */
export interface DbList {
  id: string; // uuid
  owner_id: string; // uuid → users.id
  name: string;
  media_type: "movie" | "tv" | "anime" | "book" | "comic" | "manga" | "game";
  is_collaborative: boolean;
  created_at: string; // timestamptz
}

/** Tabla: list_members */
export interface DbListMember {
  list_id: string; // uuid → lists.id
  user_id: string; // uuid → users.id
}

/** Tabla: list_items */
export interface DbListItem {
  id: string; // uuid
  list_id: string; // uuid → lists.id
  media_id: string; // text → media.id
  added_by: string | null; // uuid → users.id (on delete set null)
  added_at: string; // timestamptz
}

/** Tabla: notifications */
export interface DbNotification {
  id: string; // uuid
  user_id: string; // uuid → users.id
  type: "recommendation" | "list_invite";
  payload: Record<string, unknown>; // jsonb
  read_at: string | null; // timestamptz
  created_at: string; // timestamptz
}

/** Tabla: reports */
export interface DbReport {
  id: string; // uuid
  reporter_id: string; // uuid → users.id
  target_type: "user" | "media";
  target_id: string;
  reason: string | null;
  created_at: string; // timestamptz
}

/**
 * Mapa completo del schema — útil para tipar el cliente Supabase genérico.
 * Uso: createClient<Database>()
 */
export interface Database {
  public: {
    Tables: {
      users: { Row: DbUser; Insert: Omit<DbUser, "created_at" | "preferred_locale"> & { preferred_locale?: string | null }; Update: Partial<Omit<DbUser, "id">> };
      media: {
        Row: DbMedia;
        Insert: Omit<DbMedia, "updated_at" | "synopsis"> & { synopsis?: string | null };
        Update: Partial<Omit<DbMedia, "id">>;
      };
      user_media: { Row: DbUserMedia; Insert: Omit<DbUserMedia, "id" | "created_at" | "updated_at">; Update: Partial<Omit<DbUserMedia, "id" | "user_id" | "media_id" | "updated_at">> };
      friendships: { Row: DbFriendship; Insert: Omit<DbFriendship, "id" | "created_at">; Update: Pick<DbFriendship, "status"> };
      recommendations: { Row: DbRecommendation; Insert: Omit<DbRecommendation, "id" | "created_at">; Update: Pick<DbRecommendation, "read_at"> };
      lists: { Row: DbList; Insert: Omit<DbList, "id" | "created_at">; Update: Partial<Omit<DbList, "id" | "owner_id">> };
      list_members: { Row: DbListMember; Insert: DbListMember; Update: never };
      list_items: { Row: DbListItem; Insert: Omit<DbListItem, "id" | "added_at">; Update: never };
      notifications: { Row: DbNotification; Insert: Omit<DbNotification, "id" | "created_at">; Update: Pick<DbNotification, "read_at"> };
      reports: { Row: DbReport; Insert: Omit<DbReport, "id" | "created_at">; Update: never };
    };
  };
}
