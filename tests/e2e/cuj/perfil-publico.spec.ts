// CUJ 6 · Perfil público (F3-7): /u/:username sin sesión enseña las listas
// públicas del usuario y nunca las privadas. Se prueba la página (que filtra
// las públicas y oculta las vacías, `lib/social/public-collection.ts`) y,
// aparte, la RLS de `lists` con la clave anónima.
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { admin, createUser, ensureMedia, uniq } from "./_db";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SUPABASE_URL, ANON_KEY } = require("./env.cjs");

test("perfil público: sin sesión se ven las listas públicas y no las privadas", async ({ page }) => {
  const user = await createUser("perfil");
  const tag = uniq();
  const publicName = `Pública ${tag}`;
  const privateName = `Privada ${tag}`;
  await ensureMedia("movie_238", "El padrino", "movie", 1972);
  const { data: lists, error } = await admin
    .from("lists")
    .insert([
      { owner_id: user.id, name: publicName, media_type: "movie", is_public: true },
      { owner_id: user.id, name: privateName, media_type: "movie", is_public: false },
    ])
    .select("id, name");
  expect(error).toBeNull();
  const pub = lists!.find((l) => l.name === publicName)!;
  const priv = lists!.find((l) => l.name === privateName)!;
  // Con un título cada una: la página oculta las listas vacías.
  const { error: itemsError } = await admin.from("list_items").insert([
    { list_id: pub.id, media_id: "movie_238", added_by: user.id },
    { list_id: priv.id, media_id: "movie_238", added_by: user.id },
  ]);
  expect(itemsError).toBeNull();

  const res = await page.goto(`/es/u/${user.username}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText(publicName)).toBeVisible();
  await expect(page.getByText(privateName)).toHaveCount(0);

  // La privada tampoco se abre por su enlace directo…
  const direct = await page.goto(`/es/u/${user.username}/l/${priv.id}`);
  expect(direct?.status()).toBe(404);

  // …ni la devuelve la base a un anónimo (RLS), y la pública sí.
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: anonPriv } = await anon.from("lists").select("id").eq("id", priv.id);
  expect(anonPriv ?? []).toHaveLength(0);
  const { data: anonPub } = await anon.from("lists").select("id").eq("id", pub.id);
  expect(anonPub ?? []).toHaveLength(1);
});

test("perfil público: un usuario que no existe da 404", async ({ page }) => {
  const res = await page.goto(`/es/u/nadie${uniq()}`);
  expect(res?.status()).toBe(404);
});
