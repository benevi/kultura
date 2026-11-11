// Ayudas para los CUJ sociales: dos personas a la vez, cada una en su propio
// contexto de navegador (sesiones separadas), y datos sociales sembrados con
// la service role del Supabase local.
import type { Browser, Page } from "@playwright/test";
import { servePosters } from "./fixtures";
import { admin, login, type TestUser } from "./_db";

/** Página con la sesión de `user`, en un contexto propio. */
export async function pageFor(browser: Browser, user: TestUser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
    bypassCSP: true,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    reducedMotion: "reduce",
  });
  await servePosters(context);
  const page = await context.newPage();
  await login(page, user);
  return page;
}

/** Amistad aceptada directamente en la base (para los flujos que no la prueban). */
export async function makeFriends(a: TestUser, b: TestUser): Promise<void> {
  const { error } = await admin
    .from("friendships")
    .insert({ requester_id: a.id, receiver_id: b.id, status: "accepted" });
  if (error) throw new Error(`friendship: ${error.message}`);
}
