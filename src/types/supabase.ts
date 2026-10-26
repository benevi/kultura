// ============================================================
// KULTURA — Tipos de base de datos Supabase
//
// Dos partes:
//
// 1. Bloque GENERADO (entre las marcas `<supabase-gen-types>`): `Json`,
//    `Database` y los ayudantes `Tables<>`, `TablesInsert<>`, `TablesUpdate<>`,
//    `Enums<>`, `CompositeTypes<>`. Es la salida literal de postgres-meta
//    0.100.0 (el generador que ejecuta `supabase gen types typescript`). No se
//    edita a mano: se regenera con
//
//      scripts/db-diff.sh --gen-types          (base de $SUPABASE_DB_URL)
//
//    que sustituye solo lo que hay entre las marcas. La versión actual sale de
//    aplicar TODAS las migraciones de `supabase/migrations/` (hasta
//    `20261208250001_platforms_mixed_lists.sql`), en orden, sobre un
//    PostgreSQL 16 vacío:
//    incluye las tablas y columnas de migraciones que quizá aún no estén
//    aplicadas en producción. Regenerar desde producción SOLO después de
//    aplicarlas todas (ver `supabase/README.md`); si no, desaparecerían tipos
//    que el código ya usa.
//
// 2. Tipos de dominio `Db*` (a mano): filas con los literales que el código
//    usa (`'movie' | 'tv' | …`) en vez de `string`. Al final del archivo hay
//    una comprobación de compilación: si una tabla gana o pierde una columna
//    en `Database` y su `Db*` no se actualiza, `tsc` falla nombrando la
//    columna. Las columnas que añade una migración pendiente van como
//    opcionales (`?`), porque el código tiene que funcionar antes y después.
//    Los `created_at`/`joined_at`/… admiten NULL en el esquema pero tienen
//    `DEFAULT now()`: el dominio los da por presentes.
//
// Detector de deriva migraciones ↔ tipos ↔ código: tests/unit/schema/schema-drift.test.ts.
// ============================================================

