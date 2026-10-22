/**
 * Utilidades de la suite RLS (F-02). Corre contra el proyecto Supabase de TEST,
 * nunca contra producción. Necesita:
 *   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY
 *
 * Cada ejecución crea sus propios usuarios (correo `f02-<etiqueta>-<run>@kultura.test`)
 * con el cliente admin y los borra al final; el borrado en cascada de
 * `auth.users` → `public.users` se lleva amistades, grupos, listas y chats.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const TEST_URL = process.env.SUPABASE_TEST_URL ?? "";
export const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? "";
export const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";

/** Sin las tres variables la suite se salta (el job de CI comprueba antes que existan). */
export const configured = Boolean(TEST_URL && TEST_ANON_KEY && TEST_SERVICE_KEY);

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PASSWORD = `F02-${RUN}-Aa1!`;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient {
  return createClient(TEST_URL, TEST_SERVICE_KEY, noSession);
}

export function anonClient(): SupabaseClient {
  return createClient(TEST_URL, TEST_ANON_KEY, noSession);
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

const created: string[] = [];

export async function createUser(label: string, opts: { demo?: boolean } = {}): Promise<TestUser> {
  const admin = adminClient();
  const email = `f02-${label}-${RUN}@kultura.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: opts.demo ? { demo: true } : {},
  });
  if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`);
  created.push(data.user.id);

  const client = anonClient();
  const { error: loginError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (loginError) throw new Error(`login ${label}: ${loginError.message}`);
  return { id: data.user.id, email, client };
}

export async function deleteCreatedUsers(): Promise<void> {
  const admin = adminClient();
  for (const id of created.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
}

/** Amistad aceptada creada por el servidor (montaje de los tests). */
export async function makeFriends(a: TestUser, b: TestUser): Promise<void> {
  const { error } = await adminClient()
    .from("friendships")
    .insert({ requester_id: a.id, receiver_id: b.id, status: "accepted" });
  if (error) throw new Error(`makeFriends: ${error.message}`);
}

export async function createGroup(owner: TestUser, isPublic: boolean): Promise<string> {
  const { data, error } = await owner.client
    .from("groups")
    .insert({ owner_id: owner.id, name: `F02 ${RUN}`, is_public: isPublic })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createGroup: ${error?.message}`);
  return data.id as string;
}

export async function isMember(groupId: string, userId: string): Promise<boolean> {
  const { data } = await adminClient()
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId);
  return (data ?? []).length > 0;
}

/** Bloqueado = error de Postgres/PostgREST o 0 filas afectadas. */
export function blocked(res: { error: unknown; data: unknown }): boolean {
  if (res.error) return true;
  return Array.isArray(res.data) ? res.data.length === 0 : res.data == null;
}
