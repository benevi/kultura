// CUJ 6 · Perfil público (F3-7): /u/:username sin sesión enseña las listas
// públicas del usuario y nunca las privadas (RLS real, no simulada).
import { test, expect } from "@playwright/test";
import { admin, createUser, uniq } from "./_db";

test("perfil público: sin sesión se ven las listas públicas y no las privadas", async ({ page }) => {
  const user = await createUser("perfil", { libraryVisibility: "public" });
  const tag = uniq();
  const publicName = `Pública ${tag}`;
  const privateName = `Privada ${tag}`;
  const { error } = await admin.from("lists").insert([
    { owner_id: user.id, name: publicName, media_type: "movie", is_public: true },
    { owner_id: user.id, name: privateName, media_type: "movie", is_public: false },
  ]);
  expect(error).toBeNull();

  const res = await page.goto(`/es/u/${user.username}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText(user.username).first()).toBeVisible();
  await expect(page.getByText(publicName)).toBeVisible();
  await expect(page.getByText(privateName)).toHaveCount(0);

  // La lista privada tampoco se abre por su enlace directo.
  const { data: priv } = await admin.from("lists").select("id").eq("name", privateName).single();
  const direct = await page.goto(`/es/u/${user.username}/l/${priv!.id}`);
  expect(direct?.status()).toBe(404);
});

test("perfil público: un usuario que no existe da 404", async ({ page }) => {
  const res = await page.goto(`/es/u/nadie${uniq()}`);
  expect(res?.status()).toBe(404);
});
