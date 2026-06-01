// ============================================================
// KULTURA — Tipos de base de datos Supabase
// Tipos derivados del schema actual de Supabase.
// Usa snake_case igual que PostgreSQL.
//
// NOTA: Estos tipos se mantienen a mano. Fuente de verdad SQL:
// `supabase/migrations/20260502233945_remote_schema.sql` (baseline B2).
// Migración futura a `supabase gen types typescript` queda en backlog.
// ============================================================

/** Tabla: users */
export interface DbUser {
  id: string; // uuid
  username: string;
  avatar_color: string;
  avatar_initials: string;
  created_at: string; // timestamptz
  preferred_locale: string | null;
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
  synopsis: string | null;
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
  updated_at: string; // timestamptz — set by trigger set_updated_at on UPDATE
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
  type: "recommendation" | "list_invite" | "group_invite";
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

/** Tabla: suggestions */
export interface DbSuggestion {
  id: string; // uuid
  user_id: string | null; // uuid → users.id (on delete set null)
  type: "bug" | "feature" | "improvement" | "other";
  subject: string;
  description: string;
  created_at: string; // timestamptz
}

/** Tabla: conversations (DM 1-a-1 entre amigos) */
export interface DbConversation {
  id: string; // uuid
  created_at: string; // timestamptz
  last_message_at: string; // timestamptz — actualizado por trigger handle_new_message
}

/** Tabla: conversation_members (pivot users ↔ conversations) */
export interface DbConversationMember {
  conversation_id: string; // uuid → conversations.id (on delete cascade)
  user_id: string; // uuid → users.id (on delete cascade)
  last_read_at: string | null; // timestamptz
}

/** Tabla: messages (mensajes dentro de una conversación) */
export interface DbMessage {
  id: string; // uuid
  conversation_id: string; // uuid → conversations.id (on delete cascade)
  sender_id: string; // uuid → users.id (on delete cascade)
  content: string;
  created_at: string; // timestamptz
}

/** Tabla: groups */
export interface DbGroup {
  id: string; // uuid
  owner_id: string; // uuid → users.id (on delete cascade)
  name: string;
  description: string | null;
  cover_color: string; // hex '#RRGGBB' — default '#E82020'
  is_public: boolean; // default true — grupos privados invisibles a no-miembros (E45-c)
  created_at: string; // timestamptz
}

/** Tabla: group_members (pivot users ↔ groups) */
export interface DbGroupMember {
  group_id: string; // uuid → groups.id (on delete cascade)
  user_id: string; // uuid → users.id (on delete cascade)
  role: "owner" | "member";
  joined_at: string; // timestamptz
}

/** Tabla: group_invitations (invitaciones a grupos — solo amigos, accept vía notificación) */
export interface DbGroupInvitation {
  id: string; // uuid
  group_id: string; // uuid → groups.id (on delete cascade)
  inviter_id: string; // uuid → users.id (on delete cascade)
  invitee_id: string; // uuid → users.id (on delete cascade)
  status: "pending" | "accepted";
  created_at: string; // timestamptz
}

/** Tabla: group_posts (feed de un grupo) */
export interface DbGroupPost {
  id: string; // uuid
  group_id: string; // uuid → groups.id (on delete cascade)
  user_id: string; // uuid → users.id (on delete cascade)
  content: string;
  media_id: string | null; // text → media.id
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
      suggestions: { Row: DbSuggestion; Insert: Omit<DbSuggestion, "id" | "created_at">; Update: never };
      conversations: { Row: DbConversation; Insert: Partial<Pick<DbConversation, "id" | "created_at" | "last_message_at">>; Update: Pick<DbConversation, "last_message_at"> };
      conversation_members: { Row: DbConversationMember; Insert: Omit<DbConversationMember, "last_read_at"> & { last_read_at?: string | null }; Update: Pick<DbConversationMember, "last_read_at"> };
      messages: { Row: DbMessage; Insert: Omit<DbMessage, "id" | "created_at">; Update: never };
      groups: { Row: DbGroup; Insert: Omit<DbGroup, "id" | "created_at" | "cover_color" | "is_public"> & { cover_color?: string; is_public?: boolean }; Update: Partial<Omit<DbGroup, "id" | "owner_id">> };
      group_members: { Row: DbGroupMember; Insert: Omit<DbGroupMember, "joined_at" | "role"> & { role?: "owner" | "member" }; Update: Pick<DbGroupMember, "role"> };
      group_posts: { Row: DbGroupPost; Insert: Omit<DbGroupPost, "id" | "created_at">; Update: never };
      group_invitations: { Row: DbGroupInvitation; Insert: Omit<DbGroupInvitation, "id" | "created_at" | "status"> & { status?: "pending" | "accepted" }; Update: Pick<DbGroupInvitation, "status"> };
    };
  };
}