// <supabase-gen-types> — generado; no editar a mano (scripts/db-diff.sh --gen-types)
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_state: {
        Row: {
          deletion_requested_at: string | null
          onboarded_at: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          deletion_requested_at?: string | null
          onboarded_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          deletion_requested_at?: string | null
          onboarded_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recs: {
        Row: {
          created_at: string
          day: string
          locale: string
          payload: NonNullable<Json>
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          day: string
          locale: string
          payload: NonNullable<Json>
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          locale?: string
          payload?: NonNullable<Json>
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          calls: number
          day: string
          kind: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          calls?: number
          day: string
          kind: string
          updated_at?: string
        }
        Update: {
          calls?: number
          day?: string
          kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          dedupe_key: string | null
          id: string
          name: string
          props: NonNullable<Json>
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          name: string
          props?: NonNullable<Json>
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          name?: string
          props?: NonNullable<Json>
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        ComputedFields: never
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          last_read_at: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          conversation_id: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
        }
        Relationships: []
      }
      email_consent_events: {
        Row: {
          action: string
          created_at: string
          id: string
          source: string
          text_version: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          action: string
          created_at?: string
          id?: string
          source: string
          text_version: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          source?: string
          text_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_consent_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          consent_version: string | null
          consented_at: string | null
          optin_requested_at: string | null
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        ComputedFields: never
        Insert: {
          consent_version?: string | null
          consented_at?: string | null
          optin_requested_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          consent_version?: string | null
          consented_at?: string | null
          optin_requested_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          items: number
          kind: string
          period: string
          provider_id: string | null
          returned_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          items?: number
          kind?: string
          period: string
          provider_id?: string | null
          returned_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          items?: number
          kind?: string
          period?: string
          provider_id?: string | null
          returned_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          requester_id: string
          status: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          requester_id: string
          status: string
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          group_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          banned_by?: string | null
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_bans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          invitee_id: string
          inviter_id: string
          status: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          invitee_id: string
          inviter_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string | null
          role: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          group_id: string
          joined_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_posts: {
        Row: {
          content: string
          created_at: string | null
          group_id: string
          id: string
          media_id: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          content: string
          created_at?: string | null
          group_id: string
          id?: string
          media_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          group_id?: string
          id?: string
          media_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_posts_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          cover_color: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_public: boolean
          name: string
          owner_id: string
        }
        ComputedFields: never
        Insert: {
          cover_color?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
        }
        Update: {
          cover_color?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          added_at: string | null
          added_by: string | null
          id: string
          list_id: string
          media_id: string
          note: string | null
          position: number | null
        }
        ComputedFields: never
        Insert: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          list_id: string
          media_id: string
          note?: string | null
          position?: number | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          list_id?: string
          media_id?: string
          note?: string | null
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "list_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      list_members: {
        Row: {
          added_at: string
          list_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          added_at?: string
          list_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_collaborative: boolean | null
          is_public: boolean
          media_type: string
          name: string
          owner_id: string
          template: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_collaborative?: boolean | null
          is_public?: boolean
          media_type: string
          name: string
          owner_id: string
          template?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_collaborative?: boolean | null
          is_public?: boolean
          media_type?: string
          name?: string
          owner_id?: string
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          backdrop: string | null
          external_id: string
          id: string
          metadata: Json | null
          poster: string | null
          synopsis: string | null
          title: string
          type: string
          updated_at: string | null
          year: number | null
        }
        ComputedFields: never
        Insert: {
          backdrop?: string | null
          external_id: string
          id: string
          metadata?: Json | null
          poster?: string | null
          synopsis?: string | null
          title: string
          type: string
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          backdrop?: string | null
          external_id?: string
          id?: string
          metadata?: Json | null
          poster?: string | null
          synopsis?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
      media_translations: {
        Row: {
          cache_key: string
          content: string
          created_at: string
          field: string
          locale: string
          media_id: string
          source_hash: string
        }
        ComputedFields: never
        Insert: {
          cache_key: string
          content: string
          created_at?: string
          field: string
          locale: string
          media_id: string
          source_hash: string
        }
        Update: {
          cache_key?: string
          content?: string
          created_at?: string
          field?: string
          locale?: string
          media_id?: string
          source_hash?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          sender_id: string
        }
        ComputedFields: never
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          payload: NonNullable<Json>
          read_at: string | null
          type: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          id?: string
          payload: NonNullable<Json>
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: NonNullable<Json>
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string | null
          from_user_id: string
          id: string
          media_id: string
          message: string | null
          read_at: string | null
          to_user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          from_user_id: string
          id?: string
          media_id: string
          message?: string | null
          read_at?: string | null
          to_user_id: string
        }
        Update: {
          created_at?: string | null
          from_user_id?: string
          id?: string
          media_id?: string
          message?: string | null
          read_at?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          contact_email: string | null
          created_at: string | null
          id: string
          reason: string | null
          reporter_id: string | null
          resolution: string | null
          resolved_at: string | null
          target_id: string
          target_type: string
        }
        ComputedFields: never
        Insert: {
          contact_email?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          created_at: string | null
          description: string
          id: string
          subject: string
          type: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          subject: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          subject?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media: {
        Row: {
          created_at: string | null
          episode_progress: Json | null
          favorite: boolean
          id: string
          media_id: string
          progress_chapter: number | null
          progress_episode: number | null
          progress_hours: number | null
          progress_page: number | null
          progress_percent: number | null
          progress_season: number | null
          progress_total: number | null
          progress_updated_at: string | null
          progress_volume: number | null
          rating10: number | null
          score: number | null
          status: string
          updated_at: string
          user_id: string
          watched_at: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          episode_progress?: Json | null
          favorite?: boolean
          id?: string
          media_id: string
          progress_chapter?: number | null
          progress_episode?: number | null
          progress_hours?: number | null
          progress_page?: number | null
          progress_percent?: number | null
          progress_season?: number | null
          progress_total?: number | null
          progress_updated_at?: string | null
          progress_volume?: number | null
          rating10?: number | null
          score?: number | null
          status: string
          updated_at?: string
          user_id: string
          watched_at?: string | null
        }
        Update: {
          created_at?: string | null
          episode_progress?: Json | null
          favorite?: boolean
          id?: string
          media_id?: string
          progress_chapter?: number | null
          progress_episode?: number | null
          progress_hours?: number | null
          progress_page?: number | null
          progress_percent?: number | null
          progress_season?: number | null
          progress_total?: number | null
          progress_updated_at?: string | null
          progress_volume?: number | null
          rating10?: number | null
          score?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_logs: {
        Row: {
          created_at: string
          id: string
          media_id: string
          private_note: string | null
          rating10: number | null
          review: string | null
          rewatch: boolean
          spoiler: boolean
          updated_at: string
          user_id: string
          watched_on: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          private_note?: string | null
          rating10?: number | null
          review?: string | null
          rewatch?: boolean
          spoiler?: boolean
          updated_at?: string
          user_id: string
          watched_on?: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          private_note?: string | null
          rating10?: number | null
          review?: string | null
          rewatch?: boolean
          spoiler?: boolean
          updated_at?: string
          user_id?: string
          watched_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_logs_entry_fkey"
            columns: ["user_id", "media_id"]
            isOneToOne: false
            referencedRelation: "user_media"
            referencedColumns: ["user_id", "media_id"]
          },
          {
            foreignKeyName: "user_media_logs_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaming_services: {
        Row: {
          region: string | null
          services: number[]
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          region?: string | null
          services?: number[]
          updated_at?: string
          user_id: string
        }
        Update: {
          region?: string | null
          services?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_streaming_services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      username_history: {
        Row: {
          changed_at: string
          old_username: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          changed_at?: string
          old_username: string
          user_id: string
        }
        Update: {
          changed_at?: string
          old_username?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "username_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_color: string
          avatar_icon: string | null
          avatar_initials: string
          bio: string | null
          created_at: string | null
          id: string
          library_visibility: string
          preferred_locale: string | null
          username: string
        }
        ComputedFields: never
        Insert: {
          avatar_color?: string
          avatar_icon?: string | null
          avatar_initials: string
          bio?: string | null
          created_at?: string | null
          id: string
          library_visibility?: string
          preferred_locale?: string | null
          username: string
        }
        Update: {
          avatar_color?: string
          avatar_icon?: string | null
          avatar_initials?: string
          bio?: string | null
          created_at?: string | null
          id?: string
          library_visibility?: string
          preferred_locale?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      funnel_weekly: {
        Row: {
          d7_final: boolean | null
          first_action_7d: number | null
          first_action_pct: number | null
          invites_accepted: number | null
          retained_d7: number | null
          retained_d7_pct: number | null
          signups: number | null
          signups_direct: number | null
          signups_ref: number | null
          signups_utm: number | null
          three_titles_7d: number | null
          three_titles_pct: number | null
          week: string | null
        }
        ComputedFields: never
        Relationships: []
      }
    }
    Functions: {
      can_read_library: { Args: { p_owner: string }; Returns: boolean }
      can_read_list: { Args: { target_list: string }; Returns: boolean }
      can_send_message: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      create_conversation_with_members: {
        Args: { target_user_id: string }
        Returns: string
      }
      deletion_preview: { Args: { p_user: string }; Returns: Json }
      email_confirm_weekly: {
        Args: { p_text_version: string; p_user: string }
        Returns: boolean
      }
      email_unsubscribe: {
        Args: { p_source: string; p_user: string }
        Returns: boolean
      }
      group_successor: {
        Args: { p_group: string; p_user: string }
        Returns: string
      }
      has_block_with: { Args: { p_other: string }; Returns: boolean }
      increment_ai_usage: {
        Args: { p_cap: number; p_kind: string }
        Returns: boolean
      }
      is_banned_from_group: { Args: { p_group_id: string }; Returns: boolean }
      is_conversation_member: {
        Args: { conv_id: string; uid: string }
        Returns: boolean
      }
      is_demo_session: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_group_member: {
        Args: { group_id: string; uid: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { p_group_id: string; p_uid: string }
        Returns: boolean
      }
      list_successor: {
        Args: { p_list: string; p_user: string }
        Returns: string
      }
      purge_old_analytics_events: { Args: { p_keep?: string }; Returns: number }
      reorder_list_items: {
        Args: { p_items: string[]; p_list: string }
        Returns: number
      }
      rls_audit: {
        Args: Record<PropertyKey, never>
        Returns: {
          demo_delete: boolean
          demo_insert: boolean
          demo_update: boolean
          escritura_authenticated: boolean
          ok: boolean
          politicas_sin_check: number
          rls: boolean
          tabla: string
        }[]
      }
      set_email_weekly: {
        Args: { p_enabled: boolean; p_source?: string; p_text_version: string }
        Returns: {
          consent_version: string
          consented_at: string
          weekly_digest: boolean
        }[]
      }
      transfer_owned_content: { Args: { p_user: string }; Returns: Json }
      username_redirect: { Args: { p_username: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
// </supabase-gen-types>

// ============================================================
// Tipos de dominio (a mano). Snake_case igual que PostgreSQL.
// ============================================================

/** Tabla: users */
export interface DbUser {
  id: string; // uuid
  username: string;
  avatar_color: string;
  avatar_initials: string;
  /** E-AVATAR-ICONS: clave del catálogo de personajes. null = iniciales. */
  avatar_icon: string | null;
  /** Texto libre del perfil (≤ 300, `users_bio_length`). No todas las consultas lo piden. */
  bio?: string | null;
  /** F-12 (`20261101120001_identity_privacy`): quién ve la biblioteca. Ausente antes de aplicarla. */
  library_visibility?: "public" | "friends" | "private";
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
  score: number | null; // smallint 1-5 (el disparador user_media_sync_rating la deriva de rating10)
  /** numeric(3,1) 0,5-10 en pasos de 0,5 (F-24). Ausente antes de 20261208240001. */
  rating10?: number | null;
  /** F-24. Ausente antes de 20261208240001. */
  favorite?: boolean;
  watched_at: string | null; // date
  /** jsonb. Con 20261215270001 (F-27), espejo de las columnas progress_* (user_media_sync_progress). */
  episode_progress: { season?: number; episode: number } | null; // jsonb
  /** F-27: progreso por formato. Ausentes antes de 20261215270001 (rangos en sus CHECK). */
  progress_season?: number | null; // smallint 0-999
  progress_episode?: number | null; // integer 1-99999
  progress_chapter?: number | null; // numeric(6,1) 0-99999.9
  progress_volume?: number | null; // integer 0-9999
  progress_page?: number | null; // integer 0-100000
  progress_percent?: number | null; // smallint 0-100
  progress_hours?: number | null; // numeric(6,1) 0-99999.9
  progress_total?: number | null; // integer 1-100000 (total de la unidad principal)
  progress_updated_at?: string | null; // timestamptz
  created_at: string; // timestamptz
  updated_at: string; // timestamptz — set by trigger set_updated_at on UPDATE
}

/** Tabla: user_media_logs (diario, F-24; FK compuesta → user_media y media_id → media, on delete cascade) */
export interface DbUserMediaLog {
  id: string; // uuid
  user_id: string; // uuid
  media_id: string; // text
  watched_on: string; // date (por defecto hoy)
  rewatch: boolean;
  rating10: number | null; // numeric(3,1) 0,5-10, pasos de 0,5
  review: string | null; // ≤ 5000
  spoiler: boolean;
  private_note: string | null; // ≤ 2000, solo la ve su dueño
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
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
  /** `mixed` (varios formatos) solo tras F-25 (`20261208250001_platforms_mixed_lists`). */
  media_type: "movie" | "tv" | "anime" | "book" | "comic" | "manga" | "game" | "mixed";
  is_collaborative: boolean;
  /** Visible sin sesión en /u/{username}. Por defecto privada. */
  is_public: boolean;
  created_at: string; // timestamptz
  /** F-25: texto libre (≤ 500). Ausente antes de aplicarla. */
  description?: string | null;
  /** F-25: plantilla con la que se creó (`franchise` | `ranking`). Ausente antes de aplicarla. */
  template?: "franchise" | "ranking" | null;
}

/** Tabla: list_members */
export interface DbListMember {
  list_id: string; // uuid → lists.id
  user_id: string; // uuid → users.id
  /** F-12 (`20261101120001_identity_privacy`): para elegir sucesor. Ausente antes de aplicarla. */
  added_at?: string; // timestamptz
}

/** Tabla: list_items */
export interface DbListItem {
  id: string; // uuid
  list_id: string; // uuid → lists.id
  media_id: string; // text → media.id
  added_by: string | null; // uuid → users.id (on delete set null)
  added_at: string; // timestamptz
  /** F-25: orden manual (0 = primero; el disparador pone los nuevos al final). Ausente antes de aplicarla. */
  position?: number | null;
  /** F-25: nota de quien edita la lista (≤ 500). Ausente antes de aplicarla. */
  note?: string | null;
}

/** Tabla: notifications */
export interface DbNotification {
  id: string; // uuid
  user_id: string; // uuid → users.id
  // F-17 añadió 'invite_accepted' al CHECK (`20261115170001_analytics`); el
  // literal no se amplía aquí porque `AppNotification` (lib/social/notifications.ts)
  // aún no lo admite. Pendiente en ese archivo.
  type: "recommendation" | "list_invite" | "group_invite";
  payload: Record<string, unknown>; // jsonb
  read_at: string | null; // timestamptz
  created_at: string; // timestamptz
}

/** Tabla: reports */
export interface DbReport {
  id: string; // uuid
  /** null en denuncias sin sesión (F-11, `20261101110001_moderation`). */
  reporter_id: string | null; // uuid → users.id
  target_type: "user" | "media" | "message" | "group_post" | "group" | "list";
  target_id: string;
  reason: string | null;
  /** F-11: contacto de una denuncia sin sesión. Ausente antes de aplicar la migración. */
  contact_email?: string | null;
  resolved_at?: string | null; // timestamptz
  resolution?: string | null;
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
  /** E-AVATAR-ICONS: mismo catálogo que los avatares. null = inicial del nombre. */
  icon: string | null;
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

// ============================================================
// Comprobación de compilación: cada `Db*` tiene exactamente las columnas de su
// tabla en `Database`. Si falla, el error de `tsc` muestra
// `{ columnas_desalineadas: "…" }` con la columna que sobra o que falta.
// ============================================================

type ColumnDrift<Domain, Row> = Exclude<keyof Domain, keyof Row> | Exclude<keyof Row, keyof Domain>;
type SameColumns<Domain, Row> = [ColumnDrift<Domain, Row>] extends [never]
  ? true
  : { columnas_desalineadas: ColumnDrift<Domain, Row> };
type Expect<T extends true> = T;

export type DomainTypesMatchSchema = [
  Expect<SameColumns<DbUser, Tables<"users">>>,
  Expect<SameColumns<DbMedia, Tables<"media">>>,
  Expect<SameColumns<DbUserMedia, Tables<"user_media">>>,
  Expect<SameColumns<DbUserMediaLog, Tables<"user_media_logs">>>,
  Expect<SameColumns<DbFriendship, Tables<"friendships">>>,
  Expect<SameColumns<DbRecommendation, Tables<"recommendations">>>,
  Expect<SameColumns<DbList, Tables<"lists">>>,
  Expect<SameColumns<DbListMember, Tables<"list_members">>>,
  Expect<SameColumns<DbListItem, Tables<"list_items">>>,
  Expect<SameColumns<DbNotification, Tables<"notifications">>>,
  Expect<SameColumns<DbReport, Tables<"reports">>>,
  Expect<SameColumns<DbSuggestion, Tables<"suggestions">>>,
  Expect<SameColumns<DbConversation, Tables<"conversations">>>,
  Expect<SameColumns<DbConversationMember, Tables<"conversation_members">>>,
  Expect<SameColumns<DbMessage, Tables<"messages">>>,
  Expect<SameColumns<DbGroup, Tables<"groups">>>,
  Expect<SameColumns<DbGroupMember, Tables<"group_members">>>,
  Expect<SameColumns<DbGroupInvitation, Tables<"group_invitations">>>,
  Expect<SameColumns<DbGroupPost, Tables<"group_posts">>>,
];
