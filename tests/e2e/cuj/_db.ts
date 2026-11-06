/**
 * Helpers de la red CUJ: acceso a Supabase LOCAL con la service role (para
 * preparar y comprobar datos) y login por el formulario real.
 *
 * Cada test crea su propio usuario con un sufijo único: los CUJ no dependen
 * unos de otros ni del orden, y se pueden repetir sin limpiar la BD.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SUPABASE_URL, SERVICE_ROLE_KEY, assertLocalSupabase } = require("./env.cjs");

assertLocalSupabase();

export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const PASSWORD = "Cuj-Kultura-2026!";

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
}

/** Sufijo corto y único por ejecución (cabe en los 15 caracteres del username). */
export function uniq(): string {
  return `${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;
}

/**
 * Crea un usuario confirmado y ya «onboarded» (sin pasar por /welcome), con la
 * fila de `public.users` que crea el disparador `handle_new_user`.
 */
export async function createUser(prefix: string, opts: { libraryVisibility?: "public" | "friends" | "private" } = {}): Promise<TestUser> {
  const email = `${prefix}${uniq()}@cuj.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { locale: "es", terms_accepted: true },
  });
  if (error || !data.user) throw new Error(`createUser(${email}): ${error?.message}`);
  const id = data.user.id;

  const row = await waitForPublicUser(id);
  const now = new Date().toISOString();
  const { error: stateError } = await admin
    .from("account_state")
    .upsert({ user_id: id, onboarded_at: now, terms_accepted_at: now, updated_at: now }, { onConflict: "user_id" });
  if (stateError) throw new Error(`account_state(${email}): ${stateError.message}`);

  if (opts.libraryVisibility) {
    const { error: visError } = await admin.from("users").update({ library_visibility: opts.libraryVisibility }).eq("id", id);
    if (visError) throw new Error(`library_visibility(${email}): ${visError.message}`);
  }
  return { id, email, username: row.username, password: PASSWORD };
}

/** Espera a la fila de `public.users` (disparador `on_auth_user_created`). */
export async function waitForPublicUser(id: string): Promise<{ id: string; username: string }> {
  for (let i = 0; i < 20; i++) {
    const { data } = await admin.from("users").select("id, username").eq("id", id).maybeSingle();
    if (data) return data as { id: string; username: string };
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`public.users sin fila para ${id}: ¿falla handle_new_user?`);
}

/** `exact`: el botón «Mostrar contraseña» también contiene «contraseña». */
export const passwordField = (page: Page) => page.getByLabel("Contraseña", { exact: true });

/** Entra por el formulario real de /es/login (sin simular la sesión). */
export async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto("/es/login");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await passwordField(page).fill(user.password);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/es\/(home|library|discover)/, { timeout: 20_000 });
}

/** Fila `media` mínima (catálogo) para preparar datos sin pasar por TMDB. */
export async function ensureMedia(id: string, title: string, type = "movie", year = 1999): Promise<void> {
  const externalId = id.split("_").slice(1).join("_");
  const { error } = await admin
    .from("media")
    .upsert({ id, external_id: externalId, type, title, year }, { onConflict: "id" });
  if (error) throw new Error(`media(${id}): ${error.message}`);
}

/** Lee la entrada de biblioteca (o null). */
export async function libraryEntry(userId: string, mediaId: string) {
  const { data, error } = await admin
    .from("user_media")
    .select("*")
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .maybeSingle();
  if (error) throw new Error(`user_media: ${error.message}`);
  return data as Record<string, unknown> | null;
}

/** Reintenta una lectura hasta que cumpla (las escrituras van por API). */
export async function eventually<T>(read: () => Promise<T>, ok: (v: T) => boolean, what: string): Promise<T> {
  let last: T | undefined;
  for (let i = 0; i < 40; i++) {
    last = await read();
    if (ok(last)) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  expect(last, what).toBeTruthy();
  throw new Error(`${what}: no se cumplió (último valor: ${JSON.stringify(last)})`);
}
